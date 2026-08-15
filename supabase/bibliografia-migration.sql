-- AKADEMO: execute depois de lessons-migration.sql, exams-migration.sql e presentations-migration.sql.
-- Cria a biblioteca privada de bibliografias por perfil. Pode ser executado mais de uma vez.

create extension if not exists pgcrypto;

drop table if exists public.bibliografia cascade;

create table public.bibliografia (
  id bigint primary key generated always as identity,
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid references public.disciplinas(id) on delete cascade,
  aula uuid references public.aulas(id) on delete cascade,
  prova uuid references public.provas(id) on delete cascade,
  apresentacao uuid references public.apresentacoes(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 180),
  tipo text not null check (tipo in ('Livro', 'Artigo', 'Tese', 'Dissertação', 'Noticia', 'Relatorio', 'Lei/decreto', 'outros')),
  autor text not null check (char_length(btrim(autor)) between 1 and 120),
  descricao text check (descricao is null or char_length(descricao) <= 5000),
  link text,
  arquivo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(aula, prova, apresentacao) <= 1),
  check (disciplina is not null or (aula is null and prova is null and apresentacao is null))
);

create index if not exists bibliografia_perfil_created_idx on public.bibliografia(perfil, created_at desc);
create index if not exists bibliografia_perfil_disciplina_idx on public.bibliografia(perfil, disciplina);
create index if not exists bibliografia_aula_idx on public.bibliografia(aula) where aula is not null;
create index if not exists bibliografia_prova_idx on public.bibliografia(prova) where prova is not null;
create index if not exists bibliografia_apresentacao_idx on public.bibliografia(apresentacao) where apresentacao is not null;

create or replace function public.validate_bibliografia_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.arquivo and new.link not like 'bibliografia/%' then
    raise exception 'A private bibliography file must use a path inside bibliografia/.';
  end if;

  if not new.arquivo and new.link is not null and new.link != '' and new.link !~* '^https?://' then
    raise exception 'An external bibliography link must use an http or https link.';
  end if;

  if num_nonnulls(new.aula, new.prova, new.apresentacao) > 1 then
    raise exception 'A bibliography record can be linked to only one activity.';
  end if;

  if new.disciplina is null and (new.aula is not null or new.prova is not null or new.apresentacao is not null) then
    raise exception 'An activity link requires a discipline.';
  end if;

  if new.disciplina is not null and not exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = new.disciplina and discipline.perfil = new.perfil
      and discipline.email_user = new.email_user
  ) then
    raise exception 'The selected discipline does not belong to this profile.';
  end if;

  if new.aula is not null and not exists (
    select 1 from public.aulas as lesson
    where lesson.id = new.aula and lesson.perfil = new.perfil
      and lesson.disciplina = new.disciplina and lesson.email_user = new.email_user
  ) then
    raise exception 'The selected lesson does not belong to this discipline.';
  end if;

  if new.prova is not null and not exists (
    select 1 from public.provas as exam
    where exam.id = new.prova and exam.perfil = new.perfil
      and exam.disciplina = new.disciplina and exam.email_user = new.email_user
  ) then
    raise exception 'The selected exam does not belong to this discipline.';
  end if;

  if new.apresentacao is not null and not exists (
    select 1 from public.apresentacoes as presentation
    where presentation.id = new.apresentacao and presentation.perfil = new.perfil
      and presentation.disciplina = new.disciplina and presentation.email_user = new.email_user
  ) then
    raise exception 'The selected presentation does not belong to this discipline.';
  end if;

  return new;
end;
$$;

drop trigger if exists bibliografia_validate_links on public.bibliografia;
create trigger bibliografia_validate_links
before insert or update of email_user, perfil, disciplina, aula, prova, apresentacao, titulo, tipo, autor, descricao, link, arquivo
on public.bibliografia for each row execute procedure public.validate_bibliografia_links();

drop trigger if exists bibliografia_set_updated_at on public.bibliografia;
create trigger bibliografia_set_updated_at
before update on public.bibliografia for each row execute procedure public.set_updated_at();

alter table public.bibliografia enable row level security;
revoke all on table public.bibliografia from anon, authenticated;
grant select, insert, update, delete on table public.bibliografia to authenticated;

drop policy if exists "bibliografia read own profile" on public.bibliografia;
create policy "bibliografia read own profile" on public.bibliografia
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

drop policy if exists "bibliografia create own profile" on public.bibliografia;
create policy "bibliografia create own profile" on public.bibliografia
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

drop policy if exists "bibliografia update own profile" on public.bibliografia;
create policy "bibliografia update own profile" on public.bibliografia
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

drop policy if exists "bibliografia delete own profile" on public.bibliografia;
create policy "bibliografia delete own profile" on public.bibliografia
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

-- Configurações das políticas do Storage bucket para bibliografia
drop policy if exists "akademo bibliografia read own bucket" on storage.objects;
create policy "akademo bibliografia read own bucket" on storage.objects
for select to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'bibliografia/%'
);

drop policy if exists "akademo bibliografia upload own bucket" on storage.objects;
create policy "akademo bibliografia upload own bucket" on storage.objects
for insert to authenticated with check (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'bibliografia/%'
);

drop policy if exists "akademo bibliografia delete own bucket" on storage.objects;
create policy "akademo bibliografia delete own bucket" on storage.objects
for delete to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'bibliografia/%'
);

-- Mantém os registros de bibliografia corretos se o e-mail do Auth for alterado.
create or replace function public.sync_bibliografia_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.bibliografia as bib
    set email_user = new.email, updated_at = now()
    from public.perfil_estudo as profile
    where bib.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists bibliografia_sync_auth_email on auth.users;
create trigger bibliografia_sync_auth_email
after update of email on auth.users
for each row execute procedure public.sync_bibliografia_user_email();

notify pgrst, 'reload schema';
