-- AKADEMO: execute depois de lessons-migration.sql.
-- Mantem o tema de uma aula e o respectivo registro do cronograma sempre iguais.

create or replace function public.sync_lesson_topic_from_chronogram()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.aula is not null and new.tema is distinct from old.tema then
    update public.aulas as lesson
    set tema = new.tema,
        updated_at = now()
    where lesson.id = new.aula
      and lesson.perfil = new.perfil
      and lesson.disciplina = new.disciplina
      and lesson.email_user = new.email_user
      and lesson.tema is distinct from new.tema;
  end if;
  return new;
end;
$$;

drop trigger if exists cronograma_sync_linked_lesson_topic on public.cronograma;
create trigger cronograma_sync_linked_lesson_topic
after update of tema on public.cronograma
for each row
when (old.tema is distinct from new.tema)
execute procedure public.sync_lesson_topic_from_chronogram();
