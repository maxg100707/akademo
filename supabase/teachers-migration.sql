-- AKADEMO: execute este arquivo no SQL Editor para habilitar professores
-- Requer a tabela public.perfil_estudo da schema.sql já aplicada.

create extension if not exists pgcrypto;

create table if not exists public.professores (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  nome_professor text not null check (char_length(btrim(nome_professor)) between 1 and 120),
  email_professor text,
  telefone_professor text check (telefone_professor is null or telefone_professor ~ '^[0-9]{1,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare old_fk record;
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.professores'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.professores rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.professores'::regclass and attname = 'perfil'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    for old_fk in
      select c.conname
      from pg_constraint as c
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.professores'::regclass
        and c.contype = 'f' and a.attname = 'perfil'
    loop
      execute format('alter table public.professores drop constraint if exists %I', old_fk.conname);
    end loop;
    alter table public.professores rename column perfil to legacy_perfil;
  end if;
end;
$$;

alter table public.professores add column if not exists id uuid;
alter table public.professores add column if not exists email_user text;
alter table public.professores add column if not exists perfil uuid;
alter table public.professores add column if not exists nome_professor text;
alter table public.professores add column if not exists email_professor text;
alter table public.professores add column if not exists telefone_professor text;

-- Garante as colunas também quando a tabela já existia em uma versão anterior.
alter table public.professores add column if not exists created_at timestamptz default now();
alter table public.professores add column if not exists updated_at timestamptz default now();

-- Instalações antigas podem ter criado este campo como bigint. O app precisa
-- preservar o DDI e possíveis zeros iniciais, portanto o formato definitivo é texto.
alter table public.professores
  alter column telefone_professor type text using telefone_professor::text;

update public.professores
set telefone_professor = nullif(regexp_replace(telefone_professor, '[^0-9]', '', 'g'), '')
where telefone_professor is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.professores'::regclass and conname = 'professores_telefone_professor_check'
  ) then
    alter table public.professores add constraint professores_telefone_professor_check
      check (telefone_professor is null or telefone_professor ~ '^[0-9]{1,15}$');
  end if;
end;
$$;

update public.professores set id = gen_random_uuid() where id is null;
alter table public.professores alter column id set default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.professores'::regclass and attname = 'legacy_perfil' and not attisdropped
  ) and exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'legacy_id' and not attisdropped
  ) then
    execute $sql$
      update public.professores as professor
      set perfil = profile.id,
          email_user = coalesce(professor.email_user, profile.email)
      from public.perfil_estudo as profile
      where professor.perfil is null
        and professor.legacy_perfil::text = profile.legacy_id::text
    $sql$;
  end if;
end;
$$;

update public.professores as professor
set perfil = profile.id,
    email_user = coalesce(professor.email_user, profile.email)
from (
  select email, (array_agg(id))[1] as id
  from public.perfil_estudo
  group by email
  having count(*) = 1
) as profile
where professor.perfil is null
  and lower(btrim(coalesce(professor.email_user, ''))) = lower(profile.email);

update public.professores as professor
set email_user = profile.email
from public.perfil_estudo as profile
where professor.email_user is null and professor.perfil = profile.id;

do $$
declare orphan_professors integer;
begin
  select count(*) into orphan_professors
  from public.professores as professor
  left join public.perfil_estudo as profile on profile.id = professor.perfil
  where professor.perfil is null or profile.id is null or professor.email_user is null
    or professor.nome_professor is null or btrim(professor.nome_professor) = '';
  if orphan_professors > 0 then
    raise exception 'Há % professor(es) legados sem perfil identificável. Atualize o perfil/e-mail desses registros antes de continuar.', orphan_professors;
  end if;
end;
$$;

alter table public.professores alter column id set not null;
alter table public.professores alter column email_user set not null;
alter table public.professores alter column perfil set not null;
alter table public.professores alter column nome_professor set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.professores'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.professores add constraint professores_id_key unique (id);
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.professores'::regclass and conname = 'professores_perfil_fkey'
  ) then
    alter table public.professores add constraint professores_perfil_fkey
      foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
end;
$$;

create index if not exists professores_perfil_idx on public.professores(perfil, created_at);

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

drop trigger if exists professores_set_updated_at on public.professores;
create trigger professores_set_updated_at before update on public.professores
for each row execute procedure public.set_updated_at();

-- Inclui os professores na sincronização de e-mail já usada pelo AKADEMO.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
    update public.professores as professor
    set email_user = new.email, updated_at = now()
    from public.perfil_estudo as profile
    where professor.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.professores enable row level security;
revoke all on table public.professores from anon, authenticated;
grant select, insert, update, delete on table public.professores to authenticated;

drop policy if exists "teachers read own profile" on public.professores;
create policy "teachers read own profile" on public.professores
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "teachers create own profile" on public.professores;
create policy "teachers create own profile" on public.professores
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "teachers update own profile" on public.professores;
create policy "teachers update own profile" on public.professores
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "teachers delete own profile" on public.professores;
create policy "teachers delete own profile" on public.professores
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
);
