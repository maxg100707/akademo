import { requireSupabase } from "./supabase.js";

const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export const timeParts = (value = "00:00") => {
  const [hour = "00", minute = "00"] = String(value).slice(0, 5).split(":");
  return { hour: Number(hour), minute: Number(minute) };
};

export const timeToMinutes = (value) => {
  const { hour, minute } = timeParts(value);
  return (hour * 60) + minute;
};

export const displayTime = (value) => {
  const { hour, minute } = timeParts(value);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const asTimetz = (value) => `${displayTime(value)}:00+00`;

export async function getSchedules(profileId) {
  const { data, error } = await requireSupabase()
    .from("horarios")
    .select("*")
    .eq("perfil", profileId)
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });
  if (error) throw error;
  return data;
}

function schedulePayload(user, profile, values) {
  const start = asTimetz(values.startTime);
  const end = asTimetz(values.endTime);
  if (timeToMinutes(end) <= timeToMinutes(start)) throw new Error("O horário de término deve ser posterior ao início.");
  return {
    email_user: user.email,
    perfil: profile.id,
    disciplina: values.disciplineId,
    dia_semana: Number(values.weekday),
    hora_inicio: start,
    hora_fim: end,
  };
}

export async function createSchedule(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("horarios")
    .insert(schedulePayload(user, profile, values))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSchedule(id, profile, values) {
  const payload = schedulePayload({ email: "" }, profile, values);
  delete payload.email_user;
  delete payload.perfil;
  const { data, error } = await requireSupabase()
    .from("horarios")
    .update(payload)
    .eq("id", id)
    .eq("perfil", profile.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSchedule(id, profileId) {
  const { error } = await requireSupabase().from("horarios").delete().eq("id", id).eq("perfil", profileId);
  if (error) throw error;
}

function dateAtTime(baseDate, dayOffset, time) {
  const { hour, minute } = timeParts(time);
  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function getNextClass(schedules, disciplines, teachers, now = new Date()) {
  const currentDay = now.getDay();
  const candidates = schedules.map((schedule) => {
    const offset = (Number(schedule.dia_semana) - currentDay + 7) % 7;
    let start = dateAtTime(now, offset, schedule.hora_inicio);
    let end = dateAtTime(now, offset, schedule.hora_fim);
    const isLive = offset === 0 && now >= start && now < end;
    if (!isLive && start <= now) {
      start = dateAtTime(now, 7, schedule.hora_inicio);
      end = dateAtTime(now, 7, schedule.hora_fim);
    }
    const discipline = disciplines.find((item) => item.id === schedule.disciplina) || null;
    const teacher = teachers.find((item) => item.id === discipline?.professor_id) || null;
    return { schedule, start, end, isLive, discipline, teacher };
  }).filter(Boolean);

  return candidates.sort((first, second) => {
    if (first.isLive !== second.isLive) return first.isLive ? -1 : 1;
    return first.start - second.start;
  })[0] || null;
}

export function weekdayName(day) {
  return WEEKDAY_NAMES[Number(day)] || WEEKDAY_NAMES[0];
}

export { WEEKDAY_NAMES };
