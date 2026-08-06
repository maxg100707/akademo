-- AKADEMO · Tarefas
-- Execute este arquivo no SQL Editor depois das migrações de perfis, disciplinas e aulas.
-- Ele também corrige a tabela criada manualmente com id bigint mostrada no painel.

create extension if not exists pgcrypto;

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  titulo text not null,
  descricao text,
  prazo timestamptz not null,
  completa boolean not null default false,
  aula uuid references public.aulas(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A primeira versão da tabela pode ter sido criada com id int8. Preservamos esse
-- valor em legacy_id e passamos a usar UUID, igual ao restante das relações atuais.
do $$
declare
  primary_key record;
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.tarefas'::regclass and attname = 'id'
      and not attisdropped and atttypid <> 'uuid'::regtype
  ) then
    for primary_key in
      select conname from pg_constraint
      where conrelid = 'public.tarefas'::regclass and contype = 'p'
    loop
      execute format('alter table public.tarefas drop constraint %I', primary_key.conname);
    end loop;
    alter table public.tarefas rename column id to legacy_id;
  end if;
end;
$$;

alter table public.tarefas add column if not exists id uuid;
alter table public.tarefas add column if not exists email_user text;
alter table public.tarefas add column if not exists perfil uuid;
alter table public.tarefas add column if not exists disciplina uuid;
alter table public.tarefas add column if not exists titulo text;
alter table public.tarefas add column if not exists descricao text;
alter table public.tarefas add column if not exists prazo timestamptz;
alter table public.tarefas add column if not exists completa boolean default false;
alter table public.tarefas add column if not exists aula uuid;
alter table public.tarefas add column if not exists created_at timestamptz default now();
alter table public.tarefas add column if not exists updated_at timestamptz default now();

update public.tarefas set id = gen_random_uuid() where id is null;
update public.tarefas set completa = false where completa is null;
update public.tarefas set created_at = now() where created_at is null;
update public.tarefas set updated_at = now() where updated_at is null;
update public.tarefas as task
set email_user = profile.email
from public.perfil_estudo as profile
where task.perfil = profile.id
  and coalesce(btrim(task.email_user), '') = '';

do $$
declare
  invalid_tasks integer;
  foreign_key record;
begin
  select count(*) into invalid_tasks
  from public.tarefas
  where id is null
     or coalesce(btrim(email_user), '') = ''
     or perfil is null
     or disciplina is null
     or coalesce(btrim(titulo), '') = ''
     or prazo is null;
  if invalid_tasks > 0 then
    raise exception using
      errcode = '23514',
      message = format('Há %s tarefa(s) incompleta(s). Preencha perfil, disciplina, título e prazo antes de executar novamente.', invalid_tasks);
  end if;

  for foreign_key in
    select constraint_name
    from information_schema.key_column_usage
    where table_schema = 'public' and table_name = 'tarefas'
      and column_name in ('perfil', 'disciplina', 'aula')
      and position_in_unique_constraint is not null
  loop
    execute format('alter table public.tarefas drop constraint if exists %I', foreign_key.constraint_name);
  end loop;
end;
$$;

alter table public.tarefas alter column id set default gen_random_uuid();
alter table public.tarefas alter column completa set default false;
alter table public.tarefas alter column created_at set default now();
alter table public.tarefas alter column updated_at set default now();
alter table public.tarefas alter column id set not null;
alter table public.tarefas alter column email_user set not null;
alter table public.tarefas alter column perfil set not null;
alter table public.tarefas alter column disciplina set not null;
alter table public.tarefas alter column titulo set not null;
alter table public.tarefas alter column prazo set not null;
alter table public.tarefas alter column completa set not null;
alter table public.tarefas alter column created_at set not null;
alter table public.tarefas alter column updated_at set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.tarefas'::regclass and contype = 'p') then
    alter table public.tarefas add constraint tarefas_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tarefas'::regclass and conname = 'tarefas_perfil_fkey') then
    alter table public.tarefas add constraint tarefas_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tarefas'::regclass and conname = 'tarefas_disciplina_fkey') then
    alter table public.tarefas add constraint tarefas_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tarefas'::regclass and conname = 'tarefas_aula_fkey') then
    alter table public.tarefas add constraint tarefas_aula_fkey foreign key (aula) references public.aulas(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.tarefas'::regclass and conname = 'tarefas_titulo_check') then
    alter table public.tarefas add constraint tarefas_titulo_check check (char_length(btrim(titulo)) between 1 and 180);
  end if;
end;
$$;

create index if not exists tarefas_perfil_status_prazo_idx on public.tarefas(perfil, completa, prazo);
create index if not exists tarefas_disciplina_prazo_idx on public.tarefas(disciplina, prazo);
create index if not exists tarefas_aula_idx on public.tarefas(aula) where aula is not null;

create or replace function public.validate_tarefa_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.titulo = btrim(new.titulo);
  new.descricao = nullif(btrim(coalesce(new.descricao, '')), '');
  if not exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = new.disciplina
      and discipline.perfil = new.perfil
      and discipline.email_user = new.email_user
  ) then
    raise exception using errcode = '23514', message = 'A disciplina da tarefa não pertence a este perfil.';
  end if;
  if new.aula is not null and not exists (
    select 1 from public.aulas as lesson
    where lesson.id = new.aula
      and lesson.perfil = new.perfil
      and lesson.disciplina = new.disciplina
      and lesson.email_user = new.email_user
  ) then
    raise exception using errcode = '23514', message = 'A aula vinculada não pertence à disciplina selecionada.';
  end if;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tarefas_validate_links on public.tarefas;
create trigger tarefas_validate_links before insert or update of email_user, perfil, disciplina, aula, titulo, descricao, prazo, completa
on public.tarefas for each row execute procedure public.validate_tarefa_links();
drop trigger if exists tarefas_set_updated_at on public.tarefas;
create trigger tarefas_set_updated_at before update on public.tarefas for each row execute procedure public.set_updated_at();

alter table public.tarefas enable row level security;
revoke all on table public.tarefas from anon, authenticated;
grant select, insert, delete on table public.tarefas to authenticated;
grant update (disciplina, aula, titulo, descricao, prazo, completa, updated_at) on table public.tarefas to authenticated;

drop policy if exists "tasks read own profile" on public.tarefas;
create policy "tasks read own profile" on public.tarefas
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = tarefas.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "tasks create own profile" on public.tarefas;
create policy "tasks create own profile" on public.tarefas
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = tarefas.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as discipline where discipline.id = tarefas.disciplina and discipline.perfil = tarefas.perfil and discipline.email_user = (select auth.jwt() ->> 'email'))
  and (tarefas.aula is null or exists (select 1 from public.aulas as lesson where lesson.id = tarefas.aula and lesson.perfil = tarefas.perfil and lesson.disciplina = tarefas.disciplina and lesson.email_user = (select auth.jwt() ->> 'email')))
);

drop policy if exists "tasks update own profile" on public.tarefas;
create policy "tasks update own profile" on public.tarefas
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = tarefas.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = tarefas.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as discipline where discipline.id = tarefas.disciplina and discipline.perfil = tarefas.perfil and discipline.email_user = (select auth.jwt() ->> 'email'))
  and (tarefas.aula is null or exists (select 1 from public.aulas as lesson where lesson.id = tarefas.aula and lesson.perfil = tarefas.perfil and lesson.disciplina = tarefas.disciplina and lesson.email_user = (select auth.jwt() ->> 'email')))
);

drop policy if exists "tasks delete own profile" on public.tarefas;
create policy "tasks delete own profile" on public.tarefas
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = tarefas.perfil and profile.user_id = (select auth.uid()))
);

-- Mantém a coluna auxiliar de e-mail sincronizada se o endereço do Auth mudar.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
    update public.professores as professor set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where professor.perfil = profile.id and profile.user_id = new.id;
    update public.disciplinas as discipline set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where discipline.perfil = profile.id and profile.user_id = new.id;
    update public.horarios as schedule set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where schedule.perfil = profile.id and profile.user_id = new.id;
    update public.cronograma as chronogram set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where chronogram.perfil = profile.id and profile.user_id = new.id;
    update public.aulas as lesson set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where lesson.perfil = profile.id and profile.user_id = new.id;
    update public.conteudos as content set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where content.perfil = profile.id and profile.user_id = new.id;
    update public.tarefas as task set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where task.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;
