-- AKADEMO: período de vigência do perfil de estudo.
-- Perfis antigos continuam legíveis; ao criar ou editar, o período passa a ser obrigatório.

alter table public.perfil_estudo add column if not exists data_inicio timestamptz;
alter table public.perfil_estudo add column if not exists data_fim timestamptz;

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'data_inicio'
      and atttypid <> 'timestamptz'::regtype and not attisdropped
  ) then
    alter table public.perfil_estudo alter column data_inicio type timestamptz using data_inicio::timestamptz;
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.perfil_estudo'::regclass and attname = 'data_fim'
      and atttypid <> 'timestamptz'::regtype and not attisdropped
  ) then
    alter table public.perfil_estudo alter column data_fim type timestamptz using data_fim::timestamptz;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.perfil_estudo'::regclass and conname = 'perfil_estudo_periodo_check'
  ) then
    alter table public.perfil_estudo add constraint perfil_estudo_periodo_check
      check (data_inicio is null or data_fim is null or data_fim >= data_inicio);
  end if;
end;
$$;

alter table public.perfil_estudo enable row level security;

drop policy if exists "profiles create own" on public.perfil_estudo;
create policy "profiles create own" on public.perfil_estudo
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and email = (select auth.jwt() ->> 'email')
  and data_inicio is not null and data_fim is not null and data_fim >= data_inicio
);

drop policy if exists "profiles update own" on public.perfil_estudo;
create policy "profiles update own" on public.perfil_estudo
for update to authenticated using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and email = (select auth.jwt() ->> 'email')
  and data_inicio is not null and data_fim is not null and data_fim >= data_inicio
);
