import { requireSupabase } from "./supabase.js";
import { displayTime, timeParts } from "./schedules.js";

const KIND_FIELDS = { normal: {}, holiday: { feriado: true }, exam: { prova: true }, presentation: { apresentacao: true } };

function throwChronogramError(error) {
  if (error?.code === "23505") throw new Error("Ja existe um cronograma para esta aula. Escolha outra data e horario.");
  throw error;
}

export function chronogramKind(item) {
  if (item?.feriado) return "holiday";
  if (item?.prova) return "exam";
  if (item?.apresentacao) return "presentation";
  return "normal";
}

export async function getChronogram(profileId) {
  const { data, error } = await requireSupabase()
    .from("cronograma")
    .select("*")
    .eq("perfil", profileId)
    .order("data_hora", { ascending: true });
  if (error) throwChronogramError(error);
  return data;
}

function chronogramPayload(user, profile, values) {
  const kind = KIND_FIELDS[values.kind] || KIND_FIELDS.normal;
  return {
    email_user: user.email,
    perfil: profile.id,
    disciplina: values.disciplineId,
    tema: values.topic.trim(),
    feriado: Boolean(kind.feriado),
    prova: Boolean(kind.prova),
    apresentacao: Boolean(kind.apresentacao),
    data_hora: values.dateTime,
  };
}

export async function createChronogramEntry(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("cronograma")
    .insert(chronogramPayload(user, profile, values))
    .select()
    .single();
  if (error) throwChronogramError(error);
  return data;
}

export async function updateChronogramEntry(id, profile, values) {
  const payload = chronogramPayload({ email: "" }, profile, values);
  delete payload.email_user;
  delete payload.perfil;
  const { data, error } = await requireSupabase()
    .from("cronograma")
    .update(payload)
    .eq("id", id)
    .eq("perfil", profile.id)
    .select()
    .single();
  if (error) throwChronogramError(error);
  return data;
}

export async function deleteChronogramEntry(id, profileId) {
  const { error } = await requireSupabase().from("cronograma").delete().eq("id", id).eq("perfil", profileId);
  if (error) throw error;
}

function dateAtLocalMidnight(value) {
  const source = new Date(value);
  return new Date(source.getFullYear(), source.getMonth(), source.getDate());
}

function atScheduleTime(date, time) {
  const { hour, minute } = timeParts(time);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

export function getLessonOccurrences(profile, disciplineId, schedules) {
  if (!profile?.data_inicio || !profile?.data_fim) return [];
  const relevantSchedules = schedules.filter((schedule) => schedule.disciplina === disciplineId);
  if (!relevantSchedules.length) return [];
  const start = dateAtLocalMidnight(profile.data_inicio);
  const end = dateAtLocalMidnight(profile.data_fim);
  const occurrences = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    relevantSchedules.filter((schedule) => Number(schedule.dia_semana) === date.getDay()).forEach((schedule) => {
      const startsAt = atScheduleTime(date, schedule.hora_inicio);
      occurrences.push({
        value: startsAt.toISOString(),
        startsAt,
        schedule,
        label: `${new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(startsAt).replace(".", "")} · ${displayTime(schedule.hora_inicio)}`,
      });
    });
  }
  return occurrences.sort((first, second) => first.startsAt - second.startsAt);
}

export function findChronogramEntry(entries, disciplineId, date) {
  const time = date instanceof Date ? date.valueOf() : new Date(date).valueOf();
  return entries.find((entry) => entry.disciplina === disciplineId && Math.abs(new Date(entry.data_hora).valueOf() - time) < 60000) || null;
}
