-- AKADEMO: Configurações por perfil de estudo.
-- Execute este arquivo no SQL Editor do Supabase depois das migrations base.
-- A tabela guarda uma configuração JSON por perfil e continua segura com RLS.

create extension if not exists pgcrypto;

create table if not exists public.configuracoes (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  config jsonb not null default '{"version":1,"dashboard":{"widgets":[],"favorites":[]}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidade com tabelas criadas manualmente pelo editor do Supabase.
-- Um id bigint legado é preservado como legacy_id e o aplicativo usa o id UUID.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.configuracoes'::regclass
      and attname = 'id'
      and atttypid <> 'uuid'::regtype
      and not attisdropped
  ) then
    alter table public.configuracoes rename column id to legacy_id;
  end if;
end;
$$;

alter table public.configuracoes add column if not exists id uuid;
alter table public.configuracoes add column if not exists email_user text;
alter table public.configuracoes add column if not exists perfil uuid;
alter table public.configuracoes add column if not exists config jsonb;
alter table public.configuracoes add column if not exists created_at timestamptz default now();
alter table public.configuracoes add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.configuracoes'::regclass
      and attname = 'config'
      and atttypid = 'json'::regtype
      and not attisdropped
  ) then
    alter table public.configuracoes alter column config type jsonb using config::jsonb;
  end if;
end;
$$;

update public.configuracoes
set id = gen_random_uuid()
where id is null;

update public.configuracoes as configuration
set email_user = profile.email
from public.perfil_estudo as profile
where configuration.email_user is null
  and configuration.perfil = profile.id;

update public.configuracoes
set config = '{"version":1,"dashboard":{"widgets":[],"favorites":[]}}'::jsonb
where config is null or jsonb_typeof(config) <> 'object';

update public.configuracoes set created_at = now() where created_at is null;
update public.configuracoes set updated_at = now() where updated_at is null;

do $$
declare invalid_rows integer;
begin
  select count(*) into invalid_rows
  from public.configuracoes as configuration
  left join public.perfil_estudo as profile on profile.id = configuration.perfil
  where configuration.id is null
     or configuration.email_user is null
     or configuration.perfil is null
     or profile.id is null
     or configuration.email_user <> profile.email
     or configuration.config is null
     or jsonb_typeof(configuration.config) <> 'object';

  if invalid_rows > 0 then
    raise exception 'There are % invalid configuration rows. Fix profile links and JSON before continuing.', invalid_rows;
  end if;
end;
$$;

alter table public.configuracoes alter column id set default gen_random_uuid();
alter table public.configuracoes alter column config set default '{"version":1,"dashboard":{"widgets":[],"favorites":[]}}'::jsonb;
alter table public.configuracoes alter column created_at set default now();
alter table public.configuracoes alter column updated_at set default now();
alter table public.configuracoes alter column id set not null;
alter table public.configuracoes alter column email_user set not null;
alter table public.configuracoes alter column perfil set not null;
alter table public.configuracoes alter column config set not null;
alter table public.configuracoes alter column created_at set not null;
alter table public.configuracoes alter column updated_at set not null;

create unique index if not exists configuracoes_id_key on public.configuracoes(id);
create unique index if not exists configuracoes_perfil_key on public.configuracoes(perfil);
create index if not exists configuracoes_email_perfil_idx on public.configuracoes(email_user, perfil);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.configuracoes'::regclass
      and conname = 'configuracoes_perfil_fkey'
  ) then
    alter table public.configuracoes
      add constraint configuracoes_perfil_fkey
      foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.configuracoes'::regclass
      and conname = 'configuracoes_config_object_check'
  ) then
    alter table public.configuracoes
      add constraint configuracoes_config_object_check
      check (jsonb_typeof(config) = 'object');
  end if;
end;
$$;

create or replace function public.validate_configuracoes()
returns trigger
language plpgsql
set search_path = public
as $$
declare profile_email text;
begin
  select email into profile_email
  from public.perfil_estudo
  where id = new.perfil;

  if profile_email is null then
    raise exception 'The selected study profile does not exist.';
  end if;
  if new.email_user is distinct from profile_email then
    raise exception 'The configuration email must match the study profile owner.';
  end if;
  if jsonb_typeof(new.config) <> 'object' then
    raise exception 'Configuration must be a JSON object.';
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

drop trigger if exists configuracoes_validate on public.configuracoes;
create trigger configuracoes_validate
before insert or update of email_user, perfil, config
on public.configuracoes
for each row execute procedure public.validate_configuracoes();

drop trigger if exists configuracoes_set_updated_at on public.configuracoes;
create trigger configuracoes_set_updated_at
before update on public.configuracoes
for each row execute procedure public.set_updated_at();

-- Mantém o e-mail auxiliar em sincronia quando o perfil recebe um novo e-mail do Auth.
create or replace function public.sync_configuracoes_profile_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.configuracoes
    set email_user = new.email, updated_at = now()
    where perfil = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists perfil_estudo_sync_configuracoes_email on public.perfil_estudo;
create trigger perfil_estudo_sync_configuracoes_email
after update of email on public.perfil_estudo
for each row execute procedure public.sync_configuracoes_profile_email();

alter table public.configuracoes enable row level security;
revoke all on table public.configuracoes from anon, authenticated;
grant select, insert, update, delete on table public.configuracoes to authenticated;

drop policy if exists "configurations read own profile" on public.configuracoes;
create policy "configurations read own profile" on public.configuracoes
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = configuracoes.perfil
      and profile.user_id = (select auth.uid())
  )
);

drop policy if exists "configurations create own profile" on public.configuracoes;
create policy "configurations create own profile" on public.configuracoes
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = configuracoes.perfil
      and profile.user_id = (select auth.uid())
      and profile.email = configuracoes.email_user
  )
);

drop policy if exists "configurations update own profile" on public.configuracoes;
create policy "configurations update own profile" on public.configuracoes
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = configuracoes.perfil
      and profile.user_id = (select auth.uid())
  )
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = configuracoes.perfil
      and profile.user_id = (select auth.uid())
      and profile.email = configuracoes.email_user
  )
);

drop policy if exists "configurations delete own profile" on public.configuracoes;
create policy "configurations delete own profile" on public.configuracoes
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = configuracoes.perfil
      and profile.user_id = (select auth.uid())
  )
);
