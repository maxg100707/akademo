-- AKADEMO — schema, segurança e políticas RLS
-- Execute este arquivo no SQL Editor de um projeto Supabase novo.
-- Em Authentication > Providers, habilite Email e Google antes de usar o aplicativo.

create extension if not exists pgcrypto;

-- Dados públicos controlados pelo próprio usuário autenticado.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  foto_perfil_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O id e user_id adicionais são essenciais para políticas seguras e para editar/excluir perfis.
create table if not exists public.perfil_estudo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  instituicao text not null check (char_length(btrim(instituicao)) between 1 and 120),
  curso text not null check (char_length(btrim(curso)) between 1 and 120),
  semestre integer not null check (semestre between 1 and 20),
  data_inicio timestamptz not null,
  data_fim timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_fim >= data_inicio)
);

-- Migração compatível com uma instalação anterior que possua apenas as colunas
-- solicitadas inicialmente (email, instituicao, curso e semestre). CREATE TABLE
-- IF NOT EXISTS não altera tabelas já existentes, portanto os campos técnicos
-- precisam ser adicionados e associados à conta do Auth pelo e-mail.
-- Algumas estruturas antigas usam id BIGINT. Não é possível atribuir o UUID do
-- Auth a essa coluna; preservamos o id legado e criamos o id UUID correto.
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.users'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.users rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.perfil_estudo rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'user_id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.perfil_estudo rename column user_id to legacy_user_id;
  end if;
end;
$$;

alter table public.users add column if not exists id uuid;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists nome text;
alter table public.users add column if not exists foto_perfil_path text;
alter table public.users add column if not exists created_at timestamptz default now();
alter table public.users add column if not exists updated_at timestamptz default now();

update public.users as profile_user
set id = auth_user.id
from auth.users as auth_user
where profile_user.id is null
  and lower(btrim(profile_user.email)) = lower(auth_user.email);

update public.users
set nome = coalesce(nullif(btrim(nome), ''), split_part(email, '@', 1))
where nome is null or btrim(nome) = '';

do $$
declare orphan_users integer;
begin
  select count(*) into orphan_users from public.users where id is null;
  if orphan_users > 0 then
    raise exception 'Há % registro(s) em public.users sem conta correspondente em auth.users. Crie/migre essas contas antes de aplicar a segurança.', orphan_users;
  end if;
end;
$$;

alter table public.users alter column id set not null;
alter table public.users alter column email set not null;
alter table public.users alter column nome set not null;
alter table public.users alter column created_at set default now();
alter table public.users alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.users'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.users add constraint users_id_key unique (id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.users add constraint users_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

alter table public.perfil_estudo add column if not exists id uuid;
alter table public.perfil_estudo add column if not exists user_id uuid;
alter table public.perfil_estudo add column if not exists email text;
alter table public.perfil_estudo add column if not exists instituicao text;
alter table public.perfil_estudo add column if not exists curso text;
alter table public.perfil_estudo add column if not exists semestre integer;
alter table public.perfil_estudo add column if not exists data_inicio timestamptz;
alter table public.perfil_estudo add column if not exists data_fim timestamptz;
alter table public.perfil_estudo add column if not exists created_at timestamptz default now();
alter table public.perfil_estudo add column if not exists updated_at timestamptz default now();

update public.perfil_estudo set id = gen_random_uuid() where id is null;
alter table public.perfil_estudo alter column id set default gen_random_uuid();

update public.perfil_estudo as study_profile
set user_id = auth_user.id
from auth.users as auth_user
where study_profile.user_id is null
  and lower(btrim(study_profile.email)) = lower(auth_user.email);

do $$
declare orphan_profiles integer;
begin
  select count(*) into orphan_profiles from public.perfil_estudo where user_id is null;
  if orphan_profiles > 0 then
    raise exception 'Há % perfil(is) de estudo sem conta correspondente em auth.users. Corrija os e-mails desses perfis antes de aplicar a segurança.', orphan_profiles;
  end if;
end;
$$;

alter table public.perfil_estudo alter column id set not null;
alter table public.perfil_estudo alter column user_id set not null;
alter table public.perfil_estudo alter column email set not null;
alter table public.perfil_estudo alter column instituicao set not null;
alter table public.perfil_estudo alter column curso set not null;
alter table public.perfil_estudo alter column semestre set not null;
alter table public.perfil_estudo alter column created_at set default now();
alter table public.perfil_estudo alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.perfil_estudo'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.perfil_estudo add constraint perfil_estudo_id_key unique (id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.perfil_estudo'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ) then
    alter table public.perfil_estudo add constraint perfil_estudo_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

create index if not exists perfil_estudo_user_id_idx on public.perfil_estudo(user_id, created_at);

-- Cria o registro público assim que uma conta é criada no Auth.
-- SECURITY DEFINER permite inserir mesmo que o usuário ainda não tenha uma sessão confirmada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Mantém os e-mails em sincronia caso sejam alterados no Supabase Auth futuramente.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute procedure public.sync_auth_user_email();

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

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
for each row execute procedure public.set_updated_at();

drop trigger if exists perfil_estudo_set_updated_at on public.perfil_estudo;
create trigger perfil_estudo_set_updated_at before update on public.perfil_estudo
for each row execute procedure public.set_updated_at();

-- RLS: nenhum usuário pode ver ou modificar registros de outro.
alter table public.users enable row level security;
alter table public.perfil_estudo enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.perfil_estudo from anon, authenticated;

grant select, insert on table public.users to authenticated;
-- E-mail e id nunca são editáveis pelo navegador; o Auth e o trigger são a fonte de verdade.
grant update (nome, foto_perfil_path, updated_at) on table public.users to authenticated;
grant select, insert, update, delete on table public.perfil_estudo to authenticated;

drop policy if exists "users read own row" on public.users;
create policy "users read own row" on public.users
for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "users insert own row" on public.users;
create policy "users insert own row" on public.users
for insert to authenticated with check (
  (select auth.uid()) = id and email = (select auth.jwt() ->> 'email')
);

drop policy if exists "users update own safe row" on public.users;
create policy "users update own safe row" on public.users
for update to authenticated using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and email = (select auth.jwt() ->> 'email'));

drop policy if exists "profiles read own" on public.perfil_estudo;
create policy "profiles read own" on public.perfil_estudo
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "profiles create own" on public.perfil_estudo;
create policy "profiles create own" on public.perfil_estudo
for insert to authenticated with check (
  (select auth.uid()) = user_id and email = (select auth.jwt() ->> 'email')
  and data_inicio is not null and data_fim is not null and data_fim >= data_inicio
);

drop policy if exists "profiles update own" on public.perfil_estudo;
create policy "profiles update own" on public.perfil_estudo
for update to authenticated using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id and email = (select auth.jwt() ->> 'email')
  and data_inicio is not null and data_fim is not null and data_fim >= data_inicio
);

drop policy if exists "profiles delete own" on public.perfil_estudo;
create policy "profiles delete own" on public.perfil_estudo
for delete to authenticated using ((select auth.uid()) = user_id);

-- Storage
-- Os buckets são privados e criados pela Edge Function abaixo. O id de cada bucket é o e-mail
-- do usuário, como solicitado. O usuário só pode acessar o arquivo de avatar dentro do próprio bucket.
-- storage.objects é uma tabela interna, já protegida por RLS e pertencente ao Supabase.
-- Não execute ALTER TABLE nela: as policies abaixo são suficientes.

drop policy if exists "akademo avatar read own bucket" on storage.objects;
create policy "akademo avatar read own bucket" on storage.objects
for select to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email')
  and name like 'foto_perfil_akademo.%'
  and position('/' in name) = 0
);

drop policy if exists "akademo avatar upload own bucket" on storage.objects;
create policy "akademo avatar upload own bucket" on storage.objects
for insert to authenticated with check (
  bucket_id = (select auth.jwt() ->> 'email')
  and name like 'foto_perfil_akademo.%'
  and position('/' in name) = 0
);

drop policy if exists "akademo avatar update own bucket" on storage.objects;
create policy "akademo avatar update own bucket" on storage.objects
for update to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'foto_perfil_akademo.%' and position('/' in name) = 0
) with check (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'foto_perfil_akademo.%' and position('/' in name) = 0
);

drop policy if exists "akademo avatar delete own bucket" on storage.objects;
create policy "akademo avatar delete own bucket" on storage.objects
for delete to authenticated using (
  bucket_id = (select auth.jwt() ->> 'email') and name like 'foto_perfil_akademo.%' and position('/' in name) = 0
);

-- Professores: cada registro pertence a um perfil de estudo do próprio usuário.
-- Esta seção também funciona como migração para uma instalação que ainda não possui a tabela.
create table if not exists public.professores (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  nome_professor text not null check (char_length(btrim(nome_professor)) between 1 and 120),
  email_professor text,
  telefone_professor text check (telefone_professor is null or telefone_professor ~ '^[0-9]{1,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare old_fk record;
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.professores'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.professores rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.professores'::regclass and attname = 'perfil'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    for old_fk in
      select c.conname
      from pg_constraint as c
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.professores'::regclass
        and c.contype = 'f' and a.attname = 'perfil'
    loop
      execute format('alter table public.professores drop constraint if exists %I', old_fk.conname);
    end loop;
    alter table public.professores rename column perfil to legacy_perfil;
  end if;
end;
$$;

alter table public.professores add column if not exists id uuid;
alter table public.professores add column if not exists email_user text;
alter table public.professores add column if not exists perfil uuid;
alter table public.professores add column if not exists nome_professor text;
alter table public.professores add column if not exists email_professor text;
alter table public.professores add column if not exists telefone_professor text;
alter table public.professores add column if not exists created_at timestamptz default now();
alter table public.professores add column if not exists updated_at timestamptz default now();

-- Converte esquemas antigos que usavam bigint; telefone deve ser texto para
-- armazenar DDI e preservar a representação normalizada do número.
alter table public.professores
  alter column telefone_professor type text using telefone_professor::text;

update public.professores
set telefone_professor = nullif(regexp_replace(telefone_professor, '[^0-9]', '', 'g'), '')
where telefone_professor is not null;

update public.professores set id = gen_random_uuid() where id is null;
alter table public.professores alter column id set default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.professores'::regclass and attname = 'legacy_perfil' and not attisdropped
  ) and exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'legacy_id' and not attisdropped
  ) then
    execute $sql$
      update public.professores as professor
      set perfil = profile.id,
          email_user = coalesce(professor.email_user, profile.email)
      from public.perfil_estudo as profile
      where professor.perfil is null
        and professor.legacy_perfil::text = profile.legacy_id::text
    $sql$;
  end if;
end;
$$;

update public.professores as professor
set perfil = profile.id,
    email_user = coalesce(professor.email_user, profile.email)
from (
  select email, (array_agg(id))[1] as id
  from public.perfil_estudo
  group by email
  having count(*) = 1
) as profile
where professor.perfil is null
  and lower(btrim(coalesce(professor.email_user, ''))) = lower(profile.email);

update public.professores as professor
set email_user = profile.email
from public.perfil_estudo as profile
where professor.email_user is null and professor.perfil = profile.id;

do $$
declare orphan_professors integer;
begin
  select count(*) into orphan_professors
  from public.professores as professor
  left join public.perfil_estudo as profile on profile.id = professor.perfil
  where professor.perfil is null or profile.id is null or professor.email_user is null
    or professor.nome_professor is null or btrim(professor.nome_professor) = '';
  if orphan_professors > 0 then
    raise exception 'Há % professor(es) sem perfil, e-mail do usuário ou nome válido. Corrija esses registros antes de aplicar a migração.', orphan_professors;
  end if;
end;
$$;

alter table public.professores alter column id set not null;
alter table public.professores alter column email_user set not null;
alter table public.professores alter column perfil set not null;
alter table public.professores alter column nome_professor set not null;
alter table public.professores alter column created_at set default now();
alter table public.professores alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.professores'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.professores add constraint professores_id_key unique (id);
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.professores'::regclass and conname = 'professores_perfil_fkey'
  ) then
    alter table public.professores add constraint professores_perfil_fkey
      foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.professores'::regclass and conname = 'professores_nome_professor_check'
  ) then
    alter table public.professores add constraint professores_nome_professor_check
      check (char_length(btrim(nome_professor)) between 1 and 120);
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.professores'::regclass and conname = 'professores_telefone_professor_check'
  ) then
    alter table public.professores add constraint professores_telefone_professor_check
      check (telefone_professor is null or telefone_professor ~ '^[0-9]{1,15}$');
  end if;
end;
$$;

create index if not exists professores_perfil_idx on public.professores(perfil, created_at);

drop trigger if exists professores_set_updated_at on public.professores;
create trigger professores_set_updated_at before update on public.professores
for each row execute procedure public.set_updated_at();

-- Mantém os registros de professores sincronizados caso o e-mail do Auth seja alterado.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
    update public.professores as professor
    set email_user = new.email, updated_at = now()
    from public.perfil_estudo as profile
    where professor.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.professores enable row level security;
revoke all on table public.professores from anon, authenticated;
grant select, insert, update, delete on table public.professores to authenticated;

drop policy if exists "teachers read own profile" on public.professores;
create policy "teachers read own profile" on public.professores
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "teachers create own profile" on public.professores;
create policy "teachers create own profile" on public.professores
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "teachers update own profile" on public.professores;
create policy "teachers update own profile" on public.professores
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "teachers delete own profile" on public.professores;
create policy "teachers delete own profile" on public.professores
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = professores.perfil and profile.user_id = (select auth.uid()))
);

-- Disciplinas: cada disciplina pertence a um perfil e a um professor daquele mesmo perfil.
create table if not exists public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  nome_disciplina text not null check (char_length(btrim(nome_disciplina)) between 1 and 120),
  resumo_disciplina text check (resumo_disciplina is null or char_length(resumo_disciplina) <= 500),
  professor_id uuid not null references public.professores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists disciplinas_perfil_idx on public.disciplinas(perfil, created_at);
create index if not exists disciplinas_professor_idx on public.disciplinas(professor_id);

drop trigger if exists disciplinas_set_updated_at on public.disciplinas;
create trigger disciplinas_set_updated_at before update on public.disciplinas
for each row execute procedure public.set_updated_at();

-- Inclui disciplinas na sincronização de e-mail feita pelo trigger do Auth.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
    update public.professores as professor
    set email_user = new.email, updated_at = now()
    from public.perfil_estudo as profile
    where professor.perfil = profile.id and profile.user_id = new.id;
    update public.disciplinas as disciplina
    set email_user = new.email, updated_at = now()
    from public.perfil_estudo as profile
    where disciplina.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.disciplinas enable row level security;
revoke all on table public.disciplinas from anon, authenticated;
grant select, insert, update, delete on table public.disciplinas to authenticated;

drop policy if exists "disciplines read own profile" on public.disciplinas;
create policy "disciplines read own profile" on public.disciplinas
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid()))
);

drop policy if exists "disciplines create own profile" on public.disciplinas;
create policy "disciplines create own profile" on public.disciplinas
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.professores as professor
    where professor.id = disciplinas.professor_id and professor.perfil = disciplinas.perfil
      and professor.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "disciplines update own profile" on public.disciplinas;
create policy "disciplines update own profile" on public.disciplinas
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.professores as professor
    where professor.id = disciplinas.professor_id and professor.perfil = disciplinas.perfil
      and professor.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "disciplines delete own profile" on public.disciplinas;
create policy "disciplines delete own profile" on public.disciplinas
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid()))
);

-- Horários: aulas vinculadas a uma disciplina do mesmo perfil de estudo.
create table if not exists public.horarios (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_inicio timetz not null,
  hora_fim timetz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);

create index if not exists horarios_perfil_dia_inicio_idx on public.horarios(perfil, dia_semana, hora_inicio);
create index if not exists horarios_disciplina_idx on public.horarios(disciplina);

drop trigger if exists horarios_set_updated_at on public.horarios;
create trigger horarios_set_updated_at before update on public.horarios
for each row execute procedure public.set_updated_at();

-- Inclui horários na sincronização de e-mail feita pelo trigger do Auth.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
    update public.professores as professor set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where professor.perfil = profile.id and profile.user_id = new.id;
    update public.disciplinas as disciplina set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where disciplina.perfil = profile.id and profile.user_id = new.id;
    update public.horarios as horario set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where horario.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.horarios enable row level security;
revoke all on table public.horarios from anon, authenticated;
grant select, insert, update, delete on table public.horarios to authenticated;

drop policy if exists "schedules read own profile" on public.horarios;
create policy "schedules read own profile" on public.horarios
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as disciplina where disciplina.id = horarios.disciplina and disciplina.perfil = horarios.perfil)
);

drop policy if exists "schedules create own profile" on public.horarios;
create policy "schedules create own profile" on public.horarios
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.disciplinas as disciplina
    where disciplina.id = horarios.disciplina and disciplina.perfil = horarios.perfil
      and disciplina.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "schedules update own profile" on public.horarios;
create policy "schedules update own profile" on public.horarios
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.disciplinas as disciplina
    where disciplina.id = horarios.disciplina and disciplina.perfil = horarios.perfil
      and disciplina.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "schedules delete own profile" on public.horarios;
create policy "schedules delete own profile" on public.horarios
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = horarios.perfil and profile.user_id = (select auth.uid()))
);

-- Cronograma: temas e situações especiais de cada ocorrência de aula.
create table if not exists public.cronograma (
  id uuid primary key default gen_random_uuid(),
  email_user text not null,
  perfil uuid not null references public.perfil_estudo(id) on delete cascade,
  disciplina uuid not null references public.disciplinas(id) on delete cascade,
  tema text not null check (char_length(btrim(tema)) between 1 and 180),
  feriado boolean not null default false,
  prova boolean not null default false,
  apresentacao boolean not null default false,
  data_hora timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((feriado::integer + prova::integer + apresentacao::integer) <= 1)
);

create index if not exists cronograma_perfil_disciplina_data_idx on public.cronograma(perfil, disciplina, data_hora);
create index if not exists cronograma_disciplina_data_idx on public.cronograma(disciplina, data_hora);

drop trigger if exists cronograma_set_updated_at on public.cronograma;
create trigger cronograma_set_updated_at before update on public.cronograma
for each row execute procedure public.set_updated_at();

-- A mesma ocorrÃªncia de uma disciplina pode ter apenas um registro de cronograma.
create or replace function public.prevent_duplicate_chronogram_entry()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.cronograma as existing_entry
    where existing_entry.perfil = new.perfil
      and existing_entry.disciplina = new.disciplina
      and existing_entry.data_hora = new.data_hora
      and existing_entry.id is distinct from new.id
  ) then
    raise exception using
      errcode = '23505',
      message = 'JÃ¡ existe um cronograma para esta aula.';
  end if;
  return new;
end;
$$;

drop trigger if exists cronograma_prevent_duplicate_entry on public.cronograma;
create trigger cronograma_prevent_duplicate_entry
before insert or update of perfil, disciplina, data_hora on public.cronograma
for each row execute procedure public.prevent_duplicate_chronogram_entry();

-- Inclui o cronograma na sincronização de e-mail feita pelo trigger do Auth.
create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = new.email, updated_at = now() where id = new.id;
    update public.perfil_estudo set email = new.email, updated_at = now() where user_id = new.id;
    update public.professores as professor set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where professor.perfil = profile.id and profile.user_id = new.id;
    update public.disciplinas as discipline set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where discipline.perfil = profile.id and profile.user_id = new.id;
    update public.horarios as schedule set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where schedule.perfil = profile.id and profile.user_id = new.id;
    update public.cronograma as item set email_user = new.email, updated_at = now()
      from public.perfil_estudo as profile where item.perfil = profile.id and profile.user_id = new.id;
  end if;
  return new;
end;
$$;

alter table public.cronograma enable row level security;
revoke all on table public.cronograma from anon, authenticated;
grant select, insert, update, delete on table public.cronograma to authenticated;

drop policy if exists "chronogram read own profile" on public.cronograma;
create policy "chronogram read own profile" on public.cronograma
for select to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
  and exists (select 1 from public.disciplinas as discipline where discipline.id = cronograma.disciplina and discipline.perfil = cronograma.perfil)
);

drop policy if exists "chronogram create own profile" on public.cronograma;
create policy "chronogram create own profile" on public.cronograma
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = cronograma.disciplina and discipline.perfil = cronograma.perfil
      and discipline.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "chronogram update own profile" on public.cronograma;
create policy "chronogram update own profile" on public.cronograma
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
  and exists (
    select 1 from public.disciplinas as discipline
    where discipline.id = cronograma.disciplina and discipline.perfil = cronograma.perfil
      and discipline.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "chronogram delete own profile" on public.cronograma;
create policy "chronogram delete own profile" on public.cronograma
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (select 1 from public.perfil_estudo as profile where profile.id = cronograma.perfil and profile.user_id = (select auth.uid()))
);
