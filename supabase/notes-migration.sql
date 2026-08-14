-- AKADEMO: execute depois de lessons-migration.sql, exams-migration.sql e presentations-migration.sql.
-- Cria anotações privadas, com documento paginado em JSONB. Pode ser executado mais de uma vez.

create extension if not exists pgcrypto;

create table if not exists public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid references public.disciplinas(id) on delete cascade,
  aula uuid references public.aulas(id) on delete cascade,
  prova uuid references public.provas(id) on delete cascade,
  apresentacao uuid references public.apresentacoes(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 180),
  anotacao jsonb not null default '{"version":1,"format":"akademo-document","metadata":{},"document":{"page_size":"a4","pages":[{"id":"page_initial","html":"<p><br></p>"}]}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(aula, prova, apresentacao) <= 1)
);

-- Compatibilidade com tabelas criadas manualmente com uma chave numérica.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.anotacoes'::regclass
      and attname = 'id'
      and atttypid <> 'uuid'::regtype
      and not attisdropped
  ) and not exists (
    select 1 from pg_attribute
    where attrelid = 'public.anotacoes'::regclass
      and attname = 'legacy_id'
      and not attisdropped
  ) then
    alter table public.anotacoes rename column id to legacy_id;
  end if;
end;
$$;

alter table public.anotacoes add column if not exists id uuid;
alter table public.anotacoes add column if not exists email_user text;
alter table public.anotacoes add column if not exists perfil uuid;
alter table public.anotacoes add column if not exists disciplina uuid;
alter table public.anotacoes add column if not exists aula uuid;
alter table public.anotacoes add column if not exists prova uuid;
alter table public.anotacoes add column if not exists apresentacao uuid;
alter table public.anotacoes add column if not exists titulo text;
alter table public.anotacoes add column if not exists anotacao jsonb;
alter table public.anotacoes add column if not exists created_at timestamptz default now();
alter table public.anotacoes add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.anotacoes'::regclass
      and attname = 'anotacao'
      and atttypid = 'json'::regtype
      and not attisdropped
  ) then
    alter table public.anotacoes alter column anotacao drop default;
    alter table public.anotacoes alter column anotacao type jsonb using anotacao::jsonb;
  end if;
end;
$$;

update public.anotacoes set id = gen_random_uuid() where id is null;
update public.anotacoes as note
set email_user = profile.email
from public.perfil_estudo as profile
where note.email_user is null and note.perfil = profile.id;
update public.anotacoes set titulo = 'Anotacao sem titulo' where titulo is null or btrim(titulo) = '';
update public.anotacoes set created_at = now() where created_at is null;
update public.anotacoes set updated_at = now() where updated_at is null;

-- Normaliza anotações vazias ou antigas para o formato estruturado atual.
update public.anotacoes
set anotacao = jsonb_build_object(
  'version', 1,
  'format', 'akademo-document',
  'metadata', jsonb_build_object('title', titulo, 'created_at', created_at, 'updated_at', updated_at),
  'document', jsonb_build_object(
    'page_size', 'a4',
    'pages', jsonb_build_array(jsonb_build_object('id', 'page_initial', 'html', '<p><br></p>'))
  )
)
where anotacao is null
   or jsonb_typeof(anotacao) <> 'object'
   or jsonb_typeof(anotacao -> 'document') <> 'object'
   or jsonb_typeof(anotacao -> 'document' -> 'pages') <> 'array';

update public.anotacoes
set anotacao = jsonb_set(
  anotacao,
  '{document,pages}',
  jsonb_build_array(jsonb_build_object('id', 'page_initial', 'html', '<p><br></p>')),
  true
)
where jsonb_array_length(anotacao -> 'document' -> 'pages') = 0;

alter table public.anotacoes alter column id set default gen_random_uuid();
alter table public.anotacoes alter column anotacao set default '{"version":1,"format":"akademo-document","metadata":{},"document":{"page_size":"a4","pages":[{"id":"page_initial","html":"<p><br></p>"}]}}'::jsonb;
alter table public.anotacoes alter column created_at set default now();
alter table public.anotacoes alter column updated_at set default now();

do $$
declare invalid_notes integer;
begin
  select count(*) into invalid_notes
  from public.anotacoes as note
  left join public.perfil_estudo as profile on profile.id = note.perfil
  left join public.disciplinas as discipline on discipline.id = note.disciplina
  left join public.aulas as lesson on lesson.id = note.aula
  left join public.provas as exam on exam.id = note.prova
  left join public.apresentacoes as presentation on presentation.id = note.apresentacao
  where note.email_user is null
     or note.perfil is null
     or profile.id is null
     or note.titulo is null
     or char_length(btrim(note.titulo)) not between 1 and 180
     or jsonb_typeof(note.anotacao) <> 'object'
     or jsonb_typeof(note.anotacao -> 'document') <> 'object'
     or jsonb_typeof(note.anotacao -> 'document' -> 'pages') <> 'array'
     or num_nonnulls(note.aula, note.prova, note.apresentacao) > 1
     or (note.disciplina is not null and (discipline.id is null or discipline.perfil <> note.perfil))
     or (note.aula is not null and (lesson.id is null or lesson.perfil <> note.perfil or lesson.disciplina <> note.disciplina))
     or (note.prova is not null and (exam.id is null or exam.perfil <> note.perfil or exam.disciplina <> note.disciplina))
     or (note.apresentacao is not null and (presentation.id is null or presentation.perfil <> note.perfil or presentation.disciplina <> note.disciplina));

  if invalid_notes > 0 then
    raise exception 'There are % notes with invalid ownership or links. Fix them before continuing.', invalid_notes;
  end if;
end;
$$;

alter table public.anotacoes alter column id set not null;
alter table public.anotacoes alter column email_user set not null;
alter table public.anotacoes alter column perfil set not null;
alter table public.anotacoes alter column titulo set not null;
alter table public.anotacoes alter column anotacao set not null;
alter table public.anotacoes alter column created_at set not null;
alter table public.anotacoes alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes
    join pg_attribute attributes on attributes.attrelid = indexes.indrelid
      and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.anotacoes'::regclass
      and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.anotacoes add constraint anotacoes_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.anotacoes'::regclass and conname = 'anotacoes_perfil_fkey') then
    alter table public.anotacoes add constraint anotacoes_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.anotacoes'::regclass and conname = 'anotacoes_disciplina_fkey') then
    alter table public.anotacoes add constraint anotacoes_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.anotacoes'::regclass and conname = 'anotacoes_aula_fkey') then
    alter table public.anotacoes add constraint anotacoes_aula_fkey foreign key (aula) references public.aulas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.anotacoes'::regclass and conname = 'anotacoes_prova_fkey') then
    alter table public.anotacoes add constraint anotacoes_prova_fkey foreign key (prova) references public.provas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.anotacoes'::regclass and conname = 'anotacoes_apresentacao_fkey') then
    alter table public.anotacoes add constraint anotacoes_apresentacao_fkey foreign key (apresentacao) references public.apresentacoes(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.anotacoes'::regclass and conname = 'anotacoes_titulo_check') then
    alter table public.anotacoes add constraint anotacoes_titulo_check check (char_length(btrim(titulo)) between 1 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.anotacoes'::regclass and conname = 'anotacoes_one_activity_check') then
    alter table public.anotacoes add constraint anotacoes_one_activity_check check (num_nonnulls(aula, prova, apresentacao) <= 1);
  end if;
end;
$$;

create index if not exists anotacoes_perfil_updated_idx on public.anotacoes(perfil, updated_at desc);
create index if not exists anotacoes_perfil_disciplina_idx on public.anotacoes(perfil, disciplina);
create index if not exists anotacoes_aula_idx on public.anotacoes(aula) where aula is not null;
create index if not exists anotacoes_prova_idx on public.anotacoes(prova) where prova is not null;
create index if not exists anotacoes_apresentacao_idx on public.anotacoes(apresentacao) where apresentacao is not null;

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

create or replace function public.validate_note_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(new.anotacao) <> 'object'
    or jsonb_typeof(new.anotacao -> 'document') <> 'object'
    or jsonb_typeof(new.anotacao -> 'document' -> 'pages') <> 'array' then
    raise exception 'A note must contain a structured document with pages.';
  end if;

  if jsonb_array_length(new.anotacao -> 'document' -> 'pages') = 0 then
    raise exception 'A note must contain at least one page.';
  end if;

  if num_nonnulls(new.aula, new.prova, new.apresentacao) > 1 then
    raise exception 'A note can be linked to only one activity.';
  end if;

  if new.disciplina is null and (new.aula is not null or new.prova is not null or new.apresentacao is not null) then
    raise exception 'An activity link requires a discipline.';
  end if;

  if new.disciplina is not null and not exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = new.disciplina
      and discipline.perfil = new.perfil
      and discipline.email_user = new.email_user
  ) then
    raise exception 'The selected discipline does not belong to this profile.';
  end if;

  if new.aula is not null and not exists (
    select 1 from public.aulas as lesson
    where lesson.id = new.aula
      and lesson.perfil = new.perfil
      and lesson.disciplina = new.disciplina
      and lesson.email_user = new.email_user
  ) then
    raise exception 'The selected lesson does not belong to this discipline.';
  end if;

  if new.prova is not null and not exists (
    select 1 from public.provas as exam
    where exam.id = new.prova
      and exam.perfil = new.perfil
      and exam.disciplina = new.disciplina
      and exam.email_user = new.email_user
  ) then
    raise exception 'The selected exam does not belong to this discipline.';
  end if;

  if new.apresentacao is not null and not exists (
    select 1 from public.apresentacoes as presentation
    where presentation.id = new.apresentacao
      and presentation.perfil = new.perfil
      and presentation.disciplina = new.disciplina
      and presentation.email_user = new.email_user
  ) then
    raise exception 'The selected presentation does not belong to this discipline.';
  end if;

  return new;
end;
$$;

drop trigger if exists anotacoes_validate_links on public.anotacoes;
create trigger anotacoes_validate_links
before insert or update of email_user, perfil, disciplina, aula, prova, apresentacao, titulo, anotacao
on public.anotacoes for each row execute procedure public.validate_note_links();

drop trigger if exists anotacoes_set_updated_at on public.anotacoes;
create trigger anotacoes_set_updated_at
before update on public.anotacoes for each row execute procedure public.set_updated_at();

alter table public.anotacoes enable row level security;
revoke all on table public.anotacoes from anon, authenticated;
grant select, insert, update, delete on table public.anotacoes to authenticated;

drop policy if exists "notes read own profile" on public.anotacoes;
drop policy if exists "notes create own profile" on public.anotacoes;
drop policy if exists "notes update own profile" on public.anotacoes;
drop policy if exists "notes delete own profile" on public.anotacoes;

create policy "notes read own profile" on public.anotacoes
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

create policy "notes create own profile" on public.anotacoes
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

create policy "notes update own profile" on public.anotacoes
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
)
with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

create policy "notes delete own profile" on public.anotacoes
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

notify pgrst, 'reload schema';
