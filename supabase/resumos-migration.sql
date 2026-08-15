-- AKADEMO: execute depois de lessons-migration.sql, exams-migration.sql e presentations-migration.sql.
-- Cria a biblioteca privada de resumos por perfil. Pode ser executado mais de uma vez.

create extension if not exists pgcrypto;

drop table if exists public.resumos cascade;

create table public.resumos (
  id bigint primary key generated always as identity,
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid references public.disciplinas(id) on delete cascade,
  aula uuid references public.aulas(id) on delete cascade,
  prova uuid references public.provas(id) on delete cascade,
  apresentação uuid references public.apresentacoes(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 180),
  resumo jsonb not null default '{"version":1,"format":"akademo-document","metadata":{},"document":{"page_size":"a4","pages":[{"id":"page_initial","html":"<p><br></p>"}]}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(aula, prova, apresentação) <= 1),
  check (disciplina is not null or (aula is null and prova is null and apresentação is null))
);

create index if not exists resumos_perfil_updated_idx on public.resumos(perfil, updated_at desc);
create index if not exists resumos_perfil_disciplina_idx on public.resumos(perfil, disciplina);
create index if not exists resumos_aula_idx on public.resumos(aula) where aula is not null;
create index if not exists resumos_prova_idx on public.resumos(prova) where prova is not null;
create index if not exists resumos_apresentacao_idx on public.resumos(apresentação) where apresentação is not null;

create or replace function public.validate_summary_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(new.resumo) <> 'object'
    or jsonb_typeof(new.resumo -> 'document') <> 'object'
    or jsonb_typeof(new.resumo -> 'document' -> 'pages') <> 'array' then
    raise exception 'A summary must contain a structured document with pages.';
  end if;

  if jsonb_array_length(new.resumo -> 'document' -> 'pages') = 0 then
    raise exception 'A summary must contain at least one page.';
  end if;

  if num_nonnulls(new.aula, new.prova, new.apresentação) > 1 then
    raise exception 'A summary can be linked to only one activity.';
  end if;

  if new.disciplina is null and (new.aula is not null or new.prova is not null or new.apresentação is not null) then
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

  if new.apresentação is not null and not exists (
    select 1 from public.apresentacoes as presentation
    where presentation.id = new.apresentação
      and presentation.perfil = new.perfil
      and presentation.disciplina = new.disciplina
      and presentation.email_user = new.email_user
  ) then
    raise exception 'The selected presentation does not belong to this discipline.';
  end if;

  return new;
end;
$$;

drop trigger if exists resumos_validate_links on public.resumos;
create trigger resumos_validate_links
before insert or update of email_user, perfil, disciplina, aula, prova, apresentação, titulo, resumo
on public.resumos for each row execute procedure public.validate_summary_links();

drop trigger if exists resumos_set_updated_at on public.resumos;
create trigger resumos_set_updated_at
before update on public.resumos for each row execute procedure public.set_updated_at();

alter table public.resumos enable row level security;
revoke all on table public.resumos from anon, authenticated;
grant select, insert, update, delete on table public.resumos to authenticated;

drop policy if exists "summaries read own profile" on public.resumos;
create policy "summaries read own profile" on public.resumos
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

drop policy if exists "summaries create own profile" on public.resumos;
create policy "summaries create own profile" on public.resumos
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

drop policy if exists "summaries update own profile" on public.resumos;
create policy "summaries update own profile" on public.resumos
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

drop policy if exists "summaries delete own profile" on public.resumos;
create policy "summaries delete own profile" on public.resumos
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

notify pgrst, 'reload schema';
