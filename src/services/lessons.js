import { extensionFromFile } from "../utils/formatters.js";
import { displayTime, timeParts } from "./schedules.js";
import { requireSupabase } from "./supabase.js";
import { provisionUserStorage } from "./users.js";

const MAX_CONTENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain", "application/json",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip", "application/x-zip-compressed", "application/octet-stream",
]);

function localDay(value) {
  const source = new Date(value);
  return new Date(source.getFullYear(), source.getMonth(), source.getDate());
}

function atTime(date, time) {
  const { hour, minute } = timeParts(time);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function withinProfilePeriod(profile, date) {
  if (!profile?.data_inicio || !profile?.data_fim) return false;
  const start = localDay(profile.data_inicio);
  const end = localDay(profile.data_fim);
  return date >= start && date <= end;
}

export function startOfWeek(reference = new Date(), offset = 0) {
  const date = localDay(reference);
  date.setDate(date.getDate() - date.getDay() + (offset * 7));
  return date;
}

export function getWeekOccurrences(profile, schedules, disciplines, weekStart) {
  const occurrences = [];
  for (let day = 0; day < 7; day += 1) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + day);
    if (!withinProfilePeriod(profile, date)) continue;
    schedules.filter((schedule) => Number(schedule.dia_semana) === date.getDay()).forEach((schedule) => {
      const startsAt = atTime(date, schedule.hora_inicio);
      const endsAt = atTime(date, schedule.hora_fim);
      const discipline = disciplines.find((item) => item.id === schedule.disciplina) || null;
      if (!discipline) return;
      occurrences.push({
        key: `${schedule.id}:${startsAt.toISOString()}`,
        schedule,
        discipline,
        startsAt,
        endsAt,
        label: `${displayTime(schedule.hora_inicio)} - ${displayTime(schedule.hora_fim)}`,
      });
    });
  }
  return occurrences.sort((first, second) => first.startsAt - second.startsAt);
}

export async function getLessons(profileId) {
  const { data, error } = await requireSupabase()
    .from("aulas")
    .select("*")
    .eq("perfil", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getLessonByChronogram(profileId, chronogramId) {
  const { data, error } = await requireSupabase()
    .from("aulas")
    .select("*")
    .eq("perfil", profileId)
    .eq("cronograma", chronogramId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createLesson(user, profile, occurrence, chronogram, summary) {
  if (chronogram?.feriado) throw new Error("Nao e possivel registrar uma aula em um feriado.");
  const { data, error } = await requireSupabase()
    .from("aulas")
    .insert({
      email_user: user.email,
      perfil: profile.id,
      disciplina: occurrence.discipline.id,
      horario: occurrence.schedule.id,
      cronograma: chronogram.id,
      tema: chronogram.tema,
      resumo: String(summary || "").trim() || null,
    })
    .select()
    .single();
  if (error) throw error;

  const { error: linkError } = await requireSupabase()
    .from("cronograma")
    .update({ aula: data.id })
    .eq("id", chronogram.id)
    .eq("perfil", profile.id);
  if (linkError) throw linkError;
  return data;
}

export async function updateLessonSummary(lessonId, profileId, summary) {
  const { data, error } = await requireSupabase()
    .from("aulas")
    .update({ resumo: String(summary || "").trim() || null })
    .eq("id", lessonId)
    .eq("perfil", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getContents(lessonId) {
  const { data, error } = await requireSupabase()
    .from("conteudos")
    .select("*")
    .eq("aula", lessonId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

function contentPath(lessonId, file) {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
  return `conteudos/${lessonId}/${Date.now()}-${random}.${extensionFromFile(file)}`;
}

export async function uploadContent(user, profile, lesson, { title, file }) {
  if (!(file instanceof File) || !file.size) throw new Error("Selecione um arquivo para enviar.");
  if (file.size > MAX_CONTENT_SIZE) throw new Error("O arquivo deve ter no m\u00e1ximo 20 MB.");
  if (file.type && !ALLOWED_CONTENT_TYPES.has(file.type)) throw new Error("Este tipo de arquivo ainda n\u00e3o \u00e9 aceito pelo armazenamento.");
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw new Error("Informe um t\u00edtulo para o arquivo.");

  await provisionUserStorage();
  const client = requireSupabase();
  const path = contentPath(lesson.id, file);
  const { error: uploadError } = await client.storage.from(user.email).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await client.from("conteudos").insert({
    email_user: user.email,
    perfil: profile.id,
    aula: lesson.id,
    path,
    titulo: cleanTitle,
  }).select().single();
  if (error) {
    await client.storage.from(user.email).remove([path]);
    throw error;
  }
  return data;
}

export async function getContentUrl(user, content, download = false) {
  const { data, error } = await requireSupabase().storage.from(user.email)
    .createSignedUrl(content.path, 60 * 10, download ? { download: true } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteContent(user, content) {
  const client = requireSupabase();
  const { error: storageError } = await client.storage.from(user.email).remove([content.path]);
  if (storageError) throw storageError;
  const { error } = await client.from("conteudos").delete().eq("id", content.id);
  if (error) throw error;
}
