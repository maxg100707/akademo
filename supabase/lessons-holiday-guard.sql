-- Execute uma vez em projetos que ja receberam lessons-migration.sql.
-- Tambem no banco, impede uma aula vinculada a um cronograma marcado como feriado.

drop policy if exists "lessons create own profile" on public.aulas;
create policy "lessons create own profile" on public.aulas
for insert to authenticated with check (
  email_user = (select auth.jwt() ->> 'email')
  and exists (
    select 1 from public.perfil_estudo as profile
    where profile.id = aulas.perfil and profile.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.horarios as schedule
    where schedule.id = aulas.horario
      and schedule.perfil = aulas.perfil
      and schedule.disciplina = aulas.disciplina
  )
  and exists (
    select 1 from public.cronograma as chronogram
    where chronogram.id = aulas.cronograma
      and chronogram.perfil = aulas.perfil
      and chronogram.disciplina = aulas.disciplina
      and chronogram.tema = aulas.tema
      and chronogram.aula is null
      and coalesce(chronogram.feriado, false) = false
  )
);
