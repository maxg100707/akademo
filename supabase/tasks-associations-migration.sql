-- AKADEMO · Vínculos opcionais de tarefas
-- Execute APÓS tasks-migration.sql, exams-migration.sql e presentations-migration.sql.
-- Permite tarefas independentes e tarefas ligadas a exatamente uma aula, prova ou apresentação.

alter table public.tarefas
  add column if not exists prova uuid,
  add column if not exists apresentacao uuid;

alter table public.tarefas
  alter column disciplina drop not null;

alter table public.tarefas
  drop constraint if exists tarefas_disciplina_fkey,
  drop constraint if exists tarefas_prova_fkey,
  drop constraint if exists tarefas_apresentacao_fkey,
  drop constraint if exists tarefas_single_activity_check;

alter table public.tarefas
  add constraint tarefas_disciplina_fkey
    foreign key (disciplina) references public.disciplinas(id) on delete set null,
  add constraint tarefas_prova_fkey
    foreign key (prova) references public.provas(id) on delete set null,
  add constraint tarefas_apresentacao_fkey
    foreign key (apresentacao) references public.apresentacoes(id) on delete set null,
  add constraint tarefas_single_activity_check
    check (num_nonnulls(aula, prova, apresentacao) <= 1);

create index if not exists tarefas_prova_idx
  on public.tarefas(prova) where prova is not null;
create index if not exists tarefas_apresentacao_idx
  on public.tarefas(apresentacao) where apresentacao is not null;

create or replace function public.validate_tarefa_links()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_discipline uuid;
begin
  new.titulo = btrim(new.titulo);
  new.descricao = nullif(btrim(coalesce(new.descricao, '')), '');

  if num_nonnulls(new.aula, new.prova, new.apresentacao) > 1 then
    raise exception using
      errcode = '23514',
      message = 'Uma tarefa pode ser vinculada somente a uma aula, prova ou apresentação.';
  end if;

  if new.aula is not null then
    select lesson.disciplina into linked_discipline
      from public.aulas as lesson
      where lesson.id = new.aula
        and lesson.perfil = new.perfil
        and lesson.email_user = new.email_user;
    if not found then
      raise exception using errcode = '23514', message = 'A aula vinculada não pertence a este perfil.';
    end if;
  elsif new.prova is not null then
    select exam.disciplina into linked_discipline
      from public.provas as exam
      where exam.id = new.prova
        and exam.perfil = new.perfil
        and exam.email_user = new.email_user;
    if not found then
      raise exception using errcode = '23514', message = 'A prova vinculada não pertence a este perfil.';
    end if;
  elsif new.apresentacao is not null then
    select presentation.disciplina into linked_discipline
      from public.apresentacoes as presentation
      where presentation.id = new.apresentacao
        and presentation.perfil = new.perfil
        and presentation.email_user = new.email_user;
    if not found then
      raise exception using errcode = '23514', message = 'A apresentação vinculada não pertence a este perfil.';
    end if;
  end if;

  if linked_discipline is not null then
    if new.disciplina is null then
      new.disciplina = linked_discipline;
    elsif new.disciplina <> linked_discipline then
      raise exception using
        errcode = '23514',
        message = 'A disciplina da tarefa deve ser a mesma do compromisso vinculado.';
    end if;
  end if;

  if new.disciplina is not null and not exists (
    select 1
      from public.disciplinas as discipline
      where discipline.id = new.disciplina
        and discipline.perfil = new.perfil
        and discipline.email_user = new.email_user
  ) then
    raise exception using errcode = '23514', message = 'A disciplina da tarefa não pertence a este perfil.';
  end if;

  return new;
end;
$$;

drop trigger if exists tarefas_validate_links on public.tarefas;
create trigger tarefas_validate_links
before insert or update of email_user, perfil, disciplina, aula, prova, apresentacao, titulo, descricao, prazo, completa
on public.tarefas
for each row execute procedure public.validate_tarefa_links();

grant update (disciplina, aula, prova, apresentacao, titulo, descricao, prazo, completa, updated_at)
  on table public.tarefas to authenticated;

drop policy if exists "tasks create own profile" on public.tarefas;
create policy "tasks create own profile" on public.tarefas
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = tarefas.perfil and profile.user_id = (select auth.uid())
  )
  and (tarefas.disciplina is null or exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = tarefas.disciplina
      and discipline.perfil = tarefas.perfil
      and discipline.email_user = (select auth.jwt() ->> 'email')
  ))
  and (tarefas.aula is null or exists (
    select 1 from public.aulas as lesson
    where lesson.id = tarefas.aula
      and lesson.perfil = tarefas.perfil
      and lesson.email_user = (select auth.jwt() ->> 'email')
  ))
  and (tarefas.prova is null or exists (
    select 1 from public.provas as exam
    where exam.id = tarefas.prova
      and exam.perfil = tarefas.perfil
      and exam.email_user = (select auth.jwt() ->> 'email')
  ))
  and (tarefas.apresentacao is null or exists (
    select 1 from public.apresentacoes as presentation
    where presentation.id = tarefas.apresentacao
      and presentation.perfil = tarefas.perfil
      and presentation.email_user = (select auth.jwt() ->> 'email')
  ))
  and num_nonnulls(tarefas.aula, tarefas.prova, tarefas.apresentacao) <= 1
);

drop policy if exists "tasks update own profile" on public.tarefas;
create policy "tasks update own profile" on public.tarefas
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = tarefas.perfil and profile.user_id = (select auth.uid())
  )
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = tarefas.perfil and profile.user_id = (select auth.uid())
  )
  and (tarefas.disciplina is null or exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = tarefas.disciplina
      and discipline.perfil = tarefas.perfil
      and discipline.email_user = (select auth.jwt() ->> 'email')
  ))
  and (tarefas.aula is null or exists (
    select 1 from public.aulas as lesson
    where lesson.id = tarefas.aula
      and lesson.perfil = tarefas.perfil
      and lesson.email_user = (select auth.jwt() ->> 'email')
  ))
  and (tarefas.prova is null or exists (
    select 1 from public.provas as exam
    where exam.id = tarefas.prova
      and exam.perfil = tarefas.perfil
      and exam.email_user = (select auth.jwt() ->> 'email')
  ))
  and (tarefas.apresentacao is null or exists (
    select 1 from public.apresentacoes as presentation
    where presentation.id = tarefas.apresentacao
      and presentation.perfil = tarefas.perfil
      and presentation.email_user = (select auth.jwt() ->> 'email')
  ))
  and num_nonnulls(tarefas.aula, tarefas.prova, tarefas.apresentacao) <= 1
);
