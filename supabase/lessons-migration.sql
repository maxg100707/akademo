-- AKADEMO: execute apos chronogram-migration.sql.
-- Cria a base de aulas e conteudos privados, preservando tabelas legadas com id bigint.

create extension if not exists pgcrypto;

create table if not exists public.aulas (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  horario uuid not null references public.horarios(id) on delete cascade,
  cronograma uuid not null references public.cronograma(id) on delete cascade,
  tema text not null check (char_length(btrim(tema)) between 1 and 180),
  resumo text check (resumo is null or char_length(resumo) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cronograma)
);

create table if not exists public.conteudos (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  aula uuid not null references public.aulas(id) on delete cascade,
  path text not null check (path like 'conteudos/%'),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.aulas'::regclass and attname = 'id' and atttypid <> 'uuid'::regtype and not attisdropped) then
    alter table public.aulas rename column id to legacy_id;
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.conteudos'::regclass and attname = 'id' and atttypid <> 'uuid'::regtype and not attisdropped) then
    alter table public.conteudos rename column id to legacy_id;
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.conteudos'::regclass and attname = 'aula' and atttypid <> 'uuid'::regtype and not attisdropped) then
    alter table public.conteudos rename column aula to legacy_aula;
  end if;
end;
$$;

alter table public.aulas add column if not exists id uuid;
alter table public.aulas add column if not exists email_user text;
alter table public.aulas add column if not exists perfil uuid;
alter table public.aulas add column if not exists disciplina uuid;
alter table public.aulas add column if not exists horario uuid;
alter table public.aulas add column if not exists cronograma uuid;
alter table public.aulas add column if not exists tema text;
alter table public.aulas add column if not exists resumo text;
alter table public.aulas add column if not exists created_at timestamptz default now();
alter table public.aulas add column if not exists updated_at timestamptz default now();

alter table public.conteudos add column if not exists id uuid;
alter table public.conteudos add column if not exists email_user text;
alter table public.conteudos add column if not exists perfil uuid;
alter table public.conteudos add column if not exists aula uuid;
alter table public.conteudos add column if not exists path text;
alter table public.conteudos add column if not exists titulo text;
alter table public.conteudos add column if not exists created_at timestamptz default now();
alter table public.conteudos add column if not exists updated_at timestamptz default now();

update public.aulas set id = gen_random_uuid() where id is null;
update public.aulas set created_at = now() where created_at is null;
update public.aulas set updated_at = now() where updated_at is null;
update public.conteudos set id = gen_random_uuid() where id is null;
update public.conteudos set created_at = now() where created_at is null;
update public.conteudos set updated_at = now() where updated_at is null;

alter table public.aulas alter column id set default gen_random_uuid();
alter table public.aulas alter column created_at set default now();
alter table public.aulas alter column updated_at set default now();
alter table public.conteudos alter column id set default gen_random_uuid();
alter table public.conteudos alter column created_at set default now();
alter table public.conteudos alter column updated_at set default now();

do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.conteudos'::regclass and attname = 'legacy_aula' and not attisdropped)
    and exists (select 1 from pg_attribute where attrelid = 'public.aulas'::regclass and attname = 'legacy_id' and not attisdropped) then
    execute $sql$
      update public.conteudos as content
      set aula = lesson.id,
          perfil = coalesce(content.perfil, lesson.perfil),
          email_user = coalesce(content.email_user, lesson.email_user)
      from public.aulas as lesson
      where content.aula is null and content.legacy_aula::text = lesson.legacy_id::text
    $sql$;
  end if;
end;
$$;

update public.aulas as lesson
set perfil = schedule.perfil,
    disciplina = coalesce(lesson.disciplina, schedule.disciplina),
    email_user = coalesce(lesson.email_user, schedule.email_user)
from public.horarios as schedule
where lesson.perfil is null and lesson.horario = schedule.id;

update public.aulas as lesson
set perfil = chronogram.perfil,
    disciplina = coalesce(lesson.disciplina, chronogram.disciplina),
    tema = coalesce(nullif(btrim(lesson.tema), ''), chronogram.tema),
    email_user = coalesce(lesson.email_user, chronogram.email_user)
from public.cronograma as chronogram
where (lesson.perfil is null or lesson.disciplina is null or lesson.tema is null or btrim(lesson.tema) = '')
  and lesson.cronograma = chronogram.id;

update public.aulas as lesson
set email_user = profile.email
from public.perfil_estudo as profile
where lesson.email_user is null and lesson.perfil = profile.id;

update public.conteudos as content
set perfil = lesson.perfil,
    email_user = coalesce(content.email_user, lesson.email_user)
from public.aulas as lesson
where content.perfil is null and content.aula = lesson.id;

update public.conteudos as content
set email_user = profile.email
from public.perfil_estudo as profile
where content.email_user is null and content.perfil = profile.id;

do $$
declare invalid_lessons integer;
declare invalid_contents integer;
begin
  select count(*) into invalid_lessons
  from public.aulas as lesson
  left join public.perfil_estudo as profile on profile.id = lesson.perfil
  left join public.disciplinas as discipline on discipline.id = lesson.disciplina
  left join public.horarios as schedule on schedule.id = lesson.horario
  left join public.cronograma as chronogram on chronogram.id = lesson.cronograma
  where lesson.email_user is null or lesson.perfil is null or profile.id is null
    or lesson.disciplina is null or discipline.id is null or discipline.perfil <> lesson.perfil
    or lesson.horario is null or schedule.id is null or schedule.perfil <> lesson.perfil or schedule.disciplina <> lesson.disciplina
    or lesson.cronograma is null or chronogram.id is null or chronogram.perfil <> lesson.perfil or chronogram.disciplina <> lesson.disciplina
    or lesson.tema is null or char_length(btrim(lesson.tema)) not between 1 and 180;
  if invalid_lessons > 0 then
    raise exception U&'H\00E1 % aula(s) legada(s) sem rela\00E7\00F5es v\00E1lidas. Corrija-as antes de continuar.', invalid_lessons;
  end if;

  select count(*) into invalid_contents
  from public.conteudos as content
  left join public.aulas as lesson on lesson.id = content.aula
  where content.email_user is null or content.perfil is null or content.aula is null or lesson.id is null
    or lesson.perfil <> content.perfil or content.path is null or content.path not like 'conteudos/%'
    or content.titulo is null or char_length(btrim(content.titulo)) not between 1 and 160;
  if invalid_contents > 0 then
    raise exception U&'H\00E1 % conte\00FAdo(s) legado(s) sem aula, caminho ou t\00EDtulo v\00E1lido. Corrija-os antes de continuar.', invalid_contents;
  end if;
end;
$$;

alter table public.aulas alter column id set not null;
alter table public.aulas alter column email_user set not null;
alter table public.aulas alter column perfil set not null;
alter table public.aulas alter column disciplina set not null;
alter table public.aulas alter column horario set not null;
alter table public.aulas alter column cronograma set not null;
alter table public.aulas alter column tema set not null;
alter table public.aulas alter column created_at set not null;
alter table public.aulas alter column updated_at set not null;
alter table public.conteudos alter column id set not null;
alter table public.conteudos alter column email_user set not null;
alter table public.conteudos alter column perfil set not null;
alter table public.conteudos alter column aula set not null;
alter table public.conteudos alter column path set not null;
alter table public.conteudos alter column titulo set not null;
alter table public.conteudos alter column created_at set not null;
alter table public.conteudos alter column updated_at set not null;

do $$
begin
  if not exists (select 1 from pg_index indexes join pg_attribute attributes on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey) where indexes.indrelid = 'public.aulas'::regclass and indexes.indisunique and attributes.attname = 'id') then
    alter table public.aulas add constraint aulas_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.aulas'::regclass and conname = 'aulas_cronograma_key') then
    alter table public.aulas add constraint aulas_cronograma_key unique (cronograma);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.aulas'::regclass and conname = 'aulas_perfil_fkey') then
    alter table public.aulas add constraint aulas_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.aulas'::regclass and conname = 'aulas_disciplina_fkey') then
    alter table public.aulas add constraint aulas_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.aulas'::regclass and conname = 'aulas_horario_fkey') then
    alter table public.aulas add constraint aulas_horario_fkey foreign key (horario) references public.horarios(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.aulas'::regclass and conname = 'aulas_cronograma_fkey') then
    alter table public.aulas add constraint aulas_cronograma_fkey foreign key (cronograma) references public.cronograma(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.aulas'::regclass and conname = 'aulas_tema_check') then
    alter table public.aulas add constraint aulas_tema_check check (char_length(btrim(tema)) between 1 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.aulas'::regclass and conname = 'aulas_resumo_check') then
    alter table public.aulas add constraint aulas_resumo_check check (resumo is null or char_length(resumo) <= 5000);
  end if;

  if not exists (select 1 from pg_index indexes join pg_attribute attributes on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey) where indexes.indrelid = 'public.conteudos'::regclass and indexes.indisunique and attributes.attname = 'id') then
    alter table public.conteudos add constraint conteudos_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.conteudos'::regclass and conname = 'conteudos_perfil_fkey') then
    alter table public.conteudos add constraint conteudos_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.conteudos'::regclass and conname = 'conteudos_aula_fkey') then
    alter table public.conteudos add constraint conteudos_aula_fkey foreign key (aula) references public.aulas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.conteudos'::regclass and conname = 'conteudos_path_check') then
    alter table public.conteudos add constraint conteudos_path_check check (path like 'conteudos/%');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.conteudos'::regclass and conname = 'conteudos_titulo_check') then
    alter table public.conteudos add constraint conteudos_titulo_check check (char_length(btrim(titulo)) between 1 and 160);
  end if;
end;
$$;

alter table public.cronograma add column if not exists aula uuid;
update public.cronograma as chronogram
set aula = lesson.id
from public.aulas as lesson
where chronogram.aula is null and lesson.cronograma = chronogram.id;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.cronograma'::regclass and conname = 'cronograma_aula_fkey') then
    alter table public.cronograma add constraint cronograma_aula_fkey foreign key (aula) references public.aulas(id) on delete set null;
  end if;
end;
$$;

create index if not exists aulas_perfil_created_idx on public.aulas(perfil, created_at desc);
create index if not exists aulas_horario_idx on public.aulas(horario);
create index if not exists conteudos_aula_created_idx on public.conteudos(aula, created_at desc);

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

drop trigger if exists aulas_set_updated_at on public.aulas;
create trigger aulas_set_updated_at before update on public.aulas for each row execute procedure public.set_updated_at();
drop trigger if exists conteudos_set_updated_at on public.conteudos;
create trigger conteudos_set_updated_at before update on public.conteudos for each row execute procedure public.set_updated_at();

-- O campo aula do cronograma so pode apontar para uma aula do mesmo perfil e disciplina.
drop policy if exists "chronogram update own profile" on public.cronograma;
create policy "chronogram update own profile" on public.cronograma
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as discipline where discipline.id = cronograma.disciplina and discipline.perfil = cronograma.perfil and discipline.email_user = (select auth.jwt() ->> 'email'))
  and (cronograma.aula is null or exists (select 1 from public.aulas as lesson where lesson.id = cronograma.aula and lesson.perfil = cronograma.perfil and lesson.disciplina = cronograma.disciplina))
);

alter table public.aulas enable row level security;
alter table public.conteudos enable row level security;
revoke all on table public.aulas from anon, authenticated;
revoke all on table public.conteudos from anon, authenticated;
grant select, insert, delete on table public.aulas to authenticated;
grant update (resumo, updated_at) on table public.aulas to authenticated;
grant select, insert, delete on table public.conteudos to authenticated;

drop policy if exists "lessons read own profile" on public.aulas;
create policy "lessons read own profile" on public.aulas
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = aulas.perfil and profile.user_id = (select auth.uid()))
);
drop policy if exists "lessons create own profile" on public.aulas;
create policy "lessons create own profile" on public.aulas
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = aulas.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.horarios as schedule where schedule.id = aulas.horario and schedule.perfil = aulas.perfil and schedule.disciplina = aulas.disciplina)
  and exists (select 1 from public.cronograma as chronogram where chronogram.id = aulas.cronograma and chronogram.perfil = aulas.perfil and chronogram.disciplina = aulas.disciplina and chronogram.tema = aulas.tema and chronogram.aula is null and coalesce(chronogram.feriado, false) = false)
);
drop policy if exists "lessons update own profile" on public.aulas;
create policy "lessons update own profile" on public.aulas
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = aulas.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = aulas.perfil and profile.user_id = (select auth.uid()))
);
drop policy if exists "lessons delete own profile" on public.aulas;
create policy "lessons delete own profile" on public.aulas
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = aulas.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "contents read own lesson" on public.conteudos;
create policy "contents read own lesson" on public.conteudos
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.aulas as lesson join public.perfil_estudo as profile on profile.id = lesson.perfil where lesson.id = conteudos.aula and lesson.perfil = conteudos.perfil and profile.user_id = (select auth.uid()))
);
drop policy if exists "contents create own lesson" on public.conteudos;
create policy "contents create own lesson" on public.conteudos
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email') and path like 'conteudos/%'
  and exists (select 1 from public.aulas as lesson join public.perfil_estudo as profile on profile.id = lesson.perfil where lesson.id = conteudos.aula and lesson.perfil = conteudos.perfil and profile.user_id = (select auth.uid()) and lesson.email_user = (select auth.jwt() ->> 'email'))
);
drop policy if exists "contents delete own lesson" on public.conteudos;
create policy "contents delete own lesson" on public.conteudos
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.aulas as lesson join public.perfil_estudo as profile on profile.id = lesson.perfil where lesson.id = conteudos.aula and lesson.perfil = conteudos.perfil and profile.user_id = (select auth.uid()))
);

-- Arquivos sao privados e sempre ficam dentro do bucket do e-mail autenticado.
drop policy if exists "akademo content read own bucket" on storage.objects;
create policy "akademo content read own bucket" on storage.objects
for select to authenticated using (bucket_id = (select auth.jwt() ->> 'email') and name like 'conteudos/%');
drop policy if exists "akademo content upload own bucket" on storage.objects;
create policy "akademo content upload own bucket" on storage.objects
for insert to authenticated with check (bucket_id = (select auth.jwt() ->> 'email') and name like 'conteudos/%');
drop policy if exists "akademo content delete own bucket" on storage.objects;
create policy "akademo content delete own bucket" on storage.objects
for delete to authenticated using (bucket_id = (select auth.jwt() ->> 'email') and name like 'conteudos/%');

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
  end if;
  return new;
end;
$$;
