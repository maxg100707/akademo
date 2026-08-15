-- AKADEMO - Game data
-- Run after the study profile migration.
-- Keeps a legacy numeric id as legacy_id and creates the UUID id used by the application.

create extension if not exists pgcrypto;

create table if not exists public.dados_jogos (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  dados jsonb not null default '{"version":1,"games":{"calculations":{"totalCorrect":0,"totalIncorrect":0,"totalGames":0,"highestScore":0,"longestStreak":0,"lastPlayedAt":null,"history":[]}}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (perfil)
);

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.dados_jogos'::regclass
      and attname = 'id'
      and atttypid <> 'uuid'::regtype
      and not attisdropped
  ) and not exists (
    select 1 from pg_attribute
    where attrelid = 'public.dados_jogos'::regclass
      and attname = 'legacy_id'
      and not attisdropped
  ) then
    alter table public.dados_jogos rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.dados_jogos'::regclass
      and attname = 'dados'
      and atttypid = 'json'::regtype
      and not attisdropped
  ) then
    alter table public.dados_jogos alter column dados drop default;
    alter table public.dados_jogos alter column dados type jsonb using dados::jsonb;
  end if;
end;
$$;

alter table public.dados_jogos add column if not exists id uuid;
alter table public.dados_jogos add column if not exists email_user text;
alter table public.dados_jogos add column if not exists perfil uuid;
alter table public.dados_jogos add column if not exists dados jsonb;
alter table public.dados_jogos add column if not exists created_at timestamptz default now();
alter table public.dados_jogos add column if not exists updated_at timestamptz default now();

update public.dados_jogos set id = gen_random_uuid() where id is null;
update public.dados_jogos as game_data
set email_user = profile.email
from public.perfil_estudo as profile
where game_data.email_user is null and game_data.perfil = profile.id;
update public.dados_jogos
set dados = '{"version":1,"games":{"calculations":{"totalCorrect":0,"totalIncorrect":0,"totalGames":0,"highestScore":0,"longestStreak":0,"lastPlayedAt":null,"history":[]}}}'::jsonb
where dados is null;
update public.dados_jogos set created_at = now() where created_at is null;
update public.dados_jogos set updated_at = now() where updated_at is null;

do $$
declare invalid_rows integer;
begin
  select count(*) into invalid_rows
  from public.dados_jogos as game_data
  left join public.perfil_estudo as profile on profile.id = game_data.perfil
  where game_data.id is null
     or game_data.email_user is null
     or game_data.perfil is null
     or profile.id is null
     or jsonb_typeof(game_data.dados) <> 'object'
     or (game_data.dados ? 'games' and jsonb_typeof(game_data.dados -> 'games') <> 'object');
  if invalid_rows > 0 then
    raise exception 'There are % game-data rows with invalid ownership or JSON. Fix them before continuing.', invalid_rows;
  end if;
end;
$$;

alter table public.dados_jogos alter column id set default gen_random_uuid();
alter table public.dados_jogos alter column dados set default '{"version":1,"games":{"calculations":{"totalCorrect":0,"totalIncorrect":0,"totalGames":0,"highestScore":0,"longestStreak":0,"lastPlayedAt":null,"history":[]}}}'::jsonb;
alter table public.dados_jogos alter column created_at set default now();
alter table public.dados_jogos alter column updated_at set default now();
alter table public.dados_jogos alter column id set not null;
alter table public.dados_jogos alter column email_user set not null;
alter table public.dados_jogos alter column perfil set not null;
alter table public.dados_jogos alter column dados set not null;
alter table public.dados_jogos alter column created_at set not null;
alter table public.dados_jogos alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes
    join pg_attribute attributes on attributes.attrelid = indexes.indrelid
      and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.dados_jogos'::regclass
      and indexes.indisunique
      and indexes.indnkeyatts = 1
      and attributes.attname = 'id'
  ) then
    alter table public.dados_jogos add constraint dados_jogos_id_key unique (id);
  end if;
  if not exists (
    select 1 from pg_index indexes
    join pg_attribute attributes on attributes.attrelid = indexes.indrelid
      and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.dados_jogos'::regclass
      and indexes.indisunique
      and indexes.indnkeyatts = 1
      and attributes.attname = 'perfil'
  ) then
    alter table public.dados_jogos add constraint dados_jogos_perfil_key unique (perfil);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.dados_jogos'::regclass and conname = 'dados_jogos_perfil_fkey') then
    alter table public.dados_jogos add constraint dados_jogos_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
end;
$$;

create index if not exists dados_jogos_email_perfil_idx on public.dados_jogos(email_user, perfil);

create or replace function public.dados_jogos_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_dados_jogos_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare owner_email text;
begin
  select email into owner_email from public.perfil_estudo where id = new.perfil;
  if owner_email is null or owner_email <> new.email_user then
    raise exception 'Game data profile must belong to the supplied email.';
  end if;
  if jsonb_typeof(new.dados) <> 'object' then
    raise exception 'Game data must be a JSON object.';
  end if;
  if new.dados ? 'games' and jsonb_typeof(new.dados -> 'games') <> 'object' then
    raise exception 'Game data games field must be a JSON object.';
  end if;
  return new;
end;
$$;

drop trigger if exists dados_jogos_updated_at on public.dados_jogos;
create trigger dados_jogos_updated_at
before update on public.dados_jogos
for each row execute function public.dados_jogos_set_updated_at();

drop trigger if exists dados_jogos_validate_owner on public.dados_jogos;
create trigger dados_jogos_validate_owner
before insert or update on public.dados_jogos
for each row execute function public.validate_dados_jogos_owner();

alter table public.dados_jogos enable row level security;
grant select, insert, update, delete on public.dados_jogos to authenticated;

drop policy if exists "dados_jogos_select_own" on public.dados_jogos;
drop policy if exists "dados_jogos_insert_own" on public.dados_jogos;
drop policy if exists "dados_jogos_update_own" on public.dados_jogos;
drop policy if exists "dados_jogos_delete_own" on public.dados_jogos;

create policy "dados_jogos_select_own" on public.dados_jogos
for select to authenticated
using (email_user = (auth.jwt() ->> 'email'));

create policy "dados_jogos_insert_own" on public.dados_jogos
for insert to authenticated
with check (email_user = (auth.jwt() ->> 'email'));

create policy "dados_jogos_update_own" on public.dados_jogos
for update to authenticated
using (email_user = (auth.jwt() ->> 'email'))
with check (email_user = (auth.jwt() ->> 'email'));

create policy "dados_jogos_delete_own" on public.dados_jogos
for delete to authenticated
using (email_user = (auth.jwt() ->> 'email'));
