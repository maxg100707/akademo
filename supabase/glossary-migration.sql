-- AKADEMO · Glossário
-- Execute depois das migrations de perfis, disciplinas, aulas, provas e apresentações.
-- É segura para uma tabela `glossario` criada manualmente com `id bigint`.

create extension if not exists pgcrypto;

create table if not exists public.glossario (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid references public.disciplinas(id) on delete cascade,
  aula uuid references public.aulas(id) on delete cascade,
  prova uuid references public.provas(id) on delete cascade,
  apresentacao uuid references public.apresentacoes(id) on delete cascade,
  termo text not null check (char_length(btrim(termo)) between 1 and 180),
  definicao text not null check (char_length(btrim(definicao)) between 1 and 5000),
  exemplo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(aula, prova, apresentacao) <= 1)
);

-- Mantém qualquer chave numérica antiga para não apagar dados e cria a chave UUID usada pelo app.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.glossario'::regclass
      and attname = 'id'
      and atttypid <> 'uuid'::regtype
      and not attisdropped
  ) and not exists (
    select 1 from pg_attribute
    where attrelid = 'public.glossario'::regclass
      and attname = 'legacy_id'
      and not attisdropped
  ) then
    alter table public.glossario rename column id to legacy_id;
  end if;
end;
$$;

alter table public.glossario add column if not exists id uuid;
alter table public.glossario add column if not exists email_user text;
alter table public.glossario add column if not exists perfil uuid;
alter table public.glossario add column if not exists disciplina uuid;
alter table public.glossario add column if not exists aula uuid;
alter table public.glossario add column if not exists prova uuid;
alter table public.glossario add column if not exists apresentacao uuid;
alter table public.glossario add column if not exists termo text;
alter table public.glossario add column if not exists definicao text;
alter table public.glossario add column if not exists exemplo text;
alter table public.glossario add column if not exists created_at timestamptz default now();
alter table public.glossario add column if not exists updated_at timestamptz default now();

update public.glossario set id = gen_random_uuid() where id is null;
update public.glossario as glossary
set email_user = profile.email
from public.perfil_estudo as profile
where glossary.email_user is null and glossary.perfil = profile.id;
update public.glossario set termo = 'Termo sem nome' where termo is null or btrim(termo) = '';
update public.glossario set definicao = 'Definicao nao informada.' where definicao is null or btrim(definicao) = '';
update public.glossario set created_at = now() where created_at is null;
update public.glossario set updated_at = now() where updated_at is null;

do $$
declare invalid_rows integer;
begin
  select count(*) into invalid_rows
  from public.glossario as glossary
  left join public.perfil_estudo as profile on profile.id = glossary.perfil
  left join public.disciplinas as discipline on discipline.id = glossary.disciplina
  left join public.aulas as lesson on lesson.id = glossary.aula
  left join public.provas as exam on exam.id = glossary.prova
  left join public.apresentacoes as presentation on presentation.id = glossary.apresentacao
  where glossary.id is null
     or glossary.email_user is null
     or glossary.perfil is null
     or profile.id is null
     or glossary.termo is null
     or char_length(btrim(glossary.termo)) not between 1 and 180
     or glossary.definicao is null
     or char_length(btrim(glossary.definicao)) not between 1 and 5000
     or num_nonnulls(glossary.aula, glossary.prova, glossary.apresentacao) > 1
     or (glossary.disciplina is not null and (discipline.id is null or discipline.perfil <> glossary.perfil))
     or (glossary.aula is not null and (lesson.id is null or lesson.perfil <> glossary.perfil or lesson.disciplina <> glossary.disciplina))
     or (glossary.prova is not null and (exam.id is null or exam.perfil <> glossary.perfil or exam.disciplina <> glossary.disciplina))
     or (glossary.apresentacao is not null and (presentation.id is null or presentation.perfil <> glossary.perfil or presentation.disciplina <> glossary.disciplina));

  if invalid_rows > 0 then
    raise exception 'There are % glossary rows with invalid ownership or links. Fix them before continuing.', invalid_rows;
  end if;
end;
$$;

alter table public.glossario alter column id set default gen_random_uuid();
alter table public.glossario alter column created_at set default now();
alter table public.glossario alter column updated_at set default now();
alter table public.glossario alter column id set not null;
alter table public.glossario alter column email_user set not null;
alter table public.glossario alter column perfil set not null;
alter table public.glossario alter column termo set not null;
alter table public.glossario alter column definicao set not null;
alter table public.glossario alter column created_at set not null;
alter table public.glossario alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes
    join pg_attribute attributes on attributes.attrelid = indexes.indrelid
      and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.glossario'::regclass
      and indexes.indisunique
      and attributes.attname = 'id'
  ) then
    alter table public.glossario add constraint glossario_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.glossario'::regclass and conname = 'glossario_perfil_fkey') then
    alter table public.glossario add constraint glossario_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.glossario'::regclass and conname = 'glossario_disciplina_fkey') then
    alter table public.glossario add constraint glossario_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.glossario'::regclass and conname = 'glossario_aula_fkey') then
    alter table public.glossario add constraint glossario_aula_fkey foreign key (aula) references public.aulas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.glossario'::regclass and conname = 'glossario_prova_fkey') then
    alter table public.glossario add constraint glossario_prova_fkey foreign key (prova) references public.provas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.glossario'::regclass and conname = 'glossario_apresentacao_fkey') then
    alter table public.glossario add constraint glossario_apresentacao_fkey foreign key (apresentacao) references public.apresentacoes(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.glossario'::regclass and conname = 'glossario_termo_check') then
    alter table public.glossario add constraint glossario_termo_check check (char_length(btrim(termo)) between 1 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.glossario'::regclass and conname = 'glossario_definicao_check') then
    alter table public.glossario add constraint glossario_definicao_check check (char_length(btrim(definicao)) between 1 and 5000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.glossario'::regclass and conname = 'glossario_one_activity_check') then
    alter table public.glossario add constraint glossario_one_activity_check check (num_nonnulls(aula, prova, apresentacao) <= 1);
  end if;
end;
$$;

create index if not exists glossario_perfil_termo_idx on public.glossario(perfil, termo);
create index if not exists glossario_perfil_disciplina_idx on public.glossario(perfil, disciplina);
create index if not exists glossario_aula_idx on public.glossario(aula) where aula is not null;
create index if not exists glossario_prova_idx on public.glossario(prova) where prova is not null;
create index if not exists glossario_apresentacao_idx on public.glossario(apresentacao) where apresentacao is not null;

create or replace function public.glossario_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_glossario_links()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner_email text;
begin
  select email into owner_email from public.perfil_estudo where id = new.perfil;
  if owner_email is null or owner_email <> new.email_user then
    raise exception 'Glossary profile must belong to the supplied email.';
  end if;

  if num_nonnulls(new.aula, new.prova, new.apresentacao) > 1 then
    raise exception 'A glossary term can be linked to only one activity.';
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

drop trigger if exists glossario_updated_at on public.glossario;
create trigger glossario_updated_at
before update on public.glossario
for each row execute function public.glossario_set_updated_at();

drop trigger if exists glossario_validate_links on public.glossario;
create trigger glossario_validate_links
before insert or update on public.glossario
for each row execute function public.validate_glossario_links();

alter table public.glossario enable row level security;

drop policy if exists "glossario_select_own" on public.glossario;
drop policy if exists "glossario_insert_own" on public.glossario;
drop policy if exists "glossario_update_own" on public.glossario;
drop policy if exists "glossario_delete_own" on public.glossario;

create policy "glossario_select_own" on public.glossario
for select to authenticated
using (email_user = (auth.jwt() ->> 'email'));

create policy "glossario_insert_own" on public.glossario
for insert to authenticated
with check (email_user = (auth.jwt() ->> 'email'));

create policy "glossario_update_own" on public.glossario
for update to authenticated
using (email_user = (auth.jwt() ->> 'email'))
with check (email_user = (auth.jwt() ->> 'email'));

create policy "glossario_delete_own" on public.glossario
for delete to authenticated
using (email_user = (auth.jwt() ->> 'email'));
