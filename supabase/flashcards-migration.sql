-- AKADEMO - Flashcards
-- Run after the migrations for study profiles, disciplines, lessons, exams and presentations.
-- This migration preserves an old numeric id as legacy_id and creates the UUID id used by the app.

create extension if not exists pgcrypto;

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid references public.disciplinas(id) on delete cascade,
  aula uuid references public.aulas(id) on delete cascade,
  prova uuid references public.provas(id) on delete cascade,
  apresentacao uuid references public.apresentacoes(id) on delete cascade,
  tema_colecao text not null,
  cards jsonb not null default '[]'::jsonb,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(aula, prova, apresentacao) <= 1)
);

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.flashcards'::regclass
      and attname = 'id'
      and atttypid <> 'uuid'::regtype
      and not attisdropped
  ) and not exists (
    select 1 from pg_attribute
    where attrelid = 'public.flashcards'::regclass
      and attname = 'legacy_id'
      and not attisdropped
  ) then
    alter table public.flashcards rename column id to legacy_id;
  end if;

  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.flashcards'::regclass
      and attname = 'cards'
      and atttypid = 'json'::regtype
      and not attisdropped
  ) then
    alter table public.flashcards alter column cards drop default;
    alter table public.flashcards alter column cards type jsonb using cards::jsonb;
  end if;
end;
$$;

alter table public.flashcards add column if not exists id uuid;
alter table public.flashcards add column if not exists email_user text;
alter table public.flashcards add column if not exists perfil uuid;
alter table public.flashcards add column if not exists disciplina uuid;
alter table public.flashcards add column if not exists aula uuid;
alter table public.flashcards add column if not exists prova uuid;
alter table public.flashcards add column if not exists apresentacao uuid;
alter table public.flashcards add column if not exists tema_colecao text;
alter table public.flashcards add column if not exists cards jsonb;
alter table public.flashcards add column if not exists descricao text;
alter table public.flashcards add column if not exists created_at timestamptz default now();
alter table public.flashcards add column if not exists updated_at timestamptz default now();

update public.flashcards set id = gen_random_uuid() where id is null;
update public.flashcards as flashcard
set email_user = profile.email
from public.perfil_estudo as profile
where flashcard.email_user is null and flashcard.perfil = profile.id;
update public.flashcards set tema_colecao = 'Untitled flashcard collection' where tema_colecao is null or btrim(tema_colecao) = '';
update public.flashcards set cards = '[]'::jsonb where cards is null;
update public.flashcards set created_at = now() where created_at is null;
update public.flashcards set updated_at = now() where updated_at is null;

do $$
declare invalid_rows integer;
begin
  select count(*) into invalid_rows
  from public.flashcards as flashcard
  left join public.perfil_estudo as profile on profile.id = flashcard.perfil
  left join public.disciplinas as discipline on discipline.id = flashcard.disciplina
  left join public.aulas as lesson on lesson.id = flashcard.aula
  left join public.provas as exam on exam.id = flashcard.prova
  left join public.apresentacoes as presentation on presentation.id = flashcard.apresentacao
  where flashcard.id is null
     or flashcard.email_user is null
     or flashcard.perfil is null
     or profile.id is null
     or flashcard.tema_colecao is null
     or char_length(btrim(flashcard.tema_colecao)) not between 1 and 180
     or jsonb_typeof(flashcard.cards) <> 'array'
     or jsonb_array_length(flashcard.cards) < 1
     or num_nonnulls(flashcard.aula, flashcard.prova, flashcard.apresentacao) > 1
     or (flashcard.disciplina is not null and (discipline.id is null or discipline.perfil <> flashcard.perfil))
     or (flashcard.aula is not null and (lesson.id is null or lesson.perfil <> flashcard.perfil or lesson.disciplina <> flashcard.disciplina))
     or (flashcard.prova is not null and (exam.id is null or exam.perfil <> flashcard.perfil or exam.disciplina <> flashcard.disciplina))
     or (flashcard.apresentacao is not null and (presentation.id is null or presentation.perfil <> flashcard.perfil or presentation.disciplina <> flashcard.disciplina));

  if invalid_rows > 0 then
    raise exception 'There are % flashcard rows with invalid ownership, links or cards. Fix them before continuing.', invalid_rows;
  end if;
end;
$$;

alter table public.flashcards alter column id set default gen_random_uuid();
alter table public.flashcards alter column cards set default '[]'::jsonb;
alter table public.flashcards alter column created_at set default now();
alter table public.flashcards alter column updated_at set default now();
alter table public.flashcards alter column id set not null;
alter table public.flashcards alter column email_user set not null;
alter table public.flashcards alter column perfil set not null;
alter table public.flashcards alter column tema_colecao set not null;
alter table public.flashcards alter column cards set not null;
alter table public.flashcards alter column created_at set not null;
alter table public.flashcards alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes
    join pg_attribute attributes on attributes.attrelid = indexes.indrelid
      and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.flashcards'::regclass
      and indexes.indisunique
      and attributes.attname = 'id'
  ) then
    alter table public.flashcards add constraint flashcards_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.flashcards'::regclass and conname = 'flashcards_perfil_fkey') then
    alter table public.flashcards add constraint flashcards_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.flashcards'::regclass and conname = 'flashcards_disciplina_fkey') then
    alter table public.flashcards add constraint flashcards_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.flashcards'::regclass and conname = 'flashcards_aula_fkey') then
    alter table public.flashcards add constraint flashcards_aula_fkey foreign key (aula) references public.aulas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.flashcards'::regclass and conname = 'flashcards_prova_fkey') then
    alter table public.flashcards add constraint flashcards_prova_fkey foreign key (prova) references public.provas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.flashcards'::regclass and conname = 'flashcards_apresentacao_fkey') then
    alter table public.flashcards add constraint flashcards_apresentacao_fkey foreign key (apresentacao) references public.apresentacoes(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.flashcards'::regclass and conname = 'flashcards_theme_check') then
    alter table public.flashcards add constraint flashcards_theme_check check (char_length(btrim(tema_colecao)) between 1 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.flashcards'::regclass and conname = 'flashcards_one_activity_check') then
    alter table public.flashcards add constraint flashcards_one_activity_check check (num_nonnulls(aula, prova, apresentacao) <= 1);
  end if;
end;
$$;

create index if not exists flashcards_perfil_updated_idx on public.flashcards(perfil, updated_at desc);
create index if not exists flashcards_perfil_disciplina_idx on public.flashcards(perfil, disciplina);
create index if not exists flashcards_aula_idx on public.flashcards(aula) where aula is not null;
create index if not exists flashcards_prova_idx on public.flashcards(prova) where prova is not null;
create index if not exists flashcards_apresentacao_idx on public.flashcards(apresentacao) where apresentacao is not null;

create or replace function public.flashcards_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_flashcards_links()
returns trigger
language plpgsql
set search_path = public
as $$
declare owner_email text;
begin
  select email into owner_email from public.perfil_estudo where id = new.perfil;
  if owner_email is null or owner_email <> new.email_user then
    raise exception 'Flashcard profile must belong to the supplied email.';
  end if;
  if char_length(btrim(new.tema_colecao)) not between 1 and 180 then
    raise exception 'Flashcard collection theme must contain from 1 to 180 characters.';
  end if;
  if jsonb_typeof(new.cards) <> 'array' or jsonb_array_length(new.cards) < 1 then
    raise exception 'A flashcard collection must have at least one card.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(new.cards) as card(value)
    where jsonb_typeof(card.value) <> 'object'
      or jsonb_typeof(card.value -> 'front') <> 'string'
      or jsonb_typeof(card.value -> 'back') <> 'string'
      or char_length(btrim(card.value ->> 'front')) not between 1 and 6000
      or char_length(btrim(card.value ->> 'back')) not between 1 and 6000
  ) then
    raise exception 'Every flashcard must include non-empty front and back text.';
  end if;
  if num_nonnulls(new.aula, new.prova, new.apresentacao) > 1 then
    raise exception 'A flashcard collection can be linked to only one activity.';
  end if;
  if new.disciplina is null and (new.aula is not null or new.prova is not null or new.apresentacao is not null) then
    raise exception 'An activity link requires a discipline.';
  end if;
  if new.disciplina is not null and not exists (
    select 1 from public.disciplinas where id = new.disciplina and perfil = new.perfil and email_user = new.email_user
  ) then
    raise exception 'Discipline does not belong to this profile.';
  end if;
  if new.aula is not null and not exists (
    select 1 from public.aulas where id = new.aula and perfil = new.perfil and disciplina = new.disciplina and email_user = new.email_user
  ) then
    raise exception 'Lesson does not belong to this profile and discipline.';
  end if;
  if new.prova is not null and not exists (
    select 1 from public.provas where id = new.prova and perfil = new.perfil and disciplina = new.disciplina and email_user = new.email_user
  ) then
    raise exception 'Exam does not belong to this profile and discipline.';
  end if;
  if new.apresentacao is not null and not exists (
    select 1 from public.apresentacoes where id = new.apresentacao and perfil = new.perfil and disciplina = new.disciplina and email_user = new.email_user
  ) then
    raise exception 'Presentation does not belong to this profile and discipline.';
  end if;
  return new;
end;
$$;

drop trigger if exists flashcards_updated_at on public.flashcards;
create trigger flashcards_updated_at
before update on public.flashcards
for each row execute function public.flashcards_set_updated_at();

drop trigger if exists flashcards_validate_links on public.flashcards;
create trigger flashcards_validate_links
before insert or update on public.flashcards
for each row execute function public.validate_flashcards_links();

alter table public.flashcards enable row level security;
grant select, insert, update, delete on public.flashcards to authenticated;

drop policy if exists "flashcards_select_own" on public.flashcards;
drop policy if exists "flashcards_insert_own" on public.flashcards;
drop policy if exists "flashcards_update_own" on public.flashcards;
drop policy if exists "flashcards_delete_own" on public.flashcards;

create policy "flashcards_select_own" on public.flashcards
for select to authenticated
using (email_user = (auth.jwt() ->> 'email'));

create policy "flashcards_insert_own" on public.flashcards
for insert to authenticated
with check (email_user = (auth.jwt() ->> 'email'));

create policy "flashcards_update_own" on public.flashcards
for update to authenticated
using (email_user = (auth.jwt() ->> 'email'))
with check (email_user = (auth.jwt() ->> 'email'));

create policy "flashcards_delete_own" on public.flashcards
for delete to authenticated
using (email_user = (auth.jwt() ->> 'email'));
