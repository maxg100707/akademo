-- AKADEMO: execute depois de exams-migration.sql e presentations-migration.sql.
-- Permite arquivos privados do perfil sem disciplina nem aula, mantendo RLS e os vinculos consistentes.

begin;

alter table public.conteudos alter column disciplina drop not null;
alter table public.conteudos alter column aula drop not null;

create or replace function public.validate_content_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Arquivos gerais pertencem apenas ao perfil e nao podem apontar para uma aula.
  if new.disciplina is null then
    if new.aula is not null then
      raise exception 'Um conteudo sem disciplina nao pode ser vinculado a uma aula.';
    end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.disciplinas as discipline
    where discipline.id = new.disciplina
      and discipline.perfil = new.perfil
      and discipline.email_user = new.email_user
  ) then
    raise exception 'A disciplina do conteudo nao pertence ao perfil atual.';
  end if;

  if new.aula is not null and not exists (
    select 1
    from public.aulas as lesson
    where lesson.id = new.aula
      and lesson.perfil = new.perfil
      and lesson.disciplina = new.disciplina
      and lesson.email_user = new.email_user
  ) then
    raise exception 'A aula do conteudo nao pertence a esta disciplina.';
  end if;
  return new;
end;
$$;

drop trigger if exists conteudos_validate_links on public.conteudos;
create trigger conteudos_validate_links
before insert or update of email_user, perfil, disciplina, aula
on public.conteudos for each row execute procedure public.validate_content_links();

alter table public.conteudos enable row level security;
revoke all on table public.conteudos from anon, authenticated;
grant select, insert, delete on table public.conteudos to authenticated;
grant update (titulo, disciplina, aula, updated_at) on table public.conteudos to authenticated;

drop policy if exists "contents read own lesson" on public.conteudos;
drop policy if exists "contents create own lesson" on public.conteudos;
drop policy if exists "contents delete own lesson" on public.conteudos;
drop policy if exists "contents read own profile" on public.conteudos;
drop policy if exists "contents create own profile" on public.conteudos;
drop policy if exists "contents update own profile" on public.conteudos;
drop policy if exists "contents delete own profile" on public.conteudos;

create policy "contents read own profile" on public.conteudos
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = conteudos.perfil and profile.user_id = (select auth.uid())
  )
);

create policy "contents create own profile" on public.conteudos
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = conteudos.perfil and profile.user_id = (select auth.uid())
  )
  and (
    (conteudos.disciplina is null and conteudos.aula is null)
    or (
      conteudos.disciplina is not null
      and exists (
        select 1 from public.disciplinas as discipline
        where discipline.id = conteudos.disciplina
          and discipline.perfil = conteudos.perfil
          and discipline.email_user = (select auth.jwt() ->> 'email')
      )
      and (
        conteudos.aula is null
        or exists (
          select 1 from public.aulas as lesson
          where lesson.id = conteudos.aula
            and lesson.perfil = conteudos.perfil
            and lesson.disciplina = conteudos.disciplina
            and lesson.email_user = (select auth.jwt() ->> 'email')
        )
      )
    )
  )
);

create policy "contents update own profile" on public.conteudos
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = conteudos.perfil and profile.user_id = (select auth.uid())
  )
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = conteudos.perfil and profile.user_id = (select auth.uid())
  )
  and (
    (conteudos.disciplina is null and conteudos.aula is null)
    or (
      conteudos.disciplina is not null
      and exists (
        select 1 from public.disciplinas as discipline
        where discipline.id = conteudos.disciplina
          and discipline.perfil = conteudos.perfil
          and discipline.email_user = (select auth.jwt() ->> 'email')
      )
      and (
        conteudos.aula is null
        or exists (
          select 1 from public.aulas as lesson
          where lesson.id = conteudos.aula
            and lesson.perfil = conteudos.perfil
              and lesson.disciplina = conteudos.disciplina
              and lesson.email_user = (select auth.jwt() ->> 'email')
        )
      )
    )
  )
);

create policy "contents delete own profile" on public.conteudos
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = conteudos.perfil and profile.user_id = (select auth.uid())
  )
);

-- Atualiza imediatamente o cache do PostgREST depois da alteracao de permissao/esquema.
notify pgrst, 'reload schema';

commit;
