-- AKADEMO - Quizzes públicos e resultados individuais.
-- Execute depois da migração de perfis. A migração preserva ids numéricos legados como legacy_id.

create extension if not exists pgcrypto;

create table if not exists public.quizes (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  publico boolean not null default true,
  revelar_nome boolean not null default false,
  nome_autor text not null default 'Estudante AKADEMO',
  tema text not null,
  descricao text,
  perguntas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resultados_quiz (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  quiz uuid not null references public.quizes(id) on delete cascade,
  resultado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_user, quiz)
);

do $$
declare table_name text;
begin
  foreach table_name in array array['quizes', 'resultados_quiz'] loop
    if exists (select 1 from pg_attribute where attrelid = ('public.' || table_name)::regclass and attname = 'id' and atttypid <> 'uuid'::regtype and not attisdropped)
      and not exists (select 1 from pg_attribute where attrelid = ('public.' || table_name)::regclass and attname = 'legacy_id' and not attisdropped) then
      execute format('alter table public.%I rename column id to legacy_id', table_name);
    end if;
  end loop;
end;
$$;

do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.quizes'::regclass and attname = 'perguntas' and atttypid = 'json'::regtype and not attisdropped) then
    alter table public.quizes alter column perguntas drop default;
    alter table public.quizes alter column perguntas type jsonb using perguntas::jsonb;
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.resultados_quiz'::regclass and attname = 'resultado' and atttypid = 'json'::regtype and not attisdropped) then
    alter table public.resultados_quiz alter column resultado drop default;
    alter table public.resultados_quiz alter column resultado type jsonb using resultado::jsonb;
  end if;
end;
$$;

alter table public.quizes add column if not exists id uuid;
alter table public.quizes add column if not exists email_user text;
alter table public.quizes add column if not exists publico boolean default true;
alter table public.quizes add column if not exists revelar_nome boolean default false;
alter table public.quizes add column if not exists nome_autor text default 'Estudante AKADEMO';
alter table public.quizes add column if not exists tema text;
alter table public.quizes add column if not exists descricao text;
alter table public.quizes add column if not exists perguntas jsonb;
alter table public.quizes add column if not exists created_at timestamptz default now();
alter table public.quizes add column if not exists updated_at timestamptz default now();
alter table public.resultados_quiz add column if not exists id uuid;
alter table public.resultados_quiz add column if not exists email_user text;
alter table public.resultados_quiz add column if not exists quiz uuid;
alter table public.resultados_quiz add column if not exists resultado jsonb;
alter table public.resultados_quiz add column if not exists created_at timestamptz default now();
alter table public.resultados_quiz add column if not exists updated_at timestamptz default now();

update public.quizes set id = gen_random_uuid() where id is null;
update public.quizes set publico = true where publico is null;
update public.quizes set revelar_nome = false where revelar_nome is null;
update public.quizes set nome_autor = 'Estudante AKADEMO' where nome_autor is null or btrim(nome_autor) = '';
update public.quizes set descricao = 'Sem descrição' where descricao is null or btrim(descricao) = '';
update public.quizes set perguntas = '[]'::jsonb where perguntas is null;
update public.quizes set created_at = now() where created_at is null;
update public.quizes set updated_at = now() where updated_at is null;
update public.resultados_quiz set id = gen_random_uuid() where id is null;
update public.resultados_quiz set resultado = '{}'::jsonb where resultado is null;
update public.resultados_quiz set created_at = now() where created_at is null;
update public.resultados_quiz set updated_at = now() where updated_at is null;

do $$
declare invalid_quizzes integer; invalid_results integer;
begin
  select count(*) into invalid_quizzes from public.quizes
  where id is null or email_user is null or tema is null or char_length(btrim(tema)) not between 1 and 180
    or descricao is null or char_length(btrim(descricao)) not between 1 and 3000
    or jsonb_typeof(perguntas) <> 'array';
  if invalid_quizzes > 0 then raise exception 'There are % invalid quiz rows. Fix them before continuing.', invalid_quizzes; end if;
  select count(*) into invalid_results from public.resultados_quiz result
  left join public.quizes quiz on quiz.id = result.quiz
  where result.id is null or result.email_user is null or result.quiz is null or quiz.id is null or jsonb_typeof(result.resultado) <> 'object';
  if invalid_results > 0 then raise exception 'There are % invalid quiz-result rows. Fix them before continuing.', invalid_results; end if;
end;
$$;

alter table public.quizes alter column id set default gen_random_uuid();
alter table public.quizes alter column publico set default true;
alter table public.quizes alter column revelar_nome set default false;
alter table public.quizes alter column nome_autor set default 'Estudante AKADEMO';
alter table public.quizes alter column perguntas set default '[]'::jsonb;
alter table public.quizes alter column created_at set default now();
alter table public.quizes alter column updated_at set default now();
alter table public.quizes alter column id set not null;
alter table public.quizes alter column email_user set not null;
alter table public.quizes alter column publico set not null;
alter table public.quizes alter column revelar_nome set not null;
alter table public.quizes alter column nome_autor set not null;
alter table public.quizes alter column tema set not null;
alter table public.quizes alter column descricao set not null;
alter table public.quizes alter column perguntas set not null;
alter table public.quizes alter column created_at set not null;
alter table public.quizes alter column updated_at set not null;
alter table public.resultados_quiz alter column id set default gen_random_uuid();
alter table public.resultados_quiz alter column resultado set default '{}'::jsonb;
alter table public.resultados_quiz alter column created_at set default now();
alter table public.resultados_quiz alter column updated_at set default now();
alter table public.resultados_quiz alter column id set not null;
alter table public.resultados_quiz alter column email_user set not null;
alter table public.resultados_quiz alter column quiz set not null;
alter table public.resultados_quiz alter column resultado set not null;
alter table public.resultados_quiz alter column created_at set not null;
alter table public.resultados_quiz alter column updated_at set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.quizes'::regclass and conname = 'quizes_id_key') then alter table public.quizes add constraint quizes_id_key unique(id); end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.quizes'::regclass and conname = 'quizes_theme_check') then alter table public.quizes add constraint quizes_theme_check check(char_length(btrim(tema)) between 1 and 180); end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.resultados_quiz'::regclass and conname = 'resultados_quiz_id_key') then alter table public.resultados_quiz add constraint resultados_quiz_id_key unique(id); end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.resultados_quiz'::regclass and conname = 'resultados_quiz_email_quiz_key') then alter table public.resultados_quiz add constraint resultados_quiz_email_quiz_key unique(email_user, quiz); end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.resultados_quiz'::regclass and conname = 'resultados_quiz_quiz_fkey') then alter table public.resultados_quiz add constraint resultados_quiz_quiz_fkey foreign key(quiz) references public.quizes(id) on delete cascade; end if;
end;
$$;

create index if not exists quizes_public_updated_idx on public.quizes(publico, updated_at desc);
create index if not exists quizes_author_updated_idx on public.quizes(email_user, updated_at desc);
create index if not exists resultados_quiz_user_updated_idx on public.resultados_quiz(email_user, updated_at desc);

create or replace function public.quizzes_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.validate_quiz_payload()
returns trigger language plpgsql set search_path = public as $$
begin
  if char_length(btrim(new.tema)) not between 1 and 180 then raise exception 'Quiz theme must contain from 1 to 180 characters.'; end if;
  if char_length(btrim(new.descricao)) not between 1 and 3000 then raise exception 'Quiz description must contain from 1 to 3000 characters.'; end if;
  if jsonb_typeof(new.perguntas) <> 'array' or jsonb_array_length(new.perguntas) < 1 then raise exception 'A quiz needs at least one question.'; end if;
  if exists (select 1 from jsonb_array_elements(new.perguntas) question(value)
    where jsonb_typeof(question.value) <> 'object'
      or jsonb_typeof(question.value -> 'alternatives') <> 'array'
      or jsonb_array_length(question.value -> 'alternatives') not between 4 and 6
      or coalesce(nullif(btrim(question.value ->> 'statement'), ''), '') = ''
      or not exists (select 1 from jsonb_array_elements(question.value -> 'alternatives') alternative(value) where alternative.value ->> 'id' = question.value ->> 'correctId')) then
    raise exception 'Each quiz question needs a statement, four to six alternatives and one correct alternative.';
  end if;
  if not new.publico then new.revelar_nome = false; end if;
  return new;
end;
$$;

create or replace function public.validate_quiz_result()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.quizes where id = new.quiz and (publico = true or email_user = new.email_user)) then raise exception 'Quiz is not available to this user.'; end if;
  if jsonb_typeof(new.resultado) <> 'object' then raise exception 'Quiz result must be a JSON object.'; end if;
  return new;
end;
$$;

create or replace function public.quizzes_remove_unavailable_results()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.resultados_quiz where quiz = old.id;
    return old;
  end if;

  if old.publico = true and new.publico = false then
    delete from public.resultados_quiz
    where quiz = new.id
      and email_user <> new.email_user;
  end if;
  return new;
end;
$$;

drop trigger if exists quizes_updated_at on public.quizes;
create trigger quizes_updated_at before update on public.quizes for each row execute function public.quizzes_set_updated_at();
drop trigger if exists quizes_validate_payload on public.quizes;
create trigger quizes_validate_payload before insert or update on public.quizes for each row execute function public.validate_quiz_payload();
drop trigger if exists quizes_remove_unavailable_results on public.quizes;
create trigger quizes_remove_unavailable_results before update of publico or delete on public.quizes for each row execute function public.quizzes_remove_unavailable_results();
drop trigger if exists resultados_quiz_updated_at on public.resultados_quiz;
create trigger resultados_quiz_updated_at before update on public.resultados_quiz for each row execute function public.quizzes_set_updated_at();
drop trigger if exists resultados_quiz_validate_payload on public.resultados_quiz;
create trigger resultados_quiz_validate_payload before insert or update on public.resultados_quiz for each row execute function public.validate_quiz_result();

alter table public.quizes enable row level security;
alter table public.resultados_quiz enable row level security;
grant select, insert, update, delete on public.quizes, public.resultados_quiz to authenticated;

drop policy if exists "quizes_select_public_or_own" on public.quizes;
drop policy if exists "quizes_insert_own" on public.quizes;
drop policy if exists "quizes_update_own" on public.quizes;
drop policy if exists "quizes_delete_own" on public.quizes;
create policy "quizes_select_public_or_own" on public.quizes for select to authenticated using (publico = true or email_user = (auth.jwt() ->> 'email'));
create policy "quizes_insert_own" on public.quizes for insert to authenticated with check (email_user = (auth.jwt() ->> 'email'));
create policy "quizes_update_own" on public.quizes for update to authenticated using (email_user = (auth.jwt() ->> 'email')) with check (email_user = (auth.jwt() ->> 'email'));
create policy "quizes_delete_own" on public.quizes for delete to authenticated using (email_user = (auth.jwt() ->> 'email'));

drop policy if exists "resultados_quiz_select_own" on public.resultados_quiz;
drop policy if exists "resultados_quiz_insert_own" on public.resultados_quiz;
drop policy if exists "resultados_quiz_update_own" on public.resultados_quiz;
drop policy if exists "resultados_quiz_delete_own" on public.resultados_quiz;
create policy "resultados_quiz_select_own" on public.resultados_quiz for select to authenticated using (email_user = (auth.jwt() ->> 'email'));
create policy "resultados_quiz_insert_own" on public.resultados_quiz for insert to authenticated with check (email_user = (auth.jwt() ->> 'email'));
create policy "resultados_quiz_update_own" on public.resultados_quiz for update to authenticated using (email_user = (auth.jwt() ->> 'email')) with check (email_user = (auth.jwt() ->> 'email'));
create policy "resultados_quiz_delete_own" on public.resultados_quiz for delete to authenticated using (email_user = (auth.jwt() ->> 'email'));
