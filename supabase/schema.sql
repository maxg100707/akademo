-- AKADEMO — schema, segurança e políticas RLS
-- Execute este arquivo no SQL Editor de um projeto Supabase novo.
-- Em Authentication > Providers, habilite Email e Google antes de usar o aplicativo.

create extension if not exists pgcrypto;

-- Dados públicos controlados pelo próprio usuário autenticado.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  foto_perfil_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O id e user_id adicionais são essenciais para políticas seguras e para editar/excluir perfis.
create table if not exists public.perfil_estudo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  instituicao text not null check (char_length(btrim(instituicao)) between 1 and 120),
  curso text not null check (char_length(btrim(curso)) between 1 and 120),
  semestre integer not null check (semestre between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migração compatível com uma instalação anterior que possua apenas as colunas
-- solicitadas inicialmente (email, instituicao, curso e semestre). CREATE TABLE
-- IF NOT EXISTS não altera tabelas já existentes, portanto os campos técnicos
-- precisam ser adicionados e associados à conta do Auth pelo e-mail.
-- Algumas estruturas antigas usam id BIGINT. Não é possível atribuir o UUID do
-- Auth a essa coluna; preservamos o id legado e criamos o id UUID correto.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.users'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.users rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.perfil_estudo rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'user_id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.perfil_estudo rename column user_id to legacy_user_id;
  end if;
end;
$$;

alter table public.users add column if not exists id uuid;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists nome text;
alter table public.users add column if not exists foto_perfil_path text;
alter table public.users add column if not exists created_at timestamptz default now();
alter table public.users add column if not exists updated_at timestamptz default now();

update public.users as profile_user
set id = auth_user.id
from auth.users as auth_user
where profile_user.id is null
  and lower(btrim(profile_user.email)) = lower(auth_user.email);

update public.users
set nome = coalesce(nullif(btrim(nome), ''), split_part(email, '@', 1))
where nome is null or btrim(nome) = '';

do $$
declare orphan_users integer;
begin
  select count(*) into orphan_users from public.users where id is null;
  if orphan_users > 0 then
    raise exception 'Há % registro(s) em public.users sem conta correspondente em auth.users. Crie/migre essas contas antes de aplicar a segurança.', orphan_users;
  end if;
end;
$$;

alter table public.users alter column id set not null;
alter table public.users alter column email set not null;
alter table public.users alter column nome set not null;
alter table public.users alter column created_at set default now();
alter table public.users alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.users'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.users add constraint users_id_key unique (id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.users add constraint users_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

alter table public.perfil_estudo add column if not exists id uuid;
alter table public.perfil_estudo add column if not exists user_id uuid;
alter table public.perfil_estudo add column if not exists email text;
alter table public.perfil_estudo add column if not exists instituicao text;
alter table public.perfil_estudo add column if not exists curso text;
alter table public.perfil_estudo add column if not exists semestre integer;
alter table public.perfil_estudo add column if not exists created_at timestamptz default now();
alter table public.perfil_estudo add column if not exists updated_at timestamptz default now();

update public.perfil_estudo set id = gen_random_uuid() where id is null;
alter table public.perfil_estudo alter column id set default gen_random_uuid();

update public.perfil_estudo as study_profile
set user_id = auth_user.id
from auth.users as auth_user
where study_profile.user_id is null
  and lower(btrim(study_profile.email)) = lower(auth_user.email);

do $$
declare orphan_profiles integer;
begin
  select count(*) into orphan_profiles from public.perfil_estudo where user_id is null;
  if orphan_profiles > 0 then
    raise exception 'Há % perfil(is) de estudo sem conta correspondente em auth.users. Corrija os e-mails desses perfis antes de aplicar a segurança.', orphan_profiles;
  end if;
end;
$$;

alter table public.perfil_estudo alter column id set not null;
alter table public.perfil_estudo alter column user_id set not null;
alter table public.perfil_estudo alter column email set not null;
alter table public.perfil_estudo alter column instituicao set not null;
alter table public.perfil_estudo alter column curso set not null;
alter table public.perfil_estudo alter column semestre set not null;
alter table public.perfil_estudo alter column created_at set default now();
alter table public.perfil_estudo alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.perfil_estudo'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.perfil_estudo add constraint perfil_estudo_id_key unique (id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.perfil_estudo'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.perfil_estudo add constraint perfil_estudo_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

create index if not exists perfil_estudo_user_id_idx on public.perfil_estudo(user_id, created_at);

-- Cria o registro público assim que uma conta é criada no Auth.
-- SECURITY DEFINER permite inserir mesmo que o usuário ainda não tenha uma sessão confirmada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Mantém os e-mails em sincronia caso sejam alterados no Supabase Auth futuramente.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute procedure public.sync_auth_user_email();

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

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute procedure public.set_updated_at();

drop trigger if exists perfil_estudo_set_updated_at on public.perfil_estudo;
create trigger perfil_estudo_set_updated_at before update on public.perfil_estudo
for each row execute procedure public.set_updated_at();

-- RLS: nenhum usuário pode ver ou modificar registros de outro.
alter table public.users enable row level security;
alter table public.perfil_estudo enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.perfil_estudo from anon, authenticated;

grant select, insert on table public.users to authenticated;
-- E-mail e id nunca são editáveis pelo navegador; o Auth e o trigger são a fonte de verdade.
grant update (nome, foto_perfil_path, updated_at) on table public.users to authenticated;
grant select, insert, update, delete on table public.perfil_estudo to authenticated;

drop policy if exists "users read own row" on public.users;
create policy "users read own row" on public.users
for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "users insert own row" on public.users;
create policy "users insert own row" on public.users
for insert to authenticated with check (
  (select auth.uid()) = id and email = (select auth.jwt() ->> 'email')
);

drop policy if exists "users update own safe row" on public.users;
create policy "users update own safe row" on public.users
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and email = (select auth.jwt() ->> 'email'));

drop policy if exists "profiles read own" on public.perfil_estudo;
create policy "profiles read own" on public.perfil_estudo
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "profiles create own" on public.perfil_estudo;
create policy "profiles create own" on public.perfil_estudo
for insert to authenticated with check (
  (select auth.uid()) = user_id and email = (select auth.jwt() ->> 'email')
);

drop policy if exists "profiles update own" on public.perfil_estudo;
create policy "profiles update own" on public.perfil_estudo
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and email = (select auth.jwt() ->> 'email'));

drop policy if exists "profiles delete own" on public.perfil_estudo;
create policy "profiles delete own" on public.perfil_estudo
for delete to authenticated using ((select auth.uid()) = user_id);

-- Storage
-- Os buckets são privados e criados pela Edge Function abaixo. O id de cada bucket é o e-mail
-- do usuário, como solicitado. O usuário só pode acessar o arquivo de avatar dentro do próprio bucket.
-- storage.objects é uma tabela interna, já protegida por RLS e pertencente ao Supabase.
-- Não execute ALTER TABLE nela: as policies abaixo são suficientes.

drop policy if exists "akademo avatar read own bucket" on storage.objects;
create policy "akademo avatar read own bucket" on storage.objects
for select to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email')
  and name like 'foto_perfil_akademo.%'
  and position('/' in name) = 0
);

drop policy if exists "akademo avatar upload own bucket" on storage.objects;
create policy "akademo avatar upload own bucket" on storage.objects
for insert to authenticated with check (
  bucket_id = (select auth.jwt() ->> 'email')
  and name like 'foto_perfil_akademo.%'
  and position('/' in name) = 0
);

drop policy if exists "akademo avatar update own bucket" on storage.objects;
create policy "akademo avatar update own bucket" on storage.objects
for update to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'foto_perfil_akademo.%' and position('/' in name) = 0
) with check (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'foto_perfil_akademo.%' and position('/' in name) = 0
);

drop policy if exists "akademo avatar delete own bucket" on storage.objects;
create policy "akademo avatar delete own bucket" on storage.objects
for delete to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'foto_perfil_akademo.%' and position('/' in name) = 0
);
