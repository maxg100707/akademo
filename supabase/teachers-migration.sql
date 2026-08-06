-- AKADEMO: execute este arquivo no SQL Editor para habilitar professores
-- Requer a tabela public.perfil_estudo da schema.sql já aplicada.

create extension if not exists pgcrypto;

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

update public.professores
set telefone_professor = nullif(regexp_replace(telefone_professor, '[^0-9]', '', 'g'), '')
where telefone_professor is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.professores'::regclass and conname = 'professores_telefone_professor_check'
  ) then
    alter table public.professores add constraint professores_telefone_professor_check
      check (telefone_professor is null or telefone_professor ~ '^[0-9]{1,15}$');
  end if;
end;
$$;

create index if not exists professores_perfil_idx on public.professores(perfil, created_at);

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

drop trigger if exists professores_set_updated_at on public.professores;
create trigger professores_set_updated_at before update on public.professores
for each row execute procedure public.set_updated_at();

-- Inclui os professores na sincronização de e-mail já usada pelo AKADEMO.
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
