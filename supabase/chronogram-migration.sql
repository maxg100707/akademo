-- AKADEMO: execute depois de teachers-migration.sql, disciplines-migration.sql,
-- schedules-migration.sql e profile-dates-migration.sql.
-- Cria/atualiza o cronograma de aulas sem depender de IDs bigint legados.

create extension if not exists pgcrypto;

create table if not exists public.cronograma (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  tema text not null check (char_length(btrim(tema)) between 1 and 180),
  feriado boolean not null default false,
  prova boolean not null default false,
  apresentacao boolean not null default false,
  data_hora timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((feriado::integer + prova::integer + apresentacao::integer) <= 1)
);

do $$
declare old_fk record;
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.cronograma'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.cronograma rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.cronograma'::regclass and attname = 'perfil'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    for old_fk in
      select c.conname from pg_constraint as c
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.cronograma'::regclass and c.contype = 'f' and a.attname = 'perfil'
    loop
      execute format('alter table public.cronograma drop constraint if exists %I', old_fk.conname);
    end loop;
    alter table public.cronograma rename column perfil to legacy_perfil;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.cronograma'::regclass and attname = 'disciplina'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    for old_fk in
      select c.conname from pg_constraint as c
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.cronograma'::regclass and c.contype = 'f' and a.attname = 'disciplina'
    loop
      execute format('alter table public.cronograma drop constraint if exists %I', old_fk.conname);
    end loop;
    alter table public.cronograma rename column disciplina to legacy_disciplina;
  end if;
end;
$$;

alter table public.cronograma add column if not exists id uuid;
alter table public.cronograma add column if not exists email_user text;
alter table public.cronograma add column if not exists perfil uuid;
alter table public.cronograma add column if not exists disciplina uuid;
alter table public.cronograma add column if not exists tema text;
alter table public.cronograma add column if not exists feriado boolean default false;
alter table public.cronograma add column if not exists prova boolean default false;
alter table public.cronograma add column if not exists apresentacao boolean default false;
alter table public.cronograma add column if not exists data_hora timestamptz;
alter table public.cronograma add column if not exists created_at timestamptz default now();
alter table public.cronograma add column if not exists updated_at timestamptz default now();

update public.cronograma set id = gen_random_uuid() where id is null;
update public.cronograma set feriado = false where feriado is null;
update public.cronograma set prova = false where prova is null;
update public.cronograma set apresentacao = false where apresentacao is null;
update public.cronograma set created_at = now() where created_at is null;
update public.cronograma set updated_at = now() where updated_at is null;

alter table public.cronograma alter column id set default gen_random_uuid();
alter table public.cronograma alter column feriado set default false;
alter table public.cronograma alter column prova set default false;
alter table public.cronograma alter column apresentacao set default false;
alter table public.cronograma alter column created_at set default now();
alter table public.cronograma alter column updated_at set default now();

-- Mapeia chaves legadas somente quando as tabelas de origem preservaram legacy_id.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.cronograma'::regclass and attname = 'legacy_perfil' and not attisdropped
  ) and exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'legacy_id' and not attisdropped
  ) then
    execute $sql$
      update public.cronograma as item
      set perfil = profile.id,
          email_user = coalesce(item.email_user, profile.email)
      from public.perfil_estudo as profile
      where item.perfil is null and item.legacy_perfil::text = profile.legacy_id::text
    $sql$;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.cronograma'::regclass and attname = 'legacy_disciplina' and not attisdropped
  ) and exists (
    select 1 from pg_attribute
    where attrelid = 'public.disciplinas'::regclass and attname = 'legacy_id' and not attisdropped
  ) then
    execute $sql$
      update public.cronograma as item
      set disciplina = discipline.id,
          perfil = coalesce(item.perfil, discipline.perfil),
          email_user = coalesce(item.email_user, discipline.email_user)
      from public.disciplinas as discipline
      where item.disciplina is null and item.legacy_disciplina::text = discipline.legacy_id::text
    $sql$;
  end if;
end;
$$;

update public.cronograma as item
set perfil = discipline.perfil,
    email_user = coalesce(item.email_user, discipline.email_user)
from public.disciplinas as discipline
where item.perfil is null and item.disciplina = discipline.id;

update public.cronograma as item
set email_user = profile.email
from public.perfil_estudo as profile
where item.email_user is null and item.perfil = profile.id;

do $$
declare invalid_entries integer;
begin
  select count(*) into invalid_entries
  from public.cronograma as item
  left join public.perfil_estudo as profile on profile.id = item.perfil
  left join public.disciplinas as discipline on discipline.id = item.disciplina
  where item.perfil is null or profile.id is null
    or item.disciplina is null or discipline.id is null
    or discipline.perfil <> item.perfil
    or item.email_user is null
    or item.tema is null or char_length(btrim(item.tema)) not between 1 and 180
    or item.data_hora is null
    or (item.feriado::integer + item.prova::integer + item.apresentacao::integer) > 1;
  if invalid_entries > 0 then
    raise exception 'Há % registro(s) de cronograma sem perfil, disciplina, tema ou tipo válido. Corrija-os antes de continuar.', invalid_entries;
  end if;
end;
$$;

alter table public.cronograma alter column id set not null;
alter table public.cronograma alter column email_user set not null;
alter table public.cronograma alter column perfil set not null;
alter table public.cronograma alter column disciplina set not null;
alter table public.cronograma alter column tema set not null;
alter table public.cronograma alter column feriado set not null;
alter table public.cronograma alter column prova set not null;
alter table public.cronograma alter column apresentacao set not null;
alter table public.cronograma alter column data_hora set not null;
alter table public.cronograma alter column created_at set not null;
alter table public.cronograma alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.cronograma'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.cronograma add constraint cronograma_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.cronograma'::regclass and conname = 'cronograma_perfil_fkey') then
    alter table public.cronograma add constraint cronograma_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.cronograma'::regclass and conname = 'cronograma_disciplina_fkey') then
    alter table public.cronograma add constraint cronograma_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.cronograma'::regclass and conname = 'cronograma_tema_check') then
    alter table public.cronograma add constraint cronograma_tema_check check (char_length(btrim(tema)) between 1 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.cronograma'::regclass and conname = 'cronograma_tipo_check') then
    alter table public.cronograma add constraint cronograma_tipo_check check ((feriado::integer + prova::integer + apresentacao::integer) <= 1);
  end if;
end;
$$;

create index if not exists cronograma_perfil_disciplina_data_idx on public.cronograma(perfil, disciplina, data_hora);
create index if not exists cronograma_disciplina_data_idx on public.cronograma(disciplina, data_hora);

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

drop trigger if exists cronograma_set_updated_at on public.cronograma;
create trigger cronograma_set_updated_at before update on public.cronograma
for each row execute procedure public.set_updated_at();

-- Impede duplicidade da mesma aula, inclusive se a requisicao nao vier pela interface.
create or replace function public.prevent_duplicate_chronogram_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.cronograma as existing_entry
    where existing_entry.perfil = new.perfil
      and existing_entry.disciplina = new.disciplina
      and existing_entry.data_hora = new.data_hora
      and existing_entry.id is distinct from new.id
  ) then
    raise exception using
      errcode = '23505',
      message = U&'J\00E1 existe um cronograma para esta aula.';
  end if;
  return new;
end;
$$;

drop trigger if exists cronograma_prevent_duplicate_entry on public.cronograma;
create trigger cronograma_prevent_duplicate_entry
before insert or update of perfil, disciplina, data_hora on public.cronograma
for each row execute procedure public.prevent_duplicate_chronogram_entry();

-- Mantém o e-mail auxiliar alinhado ao Auth, sem permitir que o cliente altere o dono.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
    update public.professores as professor set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where professor.perfil = profile.id and profile.user_id = new.id;
    update public.disciplinas as discipline set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where discipline.perfil = profile.id and profile.user_id = new.id;
    update public.horarios as schedule set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where schedule.perfil = profile.id and profile.user_id = new.id;
    update public.cronograma as item set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where item.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.cronograma enable row level security;
revoke all on table public.cronograma from anon, authenticated;
grant select, insert, update, delete on table public.cronograma to authenticated;

drop policy if exists "chronogram read own profile" on public.cronograma;
create policy "chronogram read own profile" on public.cronograma
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as discipline where discipline.id = cronograma.disciplina and discipline.perfil = cronograma.perfil)
);

drop policy if exists "chronogram create own profile" on public.cronograma;
create policy "chronogram create own profile" on public.cronograma
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = cronograma.disciplina and discipline.perfil = cronograma.perfil
      and discipline.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "chronogram update own profile" on public.cronograma;
create policy "chronogram update own profile" on public.cronograma
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = cronograma.disciplina and discipline.perfil = cronograma.perfil
      and discipline.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "chronogram delete own profile" on public.cronograma;
create policy "chronogram delete own profile" on public.cronograma
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
);
