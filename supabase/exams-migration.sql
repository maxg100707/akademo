-- AKADEMO: execute este arquivo depois de lessons-migration.sql e tasks-migration.sql.
-- Cria provas e temas privados. Tambem acrescenta disciplina aos conteudos ja existentes.

create extension if not exists pgcrypto;

create table if not exists public.provas (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  cronograma uuid not null references public.cronograma(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 180),
  data timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cronograma)
);

create table if not exists public.temas_provas (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  prova uuid not null,
  tema text not null check (char_length(btrim(tema)) between 1 and 180),
  resumo text check (resumo is null or char_length(resumo) <= 4000),
  links jsonb not null default '[]'::jsonb,
  conteudos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bancos que foram iniciados pelas tabelas do editor podem ter id bigint.
-- O id legado e preservado, e a aplicacao passa a usar o UUID novo.
do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.provas'::regclass and attname = 'id' and atttypid <> 'uuid'::regtype and not attisdropped) then
    alter table public.provas rename column id to legacy_id;
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.temas_provas'::regclass and attname = 'id' and atttypid <> 'uuid'::regtype and not attisdropped) then
    alter table public.temas_provas rename column id to legacy_id;
  end if;
end;
$$;

alter table public.provas add column if not exists id uuid;
alter table public.provas add column if not exists email_user text;
alter table public.provas add column if not exists perfil uuid;
alter table public.provas add column if not exists disciplina uuid;
alter table public.provas add column if not exists cronograma uuid;
alter table public.provas add column if not exists titulo text;
alter table public.provas add column if not exists data timestamptz;
alter table public.provas add column if not exists created_at timestamptz default now();
alter table public.provas add column if not exists updated_at timestamptz default now();

alter table public.temas_provas add column if not exists id uuid;
alter table public.temas_provas add column if not exists email_user text;
alter table public.temas_provas add column if not exists perfil uuid;
alter table public.temas_provas add column if not exists disciplina uuid;
alter table public.temas_provas add column if not exists prova uuid;
alter table public.temas_provas add column if not exists tema text;
alter table public.temas_provas add column if not exists resumo text;
alter table public.temas_provas add column if not exists links jsonb default '[]'::jsonb;
alter table public.temas_provas add column if not exists conteudos jsonb default '[]'::jsonb;
alter table public.temas_provas add column if not exists created_at timestamptz default now();
alter table public.temas_provas add column if not exists updated_at timestamptz default now();

-- Converte as colunas JSON antigas para JSONB sem descartar dados.
do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.temas_provas'::regclass and attname = 'links' and atttypid = 'json'::regtype and not attisdropped) then
    alter table public.temas_provas alter column links type jsonb using links::jsonb;
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.temas_provas'::regclass and attname = 'conteudos' and atttypid = 'json'::regtype and not attisdropped) then
    alter table public.temas_provas alter column conteudos type jsonb using conteudos::jsonb;
  end if;
end;
$$;

update public.provas set id = gen_random_uuid() where id is null;
update public.provas set created_at = now() where created_at is null;
update public.provas set updated_at = now() where updated_at is null;
update public.temas_provas set id = gen_random_uuid() where id is null;
update public.temas_provas set links = '[]'::jsonb where links is null;
update public.temas_provas set conteudos = '[]'::jsonb where conteudos is null;
update public.temas_provas set created_at = now() where created_at is null;
update public.temas_provas set updated_at = now() where updated_at is null;

alter table public.provas alter column id set default gen_random_uuid();
alter table public.provas alter column created_at set default now();
alter table public.provas alter column updated_at set default now();
alter table public.temas_provas alter column id set default gen_random_uuid();
alter table public.temas_provas alter column links set default '[]'::jsonb;
alter table public.temas_provas alter column conteudos set default '[]'::jsonb;
alter table public.temas_provas alter column created_at set default now();
alter table public.temas_provas alter column updated_at set default now();

-- Todo arquivo passa a conhecer a disciplina. Arquivos de aula existentes sao preenchidos a partir da aula.
alter table public.conteudos add column if not exists disciplina uuid;
alter table public.conteudos alter column aula drop not null;

update public.conteudos as content
set disciplina = lesson.disciplina
from public.aulas as lesson
where content.disciplina is null and content.aula = lesson.id;

update public.provas as exam
set email_user = profile.email
from public.perfil_estudo as profile
where exam.email_user is null and exam.perfil = profile.id;

update public.temas_provas as topic
set email_user = profile.email
from public.perfil_estudo as profile
where topic.email_user is null and topic.perfil = profile.id;

do $$
declare invalid_contents integer;
declare invalid_exams integer;
declare invalid_topics integer;
begin
  select count(*) into invalid_contents
  from public.conteudos as content
  left join public.perfil_estudo as profile on profile.id = content.perfil
  left join public.disciplinas as discipline on discipline.id = content.disciplina
  left join public.aulas as lesson on lesson.id = content.aula
  where content.email_user is null or content.perfil is null or profile.id is null
    or content.disciplina is null or discipline.id is null or discipline.perfil <> content.perfil
    or (content.aula is not null and (lesson.id is null or lesson.perfil <> content.perfil or lesson.disciplina <> content.disciplina))
    or content.path is null or content.path not like 'conteudos/%'
    or content.titulo is null or char_length(btrim(content.titulo)) not between 1 and 160;
  if invalid_contents > 0 then
    raise exception 'Ha % conteudo(s) sem perfil, disciplina ou caminho valido. Corrija-os antes de continuar.', invalid_contents;
  end if;

  select count(*) into invalid_exams
  from public.provas as exam
  left join public.perfil_estudo as profile on profile.id = exam.perfil
  left join public.disciplinas as discipline on discipline.id = exam.disciplina
  left join public.cronograma as chronogram on chronogram.id = exam.cronograma
  where exam.email_user is null or exam.perfil is null or profile.id is null
    or exam.disciplina is null or discipline.id is null or discipline.perfil <> exam.perfil
    or exam.cronograma is null or chronogram.id is null or chronogram.perfil <> exam.perfil or chronogram.disciplina <> exam.disciplina
    or not chronogram.prova or chronogram.data_hora <> exam.data
    or exam.titulo is null or char_length(btrim(exam.titulo)) not between 1 and 180;
  if invalid_exams > 0 then
    raise exception 'Ha % prova(s) sem cronograma de prova ou relacoes validas. Corrija-as antes de continuar.', invalid_exams;
  end if;

  select count(*) into invalid_topics
  from public.temas_provas as topic
  left join public.provas as exam on exam.id = topic.prova
  where topic.email_user is null or topic.perfil is null or topic.disciplina is null
    or exam.id is null or exam.perfil <> topic.perfil or exam.disciplina <> topic.disciplina
    or topic.tema is null or char_length(btrim(topic.tema)) not between 1 and 180
    or jsonb_typeof(topic.links) <> 'array' or jsonb_typeof(topic.conteudos) <> 'array';
  if invalid_topics > 0 then
    raise exception 'Ha % tema(s) de prova com relacoes ou JSON invalidos. Corrija-os antes de continuar.', invalid_topics;
  end if;
end;
$$;

alter table public.conteudos alter column disciplina set not null;
alter table public.provas alter column id set not null;
alter table public.provas alter column email_user set not null;
alter table public.provas alter column perfil set not null;
alter table public.provas alter column disciplina set not null;
alter table public.provas alter column cronograma set not null;
alter table public.provas alter column titulo set not null;
alter table public.provas alter column data set not null;
alter table public.provas alter column created_at set not null;
alter table public.provas alter column updated_at set not null;
alter table public.temas_provas alter column id set not null;
alter table public.temas_provas alter column email_user set not null;
alter table public.temas_provas alter column perfil set not null;
alter table public.temas_provas alter column disciplina set not null;
alter table public.temas_provas alter column prova set not null;
alter table public.temas_provas alter column tema set not null;
alter table public.temas_provas alter column links set not null;
alter table public.temas_provas alter column conteudos set not null;
alter table public.temas_provas alter column created_at set not null;
alter table public.temas_provas alter column updated_at set not null;

do $$
begin
  if not exists (select 1 from pg_index indexes join pg_attribute attributes on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey) where indexes.indrelid = 'public.provas'::regclass and indexes.indisunique and attributes.attname = 'id') then
    alter table public.provas add constraint provas_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provas'::regclass and conname = 'provas_perfil_fkey') then
    alter table public.provas add constraint provas_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provas'::regclass and conname = 'provas_disciplina_fkey') then
    alter table public.provas add constraint provas_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provas'::regclass and conname = 'provas_cronograma_fkey') then
    alter table public.provas add constraint provas_cronograma_fkey foreign key (cronograma) references public.cronograma(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provas'::regclass and conname = 'provas_cronograma_key') then
    alter table public.provas add constraint provas_cronograma_key unique (cronograma);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.provas'::regclass and conname = 'provas_titulo_check') then
    alter table public.provas add constraint provas_titulo_check check (char_length(btrim(titulo)) between 1 and 180);
  end if;

  if not exists (select 1 from pg_index indexes join pg_attribute attributes on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey) where indexes.indrelid = 'public.temas_provas'::regclass and indexes.indisunique and attributes.attname = 'id') then
    alter table public.temas_provas add constraint temas_provas_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.temas_provas'::regclass and conname = 'temas_provas_perfil_fkey') then
    alter table public.temas_provas add constraint temas_provas_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.temas_provas'::regclass and conname = 'temas_provas_disciplina_fkey') then
    alter table public.temas_provas add constraint temas_provas_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.temas_provas'::regclass and conname = 'temas_provas_prova_fkey') then
    alter table public.temas_provas add constraint temas_provas_prova_fkey foreign key (prova) references public.provas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.temas_provas'::regclass and conname = 'temas_provas_tema_check') then
    alter table public.temas_provas add constraint temas_provas_tema_check check (char_length(btrim(tema)) between 1 and 180);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.conteudos'::regclass and conname = 'conteudos_disciplina_fkey') then
    alter table public.conteudos add constraint conteudos_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
end;
$$;

create index if not exists provas_perfil_data_idx on public.provas(perfil, data);
create index if not exists temas_provas_prova_idx on public.temas_provas(prova, created_at);
create index if not exists conteudos_perfil_disciplina_created_idx on public.conteudos(perfil, disciplina, created_at desc);

create or replace function public.validate_exam_topic_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(new.links) <> 'array' or jsonb_typeof(new.conteudos) <> 'array' then
    raise exception 'Links e conteudos devem ser listas JSON.';
  end if;
  if not exists (
    select 1 from public.provas as exam
    where exam.id = new.prova and exam.perfil = new.perfil
      and exam.disciplina = new.disciplina and exam.email_user = new.email_user
  ) then
    raise exception 'O tema deve pertencer a uma prova do mesmo perfil e disciplina.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(new.conteudos) as item(content_id)
    where not exists (
      select 1 from public.conteudos as content
      where content.id::text = item.content_id and content.perfil = new.perfil
        and content.disciplina = new.disciplina and content.email_user = new.email_user
    )
  ) then
    raise exception 'Um conteudo selecionado nao pertence a esta disciplina.';
  end if;
  if (select count(*) from jsonb_array_elements_text(new.conteudos)) <> (select count(distinct item.content_id) from jsonb_array_elements_text(new.conteudos) as item(content_id)) then
    raise exception 'Um conteudo nao pode ser associado mais de uma vez ao mesmo tema.';
  end if;
  return new;
end;
$$;

drop trigger if exists temas_provas_validate_links on public.temas_provas;
create trigger temas_provas_validate_links
before insert or update of email_user, perfil, disciplina, prova, tema, resumo, links, conteudos
on public.temas_provas for each row execute procedure public.validate_exam_topic_links();

create or replace function public.validate_content_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = new.disciplina and discipline.perfil = new.perfil
      and discipline.email_user = new.email_user
  ) then
    raise exception 'O conteudo deve pertencer a uma disciplina do mesmo perfil.';
  end if;
  if new.aula is not null and not exists (
    select 1 from public.aulas as lesson
    where lesson.id = new.aula and lesson.perfil = new.perfil
      and lesson.disciplina = new.disciplina and lesson.email_user = new.email_user
  ) then
    raise exception 'A aula do conteudo nao pertence a esta disciplina.';
  end if;
  return new;
end;
$$;

drop trigger if exists conteudos_validate_links on public.conteudos;
create trigger conteudos_validate_links
before insert or update of email_user, perfil, disciplina, aula
on public.conteudos for each row execute procedure public.validate_content_links();

drop trigger if exists provas_set_updated_at on public.provas;
create trigger provas_set_updated_at before update on public.provas for each row execute procedure public.set_updated_at();
drop trigger if exists temas_provas_set_updated_at on public.temas_provas;
create trigger temas_provas_set_updated_at before update on public.temas_provas for each row execute procedure public.set_updated_at();

alter table public.provas enable row level security;
alter table public.temas_provas enable row level security;
alter table public.conteudos enable row level security;

revoke all on table public.provas from anon, authenticated;
revoke all on table public.temas_provas from anon, authenticated;
grant select, insert on table public.provas to authenticated;
grant select, insert, update, delete on table public.temas_provas to authenticated;
grant select, insert, delete on table public.conteudos to authenticated;

drop policy if exists "exams read own profile" on public.provas;
create policy "exams read own profile" on public.provas for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = provas.perfil and profile.user_id = (select auth.uid()))
);
drop policy if exists "exams create own profile" on public.provas;
create policy "exams create own profile" on public.provas for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = provas.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as discipline where discipline.id = provas.disciplina and discipline.perfil = provas.perfil and discipline.email_user = (select auth.jwt() ->> 'email'))
  and exists (select 1 from public.cronograma as chronogram where chronogram.id = provas.cronograma and chronogram.perfil = provas.perfil and chronogram.disciplina = provas.disciplina and chronogram.email_user = (select auth.jwt() ->> 'email') and chronogram.prova and chronogram.data_hora = provas.data)
);

-- Uma prova nao pode receber um registro de aula comum, mesmo por chamadas diretas.
drop policy if exists "lessons create own profile" on public.aulas;
create policy "lessons create own profile" on public.aulas
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = aulas.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.horarios as schedule where schedule.id = aulas.horario and schedule.perfil = aulas.perfil and schedule.disciplina = aulas.disciplina)
  and exists (select 1 from public.cronograma as chronogram where chronogram.id = aulas.cronograma and chronogram.perfil = aulas.perfil and chronogram.disciplina = aulas.disciplina and chronogram.tema = aulas.tema and chronogram.aula is null and coalesce(chronogram.feriado, false) = false and coalesce(chronogram.prova, false) = false)
);

drop policy if exists "exam topics read own profile" on public.temas_provas;
create policy "exam topics read own profile" on public.temas_provas for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = temas_provas.perfil and profile.user_id = (select auth.uid()))
);
drop policy if exists "exam topics create own profile" on public.temas_provas;
create policy "exam topics create own profile" on public.temas_provas for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = temas_provas.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.provas as exam where exam.id = temas_provas.prova and exam.perfil = temas_provas.perfil and exam.disciplina = temas_provas.disciplina and exam.email_user = (select auth.jwt() ->> 'email'))
);
drop policy if exists "exam topics update own profile" on public.temas_provas;
create policy "exam topics update own profile" on public.temas_provas for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = temas_provas.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.provas as exam where exam.id = temas_provas.prova and exam.perfil = temas_provas.perfil and exam.disciplina = temas_provas.disciplina and exam.email_user = (select auth.jwt() ->> 'email'))
);
drop policy if exists "exam topics delete own profile" on public.temas_provas;
create policy "exam topics delete own profile" on public.temas_provas for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = temas_provas.perfil and profile.user_id = (select auth.uid()))
);

-- Substitui as politicas antigas, que exigiam obrigatoriamente uma aula no conteudo.
drop policy if exists "contents read own lesson" on public.conteudos;
drop policy if exists "contents create own lesson" on public.conteudos;
drop policy if exists "contents delete own lesson" on public.conteudos;
drop policy if exists "contents read own profile" on public.conteudos;
drop policy if exists "contents create own profile" on public.conteudos;
drop policy if exists "contents delete own profile" on public.conteudos;
create policy "contents read own profile" on public.conteudos for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = conteudos.perfil and profile.user_id = (select auth.uid()))
);
create policy "contents create own profile" on public.conteudos for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = conteudos.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as discipline where discipline.id = conteudos.disciplina and discipline.perfil = conteudos.perfil and discipline.email_user = (select auth.jwt() ->> 'email'))
  and (conteudos.aula is null or exists (select 1 from public.aulas as lesson where lesson.id = conteudos.aula and lesson.perfil = conteudos.perfil and lesson.disciplina = conteudos.disciplina and lesson.email_user = (select auth.jwt() ->> 'email')))
);
create policy "contents delete own profile" on public.conteudos for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = conteudos.perfil and profile.user_id = (select auth.uid()))
);

-- Mantem a coluna auxiliar de e-mail sincronizada caso o e-mail de Auth mude.
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
    update public.tarefas as task set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where task.perfil = profile.id and profile.user_id = new.id;
    update public.provas as exam set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where exam.perfil = profile.id and profile.user_id = new.id;
    update public.temas_provas as topic set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where topic.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;
