-- AKADEMO: execute depois de lessons-migration.sql, exams-migration.sql e presentations-migration.sql.
-- Cria mapas mentais privados por perfil. E seguro executar mais de uma vez.

create extension if not exists pgcrypto;

create table if not exists public.mapas_mentais (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid references public.disciplinas(id) on delete cascade,
  aula uuid references public.aulas(id) on delete cascade,
  prova uuid references public.provas(id) on delete cascade,
  apresentacao uuid references public.apresentacoes(id) on delete cascade,
  tema text not null check (char_length(btrim(tema)) between 1 and 180),
  mapa jsonb not null default '{"nodes":[]}'::jsonb,
  descricao text check (descricao is null or char_length(descricao) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(aula, prova, apresentacao) <= 1)
);

-- Bancos criados pelo editor do Supabase podem ter uma chave bigint. Ela e preservada
-- como legacy_id, enquanto a aplicacao passa a usar o novo id UUID.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.mapas_mentais'::regclass
      and attname = 'id'
      and atttypid <> 'uuid'::regtype
      and not attisdropped
  ) then
    alter table public.mapas_mentais rename column id to legacy_id;
  end if;
end;
$$;

alter table public.mapas_mentais add column if not exists id uuid;
alter table public.mapas_mentais add column if not exists email_user text;
alter table public.mapas_mentais add column if not exists perfil uuid;
alter table public.mapas_mentais add column if not exists disciplina uuid;
alter table public.mapas_mentais add column if not exists aula uuid;
alter table public.mapas_mentais add column if not exists prova uuid;
alter table public.mapas_mentais add column if not exists apresentacao uuid;
alter table public.mapas_mentais add column if not exists tema text;
alter table public.mapas_mentais add column if not exists mapa jsonb default '{"nodes":[]}'::jsonb;
alter table public.mapas_mentais add column if not exists descricao text;
alter table public.mapas_mentais add column if not exists created_at timestamptz default now();
alter table public.mapas_mentais add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.mapas_mentais'::regclass
      and attname = 'mapa'
      and atttypid = 'json'::regtype
      and not attisdropped
  ) then
    alter table public.mapas_mentais alter column mapa type jsonb using mapa::jsonb;
  end if;
end;
$$;

update public.mapas_mentais set id = gen_random_uuid() where id is null;
update public.mapas_mentais as mindmap
set email_user = profile.email
from public.perfil_estudo as profile
where mindmap.email_user is null and mindmap.perfil = profile.id;
update public.mapas_mentais set tema = 'Mapa mental' where tema is null or btrim(tema) = '';
update public.mapas_mentais set descricao = null where descricao is not null and btrim(descricao) = '';
update public.mapas_mentais set created_at = now() where created_at is null;
update public.mapas_mentais set updated_at = now() where updated_at is null;
update public.mapas_mentais
set mapa = jsonb_build_object(
  'titulo', tema,
  'descricao', coalesce(descricao, ''),
  'updated_at', updated_at,
  'nodes', jsonb_build_array(jsonb_build_object(
    'id', 'root',
    'parent_id', null,
    'x', 115,
    'y', 270,
    'text', tema,
    'color', '#16895d',
    'shape', 'rounded',
    'style', 'normal',
    'text_style', jsonb_build_object('bold', true, 'italic', false, 'font_size', 18)
  ))
)
where mapa is null
   or jsonb_typeof(mapa) <> 'object'
   or jsonb_typeof(mapa -> 'nodes') <> 'array'
   or jsonb_array_length(mapa -> 'nodes') = 0;

alter table public.mapas_mentais alter column id set default gen_random_uuid();
alter table public.mapas_mentais alter column mapa set default '{"nodes":[]}'::jsonb;
alter table public.mapas_mentais alter column created_at set default now();
alter table public.mapas_mentais alter column updated_at set default now();

do $$
declare invalid_maps integer;
begin
  select count(*) into invalid_maps
  from public.mapas_mentais as mindmap
  left join public.perfil_estudo as profile on profile.id = mindmap.perfil
  left join public.disciplinas as discipline on discipline.id = mindmap.disciplina
  left join public.aulas as lesson on lesson.id = mindmap.aula
  left join public.provas as exam on exam.id = mindmap.prova
  left join public.apresentacoes as presentation on presentation.id = mindmap.apresentacao
  where mindmap.email_user is null
     or mindmap.perfil is null
     or profile.id is null
     or mindmap.tema is null
     or char_length(btrim(mindmap.tema)) not between 1 and 180
     or mindmap.descricao is not null and char_length(mindmap.descricao) > 4000
     or jsonb_typeof(mindmap.mapa) <> 'object'
     or jsonb_typeof(mindmap.mapa -> 'nodes') <> 'array'
     or jsonb_array_length(mindmap.mapa -> 'nodes') = 0
     or num_nonnulls(mindmap.aula, mindmap.prova, mindmap.apresentacao) > 1
     or (mindmap.disciplina is not null and (discipline.id is null or discipline.perfil <> mindmap.perfil))
     or (mindmap.aula is not null and (lesson.id is null or lesson.perfil <> mindmap.perfil or lesson.disciplina <> mindmap.disciplina))
     or (mindmap.prova is not null and (exam.id is null or exam.perfil <> mindmap.perfil or exam.disciplina <> mindmap.disciplina))
     or (mindmap.apresentacao is not null and (presentation.id is null or presentation.perfil <> mindmap.perfil or presentation.disciplina <> mindmap.disciplina));

  if invalid_maps > 0 then
    raise exception 'There are % mind maps with invalid links or JSON. Fix them before continuing.', invalid_maps;
  end if;
end;
$$;

alter table public.mapas_mentais alter column id set not null;
alter table public.mapas_mentais alter column email_user set not null;
alter table public.mapas_mentais alter column perfil set not null;
alter table public.mapas_mentais alter column tema set not null;
alter table public.mapas_mentais alter column mapa set not null;
alter table public.mapas_mentais alter column created_at set not null;
alter table public.mapas_mentais alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes
    join pg_attribute attributes on attributes.attrelid = indexes.indrelid
      and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.mapas_mentais'::regclass
      and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.mapas_mentais add constraint mapas_mentais_id_key unique (id);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.mapas_mentais'::regclass and conname = 'mapas_mentais_perfil_fkey') then
    alter table public.mapas_mentais add constraint mapas_mentais_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mapas_mentais'::regclass and conname = 'mapas_mentais_disciplina_fkey') then
    alter table public.mapas_mentais add constraint mapas_mentais_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mapas_mentais'::regclass and conname = 'mapas_mentais_aula_fkey') then
    alter table public.mapas_mentais add constraint mapas_mentais_aula_fkey foreign key (aula) references public.aulas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mapas_mentais'::regclass and conname = 'mapas_mentais_prova_fkey') then
    alter table public.mapas_mentais add constraint mapas_mentais_prova_fkey foreign key (prova) references public.provas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mapas_mentais'::regclass and conname = 'mapas_mentais_apresentacao_fkey') then
    alter table public.mapas_mentais add constraint mapas_mentais_apresentacao_fkey foreign key (apresentacao) references public.apresentacoes(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mapas_mentais'::regclass and conname = 'mapas_mentais_tema_check') then
    alter table public.mapas_mentais add constraint mapas_mentais_tema_check check (char_length(btrim(tema)) between 1 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mapas_mentais'::regclass and conname = 'mapas_mentais_descricao_check') then
    alter table public.mapas_mentais add constraint mapas_mentais_descricao_check check (descricao is null or char_length(descricao) <= 4000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.mapas_mentais'::regclass and conname = 'mapas_mentais_one_activity_check') then
    alter table public.mapas_mentais add constraint mapas_mentais_one_activity_check check (num_nonnulls(aula, prova, apresentacao) <= 1);
  end if;
end;
$$;

create index if not exists mapas_mentais_perfil_updated_idx on public.mapas_mentais(perfil, updated_at desc);
create index if not exists mapas_mentais_disciplina_idx on public.mapas_mentais(perfil, disciplina);
create index if not exists mapas_mentais_aula_idx on public.mapas_mentais(aula) where aula is not null;
create index if not exists mapas_mentais_prova_idx on public.mapas_mentais(prova) where prova is not null;
create index if not exists mapas_mentais_apresentacao_idx on public.mapas_mentais(apresentacao) where apresentacao is not null;

create or replace function public.validate_mindmap_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if jsonb_typeof(new.mapa) <> 'object'
    or jsonb_typeof(new.mapa -> 'nodes') <> 'array'
    or jsonb_array_length(new.mapa -> 'nodes') = 0 then
    raise exception 'A mind map must contain a JSON object with at least one node.';
  end if;

  if num_nonnulls(new.aula, new.prova, new.apresentacao) > 1 then
    raise exception 'A mind map can be linked to only one activity.';
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

drop trigger if exists mapas_mentais_validate_links on public.mapas_mentais;
create trigger mapas_mentais_validate_links
before insert or update of email_user, perfil, disciplina, aula, prova, apresentacao, tema, mapa, descricao
on public.mapas_mentais for each row execute procedure public.validate_mindmap_links();

drop trigger if exists mapas_mentais_set_updated_at on public.mapas_mentais;
create trigger mapas_mentais_set_updated_at
before update on public.mapas_mentais for each row execute procedure public.set_updated_at();

alter table public.mapas_mentais enable row level security;
revoke all on table public.mapas_mentais from anon, authenticated;
grant select, insert, update, delete on table public.mapas_mentais to authenticated;

do $$
declare current_policy record;
begin
  for current_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'mapas_mentais'
  loop
    execute format('drop policy if exists %I on public.mapas_mentais', current_policy.policyname);
  end loop;
end;
$$;

create policy "mind maps read own profile" on public.mapas_mentais
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

create policy "mind maps create own profile" on public.mapas_mentais
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

create policy "mind maps update own profile" on public.mapas_mentais
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

create policy "mind maps delete own profile" on public.mapas_mentais
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

-- Inclui mapas mentais na sincronizacao de e-mail do Auth.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
    update public.professores as teacher set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where teacher.perfil = profile.id and profile.user_id = new.id;
    update public.disciplinas as discipline set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where discipline.perfil = profile.id and profile.user_id = new.id;
    update public.horarios as schedule set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where schedule.perfil = profile.id and profile.user_id = new.id;
    update public.cronograma as chronogram set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where chronogram.perfil = profile.id and profile.user_id = new.id;
    update public.aulas as lesson set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where lesson.perfil = profile.id and profile.user_id = new.id;
    update public.conteudos as content set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where content.perfil = profile.id and profile.user_id = new.id;
    update public.tarefas as task set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where task.perfil = profile.id and profile.user_id = new.id;
    update public.provas as exam set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where exam.perfil = profile.id and profile.user_id = new.id;
    update public.temas_provas as exam_topic set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where exam_topic.perfil = profile.id and profile.user_id = new.id;
    update public.apresentacoes as presentation set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where presentation.perfil = profile.id and profile.user_id = new.id;
    update public.mapas_mentais as mindmap set email_user = new.email, updated_at = now() from public.perfil_estudo as profile where mindmap.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
