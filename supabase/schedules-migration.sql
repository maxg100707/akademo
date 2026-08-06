-- AKADEMO: execute após teachers-migration.sql e disciplines-migration.sql.
-- Cria ou atualiza a tabela de horários, incluindo conversão segura de IDs legados.

create extension if not exists pgcrypto;

create table if not exists public.horarios (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_inicio timetz not null,
  hora_fim timetz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);

do $$
declare old_fk record;
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.horarios'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.horarios rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.horarios'::regclass and attname = 'perfil'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    for old_fk in
      select c.conname from pg_constraint as c
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.horarios'::regclass and c.contype = 'f' and a.attname = 'perfil'
    loop
      execute format('alter table public.horarios drop constraint if exists %I', old_fk.conname);
    end loop;
    alter table public.horarios rename column perfil to legacy_perfil;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.horarios'::regclass and attname = 'disciplina'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    for old_fk in
      select c.conname from pg_constraint as c
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.horarios'::regclass and c.contype = 'f' and a.attname = 'disciplina'
    loop
      execute format('alter table public.horarios drop constraint if exists %I', old_fk.conname);
    end loop;
    alter table public.horarios rename column disciplina to legacy_disciplina;
  end if;
end;
$$;

alter table public.horarios add column if not exists id uuid;
alter table public.horarios add column if not exists email_user text;
alter table public.horarios add column if not exists perfil uuid;
alter table public.horarios add column if not exists disciplina uuid;
alter table public.horarios add column if not exists dia_semana integer;
alter table public.horarios add column if not exists hora_inicio timetz;
alter table public.horarios add column if not exists hora_fim timetz;
alter table public.horarios add column if not exists created_at timestamptz default now();
alter table public.horarios add column if not exists updated_at timestamptz default now();

update public.horarios set id = gen_random_uuid() where id is null;
alter table public.horarios alter column id set default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.horarios'::regclass and attname = 'legacy_perfil' and not attisdropped
  ) and exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'legacy_id' and not attisdropped
  ) then
    execute $sql$
      update public.horarios as horario
      set perfil = profile.id,
          email_user = coalesce(horario.email_user, profile.email)
      from public.perfil_estudo as profile
      where horario.perfil is null and horario.legacy_perfil::text = profile.legacy_id::text
    $sql$;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.horarios'::regclass and attname = 'legacy_disciplina' and not attisdropped
  ) and exists (
    select 1 from pg_attribute
    where attrelid = 'public.disciplinas'::regclass and attname = 'legacy_id' and not attisdropped
  ) then
    execute $sql$
      update public.horarios as horario
      set disciplina = disciplina.id,
          perfil = coalesce(horario.perfil, disciplina.perfil),
          email_user = coalesce(horario.email_user, disciplina.email_user)
      from public.disciplinas as disciplina
      where horario.disciplina is null and horario.legacy_disciplina::text = disciplina.legacy_id::text
    $sql$;
  end if;
end;
$$;

update public.horarios as horario
set perfil = disciplina.perfil,
    email_user = coalesce(horario.email_user, disciplina.email_user)
from public.disciplinas as disciplina
where horario.perfil is null and horario.disciplina = disciplina.id;

update public.horarios as horario
set email_user = profile.email
from public.perfil_estudo as profile
where horario.email_user is null and horario.perfil = profile.id;

do $$
declare orphan_schedules integer;
begin
  select count(*) into orphan_schedules
  from public.horarios as horario
  left join public.perfil_estudo as profile on profile.id = horario.perfil
  left join public.disciplinas as disciplina on disciplina.id = horario.disciplina
  where horario.perfil is null or profile.id is null
    or horario.disciplina is null or disciplina.id is null
    or disciplina.perfil <> horario.perfil
    or horario.email_user is null
    or horario.dia_semana not between 0 and 6
    or horario.hora_inicio is null or horario.hora_fim is null or horario.hora_fim <= horario.hora_inicio;
  if orphan_schedules > 0 then
    raise exception 'Há % horário(s) legados sem perfil, disciplina ou intervalo válido. Corrija esses registros antes de continuar.', orphan_schedules;
  end if;
end;
$$;

alter table public.horarios alter column id set not null;
alter table public.horarios alter column email_user set not null;
alter table public.horarios alter column perfil set not null;
alter table public.horarios alter column disciplina set not null;
alter table public.horarios alter column dia_semana set not null;
alter table public.horarios alter column hora_inicio set not null;
alter table public.horarios alter column hora_fim set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.horarios'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.horarios add constraint horarios_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.horarios'::regclass and conname = 'horarios_perfil_fkey') then
    alter table public.horarios add constraint horarios_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.horarios'::regclass and conname = 'horarios_disciplina_fkey') then
    alter table public.horarios add constraint horarios_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.horarios'::regclass and conname = 'horarios_dia_semana_check') then
    alter table public.horarios add constraint horarios_dia_semana_check check (dia_semana between 0 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.horarios'::regclass and conname = 'horarios_hora_intervalo_check') then
    alter table public.horarios add constraint horarios_hora_intervalo_check check (hora_fim > hora_inicio);
  end if;
end;
$$;

create index if not exists horarios_perfil_dia_inicio_idx on public.horarios(perfil, dia_semana, hora_inicio);
create index if not exists horarios_disciplina_idx on public.horarios(disciplina);

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

drop trigger if exists horarios_set_updated_at on public.horarios;
create trigger horarios_set_updated_at before update on public.horarios
for each row execute procedure public.set_updated_at();

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
    update public.disciplinas as disciplina set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where disciplina.perfil = profile.id and profile.user_id = new.id;
    update public.horarios as horario set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where horario.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.horarios enable row level security;
revoke all on table public.horarios from anon, authenticated;
grant select, insert, update, delete on table public.horarios to authenticated;

drop policy if exists "schedules read own profile" on public.horarios;
create policy "schedules read own profile" on public.horarios
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as disciplina where disciplina.id = horarios.disciplina and disciplina.perfil = horarios.perfil)
);

drop policy if exists "schedules create own profile" on public.horarios;
create policy "schedules create own profile" on public.horarios
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.disciplinas as disciplina
    where disciplina.id = horarios.disciplina and disciplina.perfil = horarios.perfil
      and disciplina.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "schedules update own profile" on public.horarios;
create policy "schedules update own profile" on public.horarios
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.disciplinas as disciplina
    where disciplina.id = horarios.disciplina and disciplina.perfil = horarios.perfil
      and disciplina.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "schedules delete own profile" on public.horarios;
create policy "schedules delete own profile" on public.horarios
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
);
