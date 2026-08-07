-- AKADEMO: execute depois de lessons-migration.sql, exams-migration.sql e suas dependencias.
-- Cria apresentacoes privadas e impede que uma apresentacao receba uma aula comum.

create extension if not exists pgcrypto;

create table if not exists public.apresentacoes (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  cronograma uuid not null references public.cronograma(id) on delete cascade,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 180),
  data timestamptz not null,
  instrucao text check (instrucao is null or char_length(instrucao) <= 5000),
  conteudos jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cronograma)
);

-- Preserva a chave bigint criada manualmente e cria o UUID usado pela aplicacao.
do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.apresentacoes'::regclass and attname = 'id' and atttypid <> 'uuid'::regtype and not attisdropped) then
    alter table public.apresentacoes rename column id to legacy_id;
  end if;
end;
$$;

alter table public.apresentacoes add column if not exists id uuid;
alter table public.apresentacoes add column if not exists email_user text;
alter table public.apresentacoes add column if not exists perfil uuid;
alter table public.apresentacoes add column if not exists disciplina uuid;
alter table public.apresentacoes add column if not exists cronograma uuid;
alter table public.apresentacoes add column if not exists titulo text;
alter table public.apresentacoes add column if not exists data timestamptz;
alter table public.apresentacoes add column if not exists instrucao text;
alter table public.apresentacoes add column if not exists conteudos jsonb default '[]'::jsonb;
alter table public.apresentacoes add column if not exists links jsonb default '[]'::jsonb;
alter table public.apresentacoes add column if not exists created_at timestamptz default now();
alter table public.apresentacoes add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.apresentacoes'::regclass and attname = 'conteudos' and atttypid = 'json'::regtype and not attisdropped) then
    alter table public.apresentacoes alter column conteudos type jsonb using conteudos::jsonb;
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.apresentacoes'::regclass and attname = 'links' and atttypid = 'json'::regtype and not attisdropped) then
    alter table public.apresentacoes alter column links type jsonb using links::jsonb;
  end if;
end;
$$;

update public.apresentacoes set id = gen_random_uuid() where id is null;
update public.apresentacoes set conteudos = '[]'::jsonb where conteudos is null;
update public.apresentacoes set links = '[]'::jsonb where links is null;
update public.apresentacoes set created_at = now() where created_at is null;
update public.apresentacoes set updated_at = now() where updated_at is null;
update public.apresentacoes as presentation
set email_user = profile.email
from public.perfil_estudo as profile
where presentation.email_user is null and presentation.perfil = profile.id;

alter table public.apresentacoes alter column id set default gen_random_uuid();
alter table public.apresentacoes alter column conteudos set default '[]'::jsonb;
alter table public.apresentacoes alter column links set default '[]'::jsonb;
alter table public.apresentacoes alter column created_at set default now();
alter table public.apresentacoes alter column updated_at set default now();

do $$
declare invalid_presentations integer;
begin
  select count(*) into invalid_presentations
  from public.apresentacoes as presentation
  left join public.perfil_estudo as profile on profile.id = presentation.perfil
  left join public.disciplinas as discipline on discipline.id = presentation.disciplina
  left join public.cronograma as chronogram on chronogram.id = presentation.cronograma
  where presentation.email_user is null or presentation.perfil is null or profile.id is null
    or presentation.disciplina is null or discipline.id is null or discipline.perfil <> presentation.perfil
    or presentation.cronograma is null or chronogram.id is null or chronogram.perfil <> presentation.perfil or chronogram.disciplina <> presentation.disciplina
    or not chronogram.apresentacao or chronogram.data_hora <> presentation.data
    or presentation.titulo is null or char_length(btrim(presentation.titulo)) not between 1 and 180
    or (presentation.instrucao is not null and char_length(presentation.instrucao) > 5000)
    or jsonb_typeof(presentation.links) <> 'array' or jsonb_typeof(presentation.conteudos) <> 'array';
  if invalid_presentations > 0 then
    raise exception 'Ha % apresentacao(oes) com cronograma, relacoes ou JSON invalidos. Corrija-as antes de continuar.', invalid_presentations;
  end if;
end;
$$;

alter table public.apresentacoes alter column id set not null;
alter table public.apresentacoes alter column email_user set not null;
alter table public.apresentacoes alter column perfil set not null;
alter table public.apresentacoes alter column disciplina set not null;
alter table public.apresentacoes alter column cronograma set not null;
alter table public.apresentacoes alter column titulo set not null;
alter table public.apresentacoes alter column data set not null;
alter table public.apresentacoes alter column conteudos set not null;
alter table public.apresentacoes alter column links set not null;
alter table public.apresentacoes alter column created_at set not null;
alter table public.apresentacoes alter column updated_at set not null;

do $$
begin
  if not exists (select 1 from pg_index indexes join pg_attribute attributes on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey) where indexes.indrelid = 'public.apresentacoes'::regclass and indexes.indisunique and attributes.attname = 'id') then
    alter table public.apresentacoes add constraint apresentacoes_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.apresentacoes'::regclass and conname = 'apresentacoes_perfil_fkey') then
    alter table public.apresentacoes add constraint apresentacoes_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.apresentacoes'::regclass and conname = 'apresentacoes_disciplina_fkey') then
    alter table public.apresentacoes add constraint apresentacoes_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.apresentacoes'::regclass and conname = 'apresentacoes_cronograma_fkey') then
    alter table public.apresentacoes add constraint apresentacoes_cronograma_fkey foreign key (cronograma) references public.cronograma(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.apresentacoes'::regclass and conname = 'apresentacoes_cronograma_key') then
    alter table public.apresentacoes add constraint apresentacoes_cronograma_key unique (cronograma);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.apresentacoes'::regclass and conname = 'apresentacoes_titulo_check') then
    alter table public.apresentacoes add constraint apresentacoes_titulo_check check (char_length(btrim(titulo)) between 1 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.apresentacoes'::regclass and conname = 'apresentacoes_instrucao_check') then
    alter table public.apresentacoes add constraint apresentacoes_instrucao_check check (instrucao is null or char_length(instrucao) <= 5000);
  end if;
end;
$$;

create index if not exists apresentacoes_perfil_data_idx on public.apresentacoes(perfil, data);

create or replace function public.validate_presentation_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(new.links) <> 'array' or jsonb_typeof(new.conteudos) <> 'array' then
    raise exception 'Links e conteudos devem ser listas JSON.';
  end if;
  if not exists (
    select 1 from public.cronograma as chronogram
    where chronogram.id = new.cronograma and chronogram.perfil = new.perfil
      and chronogram.disciplina = new.disciplina and chronogram.email_user = new.email_user
      and chronogram.apresentacao and chronogram.data_hora = new.data
  ) then
    raise exception 'A apresentacao deve pertencer a um cronograma de apresentacao do mesmo perfil.';
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
    raise exception 'Um conteudo nao pode ser associado mais de uma vez a apresentacao.';
  end if;
  return new;
end;
$$;

drop trigger if exists apresentacoes_validate_links on public.apresentacoes;
create trigger apresentacoes_validate_links
before insert or update of email_user, perfil, disciplina, cronograma, titulo, data, instrucao, conteudos, links
on public.apresentacoes for each row execute procedure public.validate_presentation_links();

drop trigger if exists apresentacoes_set_updated_at on public.apresentacoes;
create trigger apresentacoes_set_updated_at before update on public.apresentacoes for each row execute procedure public.set_updated_at();

alter table public.apresentacoes enable row level security;
revoke all on table public.apresentacoes from anon, authenticated;
grant select, insert on table public.apresentacoes to authenticated;
grant update (instrucao, conteudos, links, updated_at) on table public.apresentacoes to authenticated;

-- Remove politicas anteriores da tabela para nao deixar uma regra permissiva ativa.
do $$
declare current_policy record;
begin
  for current_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'apresentacoes'
  loop
    execute format('drop policy if exists %I on public.apresentacoes', current_policy.policyname);
  end loop;
end;
$$;

create policy "presentations read own profile" on public.apresentacoes for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = apresentacoes.perfil and profile.user_id = (select auth.uid()))
);
create policy "presentations create own profile" on public.apresentacoes for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = apresentacoes.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as discipline where discipline.id = apresentacoes.disciplina and discipline.perfil = apresentacoes.perfil and discipline.email_user = (select auth.jwt() ->> 'email'))
  and exists (select 1 from public.cronograma as chronogram where chronogram.id = apresentacoes.cronograma and chronogram.perfil = apresentacoes.perfil and chronogram.disciplina = apresentacoes.disciplina and chronogram.email_user = (select auth.jwt() ->> 'email') and chronogram.apresentacao and chronogram.data_hora = apresentacoes.data)
);
create policy "presentations update own profile" on public.apresentacoes for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = apresentacoes.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.cronograma as chronogram where chronogram.id = apresentacoes.cronograma and chronogram.perfil = apresentacoes.perfil and chronogram.disciplina = apresentacoes.disciplina and chronogram.email_user = (select auth.jwt() ->> 'email') and chronogram.apresentacao and chronogram.data_hora = apresentacoes.data)
);

-- Recria a politica de aulas para bloquear feriados, provas e apresentacoes no banco.
drop policy if exists "lessons create own profile" on public.aulas;
create policy "lessons create own profile" on public.aulas
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = aulas.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.horarios as schedule where schedule.id = aulas.horario and schedule.perfil = aulas.perfil and schedule.disciplina = aulas.disciplina)
  and exists (select 1 from public.cronograma as chronogram where chronogram.id = aulas.cronograma and chronogram.perfil = aulas.perfil and chronogram.disciplina = aulas.disciplina and chronogram.tema = aulas.tema and chronogram.aula is null and coalesce(chronogram.feriado, false) = false and coalesce(chronogram.prova, false) = false and coalesce(chronogram.apresentacao, false) = false)
);

-- Mantem o e-mail auxiliar sincronizado em todas as tabelas associadas ao perfil.
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
    update public.apresentacoes as presentation set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where presentation.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;
