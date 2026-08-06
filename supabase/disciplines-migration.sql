-- AKADEMO: execute este arquivo DEPOIS de teachers-migration.sql.
-- Cria a tabela de disciplinas, seu vínculo obrigatório com professor e as políticas RLS.

create extension if not exists pgcrypto;

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

-- Migra tabelas antigas que ainda usam IDs numéricos. Os valores antigos são
-- preservados em colunas legadas para que os vínculos possam ser recuperados.
do $$
declare old_fk record;
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.disciplinas'::regclass and attname = 'id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    alter table public.disciplinas rename column id to legacy_id;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.disciplinas'::regclass and attname = 'perfil'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    for old_fk in
      select c.conname
      from pg_constraint as c
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.disciplinas'::regclass
        and c.contype = 'f' and a.attname = 'perfil'
    loop
      execute format('alter table public.disciplinas drop constraint if exists %I', old_fk.conname);
    end loop;
    alter table public.disciplinas rename column perfil to legacy_perfil;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.disciplinas'::regclass and attname = 'professor_id'
      and atttypid <> 'uuid'::regtype and not attisdropped
  ) then
    for old_fk in
      select c.conname
      from pg_constraint as c
      join pg_attribute as a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
      where c.conrelid = 'public.disciplinas'::regclass
        and c.contype = 'f' and a.attname = 'professor_id'
    loop
      execute format('alter table public.disciplinas drop constraint if exists %I', old_fk.conname);
    end loop;
    alter table public.disciplinas rename column professor_id to legacy_professor_id;
  end if;
end;
$$;

alter table public.disciplinas add column if not exists id uuid;
alter table public.disciplinas add column if not exists email_user text;
alter table public.disciplinas add column if not exists perfil uuid;
alter table public.disciplinas add column if not exists nome_disciplina text;
alter table public.disciplinas add column if not exists resumo_disciplina text;
alter table public.disciplinas add column if not exists professor_id uuid;

-- Mantém a migração segura caso uma tabela preliminar já exista no projeto.
alter table public.disciplinas add column if not exists created_at timestamptz default now();
alter table public.disciplinas add column if not exists updated_at timestamptz default now();

update public.disciplinas set id = gen_random_uuid() where id is null;
alter table public.disciplinas alter column id set default gen_random_uuid();

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.disciplinas'::regclass and attname = 'legacy_perfil' and not attisdropped
  ) and exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'legacy_id' and not attisdropped
  ) then
    execute $sql$
      update public.disciplinas as disciplina
      set perfil = profile.id,
          email_user = coalesce(disciplina.email_user, profile.email)
      from public.perfil_estudo as profile
      where disciplina.perfil is null
        and disciplina.legacy_perfil::text = profile.legacy_id::text
    $sql$;
  end if;
end;
$$;

update public.disciplinas as disciplina
set perfil = profile.id,
    email_user = coalesce(disciplina.email_user, profile.email)
from (
  select email, (array_agg(id))[1] as id
  from public.perfil_estudo
  group by email
  having count(*) = 1
) as profile
where disciplina.perfil is null
  and lower(btrim(coalesce(disciplina.email_user, ''))) = lower(profile.email);

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.disciplinas'::regclass and attname = 'legacy_professor_id' and not attisdropped
  ) and exists (
    select 1 from pg_attribute
    where attrelid = 'public.professores'::regclass and attname = 'legacy_id' and not attisdropped
  ) then
    execute $sql$
      update public.disciplinas as disciplina
      set professor_id = professor.id,
          perfil = coalesce(disciplina.perfil, professor.perfil),
          email_user = coalesce(disciplina.email_user, professor.email_user)
      from public.professores as professor
      where disciplina.professor_id is null
        and disciplina.legacy_professor_id::text = professor.legacy_id::text
    $sql$;
  end if;
end;
$$;

update public.disciplinas as disciplina
set email_user = profile.email
from public.perfil_estudo as profile
where disciplina.email_user is null and disciplina.perfil = profile.id;

do $$
declare orphan_disciplines integer;
begin
  select count(*) into orphan_disciplines
  from public.disciplinas as disciplina
  left join public.perfil_estudo as profile on profile.id = disciplina.perfil
  left join public.professores as professor on professor.id = disciplina.professor_id
  where disciplina.perfil is null or profile.id is null
    or disciplina.professor_id is null or professor.id is null
    or professor.perfil <> disciplina.perfil
    or disciplina.email_user is null
    or disciplina.nome_disciplina is null or btrim(disciplina.nome_disciplina) = '';
  if orphan_disciplines > 0 then
    raise exception 'Há % disciplina(s) legadas sem perfil ou professor compatível. Atualize esses vínculos antes de continuar.', orphan_disciplines;
  end if;
end;
$$;

alter table public.disciplinas alter column id set not null;
alter table public.disciplinas alter column email_user set not null;
alter table public.disciplinas alter column perfil set not null;
alter table public.disciplinas alter column nome_disciplina set not null;
alter table public.disciplinas alter column professor_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_index indexes join pg_attribute attributes
      on attributes.attrelid = indexes.indrelid and attributes.attnum = any(indexes.indkey)
    where indexes.indrelid = 'public.disciplinas'::regclass and indexes.indisunique and attributes.attname = 'id'
  ) then
    alter table public.disciplinas add constraint disciplinas_id_key unique (id);
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.disciplinas'::regclass and conname = 'disciplinas_perfil_fkey'
  ) then
    alter table public.disciplinas add constraint disciplinas_perfil_fkey
      foreign key (perfil) references public.perfil_estudo(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.disciplinas'::regclass and conname = 'disciplinas_professor_id_fkey'
  ) then
    alter table public.disciplinas add constraint disciplinas_professor_id_fkey
      foreign key (professor_id) references public.professores(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.disciplinas'::regclass and conname = 'disciplinas_nome_disciplina_check'
  ) then
    alter table public.disciplinas add constraint disciplinas_nome_disciplina_check
      check (char_length(btrim(nome_disciplina)) between 1 and 120);
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.disciplinas'::regclass and conname = 'disciplinas_resumo_disciplina_check'
  ) then
    alter table public.disciplinas add constraint disciplinas_resumo_disciplina_check
      check (resumo_disciplina is null or char_length(resumo_disciplina) <= 500);
  end if;
end;
$$;

drop index if exists public.disciplinas_perfil_idx;
drop index if exists public.disciplinas_professor_idx;
create index if not exists disciplinas_perfil_idx on public.disciplinas(perfil, created_at);
create index if not exists disciplinas_professor_idx on public.disciplinas(professor_id);

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

drop trigger if exists disciplinas_set_updated_at on public.disciplinas;
create trigger disciplinas_set_updated_at before update on public.disciplinas
for each row execute procedure public.set_updated_at();

-- Mantém o e-mail redundante dos registros de domínio alinhado ao Auth.
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
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid())
  )
);

drop policy if exists "disciplines create own profile" on public.disciplinas;
create policy "disciplines create own profile" on public.disciplinas
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.professores as professor
    where professor.id = disciplinas.professor_id
      and professor.perfil = disciplinas.perfil
      and professor.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "disciplines update own profile" on public.disciplinas;
create policy "disciplines update own profile" on public.disciplinas
for update to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid())
  )
) with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.professores as professor
    where professor.id = disciplinas.professor_id
      and professor.perfil = disciplinas.perfil
      and professor.email_user = (select auth.jwt() ->> 'email')
  )
);

drop policy if exists "disciplines delete own profile" on public.disciplinas;
create policy "disciplines delete own profile" on public.disciplinas
for delete to authenticated using (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = disciplinas.perfil and profile.user_id = (select auth.uid())
  )
);
