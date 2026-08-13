-- AKADEMO: execute depois de lessons-migration.sql, exams-migration.sql e presentations-migration.sql.
-- Cria a biblioteca privada de vídeos por perfil. Pode ser executado mais de uma vez.

create extension if not exists pgcrypto;

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid references public.disciplinas(id) on delete cascade,
  aula uuid references public.aulas(id) on delete cascade,
  prova uuid references public.provas(id) on delete cascade,
  apresentacao uuid references public.apresentacoes(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 180),
  descricao text check (descricao is null or char_length(descricao) <= 5000),
  link text not null,
  arquivo_no_bucket boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(aula, prova, apresentacao) <= 1)
);

-- Alguns projetos foram criados inicialmente com id bigint pelo Table Editor.
-- Mantém esse valor como legado e cria o UUID usado pelo aplicativo.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.videos'::regclass
      and attname = 'id'
      and atttypid <> 'uuid'::regtype
      and not attisdropped
  ) and not exists (
    select 1 from pg_attribute
    where attrelid = 'public.videos'::regclass
      and attname = 'legacy_id'
      and not attisdropped
  ) then
    alter table public.videos rename column id to legacy_id;
  end if;
end;
$$;

alter table public.videos add column if not exists id uuid;
alter table public.videos add column if not exists email_user text;
alter table public.videos add column if not exists perfil uuid;
alter table public.videos add column if not exists disciplina uuid;
alter table public.videos add column if not exists aula uuid;
alter table public.videos add column if not exists prova uuid;
alter table public.videos add column if not exists apresentacao uuid;
alter table public.videos add column if not exists nome text;
alter table public.videos add column if not exists descricao text;
alter table public.videos add column if not exists link text;
alter table public.videos add column if not exists arquivo_no_bucket boolean default false;
alter table public.videos add column if not exists created_at timestamptz default now();
alter table public.videos add column if not exists updated_at timestamptz default now();

update public.videos set id = gen_random_uuid() where id is null;
update public.videos as video
set email_user = profile.email
from public.perfil_estudo as profile
where video.email_user is null and video.perfil = profile.id;
update public.videos set nome = 'Vídeo sem título' where nome is null or btrim(nome) = '';
update public.videos set descricao = null where descricao is not null and btrim(descricao) = '';
update public.videos set arquivo_no_bucket = false where arquivo_no_bucket is null;
update public.videos set created_at = now() where created_at is null;
update public.videos set updated_at = now() where updated_at is null;

alter table public.videos alter column id set default gen_random_uuid();
alter table public.videos alter column arquivo_no_bucket set default false;
alter table public.videos alter column created_at set default now();
alter table public.videos alter column updated_at set default now();

do $$
declare invalid_videos integer;
begin
  select count(*) into invalid_videos
  from public.videos as video
  left join public.perfil_estudo as profile on profile.id = video.perfil
  left join public.disciplinas as discipline on discipline.id = video.disciplina
  left join public.aulas as lesson on lesson.id = video.aula
  left join public.provas as exam on exam.id = video.prova
  left join public.apresentacoes as presentation on presentation.id = video.apresentacao
  where video.email_user is null
    or video.perfil is null
    or profile.id is null
    or video.nome is null
    or char_length(btrim(video.nome)) not between 1 and 180
    or video.link is null or btrim(video.link) = ''
    or (video.descricao is not null and char_length(video.descricao) > 5000)
    or num_nonnulls(video.aula, video.prova, video.apresentacao) > 1
    or (video.disciplina is not null and (discipline.id is null or discipline.perfil <> video.perfil))
    or (video.aula is not null and (lesson.id is null or lesson.perfil <> video.perfil or lesson.disciplina <> video.disciplina))
    or (video.prova is not null and (exam.id is null or exam.perfil <> video.perfil or exam.disciplina <> video.disciplina))
    or (video.apresentacao is not null and (presentation.id is null or presentation.perfil <> video.perfil or presentation.disciplina <> video.disciplina));

  if invalid_videos > 0 then
    raise exception 'There are % video records with invalid ownership, links, or activity relations. Fix them before continuing.', invalid_videos;
  end if;
end;
$$;

alter table public.videos alter column id set not null;
alter table public.videos alter column email_user set not null;
alter table public.videos alter column perfil set not null;
alter table public.videos alter column nome set not null;
alter table public.videos alter column link set not null;
alter table public.videos alter column arquivo_no_bucket set not null;
alter table public.videos alter column created_at set not null;
alter table public.videos alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes
    join pg_attribute attributes on attributes.attrelid = indexes.indrelid
      and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.videos'::regclass
      and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.videos add constraint videos_id_key unique (id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.videos'::regclass and conname = 'videos_perfil_fkey') then
    alter table public.videos add constraint videos_perfil_fkey foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.videos'::regclass and conname = 'videos_disciplina_fkey') then
    alter table public.videos add constraint videos_disciplina_fkey foreign key (disciplina) references public.disciplinas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.videos'::regclass and conname = 'videos_aula_fkey') then
    alter table public.videos add constraint videos_aula_fkey foreign key (aula) references public.aulas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.videos'::regclass and conname = 'videos_prova_fkey') then
    alter table public.videos add constraint videos_prova_fkey foreign key (prova) references public.provas(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.videos'::regclass and conname = 'videos_apresentacao_fkey') then
    alter table public.videos add constraint videos_apresentacao_fkey foreign key (apresentacao) references public.apresentacoes(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.videos'::regclass and conname = 'videos_nome_check') then
    alter table public.videos add constraint videos_nome_check check (char_length(btrim(nome)) between 1 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.videos'::regclass and conname = 'videos_descricao_check') then
    alter table public.videos add constraint videos_descricao_check check (descricao is null or char_length(descricao) <= 5000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.videos'::regclass and conname = 'videos_one_activity_check') then
    alter table public.videos add constraint videos_one_activity_check check (num_nonnulls(aula, prova, apresentacao) <= 1);
  end if;
end;
$$;

create index if not exists videos_perfil_created_idx on public.videos(perfil, created_at desc);
create index if not exists videos_perfil_disciplina_idx on public.videos(perfil, disciplina);
create index if not exists videos_aula_idx on public.videos(aula) where aula is not null;
create index if not exists videos_prova_idx on public.videos(prova) where prova is not null;
create index if not exists videos_apresentacao_idx on public.videos(apresentacao) where apresentacao is not null;

create or replace function public.validate_video_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if btrim(coalesce(new.link, '')) = '' then
    raise exception 'A video must have a link or a private storage path.';
  end if;

  if new.arquivo_no_bucket and new.link not like 'videos/%' then
    raise exception 'A private video must use a path inside videos/.';
  end if;

  if not new.arquivo_no_bucket and new.link !~* '^https?://' then
    raise exception 'An external video must use an http or https link.';
  end if;

  if num_nonnulls(new.aula, new.prova, new.apresentacao) > 1 then
    raise exception 'A video can be linked to only one activity.';
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

drop trigger if exists videos_validate_links on public.videos;
create trigger videos_validate_links
before insert or update of email_user, perfil, disciplina, aula, prova, apresentacao, nome, descricao, link, arquivo_no_bucket
on public.videos for each row execute procedure public.validate_video_links();

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
before update on public.videos for each row execute procedure public.set_updated_at();

alter table public.videos enable row level security;
revoke all on table public.videos from anon, authenticated;
grant select, insert, delete on table public.videos to authenticated;

drop policy if exists "videos read own profile" on public.videos;
drop policy if exists "videos create own profile" on public.videos;
drop policy if exists "videos delete own profile" on public.videos;

create policy "videos read own profile" on public.videos
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

create policy "videos create own profile" on public.videos
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

create policy "videos delete own profile" on public.videos
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and perfil in (select id from public.perfil_estudo where user_id = (select auth.uid()))
);

-- Os arquivos continuam privados no bucket individual identificado pelo e-mail.
-- Não há bucket público nem URL permanente: o cliente usa uma URL assinada temporária.
drop policy if exists "akademo video read own bucket" on storage.objects;
create policy "akademo video read own bucket" on storage.objects
for select to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'videos/%'
);

drop policy if exists "akademo video upload own bucket" on storage.objects;
create policy "akademo video upload own bucket" on storage.objects
for insert to authenticated with check (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'videos/%'
);

drop policy if exists "akademo video delete own bucket" on storage.objects;
create policy "akademo video delete own bucket" on storage.objects
for delete to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'videos/%'
);

-- Mantém os registros de vídeos corretos se o e-mail do Auth for alterado.
create or replace function public.sync_videos_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.videos as video
    set email_user = new.email, updated_at = now()
    from public.perfil_estudo as profile
    where video.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists videos_sync_auth_email on auth.users;
create trigger videos_sync_auth_email
after update of email on auth.users
for each row execute procedure public.sync_videos_user_email();

notify pgrst, 'reload schema';
