import { requireSupabase } from "./supabase.js";

const optional = (value) => String(value || "").trim() || null;

function iso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("Escolha uma data de prova v\u00e1lida.");
  return date.toISOString();
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links.map((link) => ({ titulo: String(link?.titulo || "").trim(), url: String(link?.url || "").trim() }))
    .filter((link) => link.titulo && link.url);
}

function normalizeContentIds(contents) {
  return [...new Set((Array.isArray(contents) ? contents : []).map(String).filter(Boolean))];
}

function topicPayload(user, profile, exam, values) {
  const theme = String(values.theme || "").trim();
  if (!theme) throw new Error("Informe o tema de estudo.");
  return {
    email_user: user.email,
    perfil: profile.id,
    disciplina: exam.disciplina,
    prova: exam.id,
    tema: theme,
    resumo: optional(values.summary),
    links: normalizeLinks(values.links),
    conteudos: normalizeContentIds(values.contents),
  };
}

export async function getExams(profileId) {
  const { data, error } = await requireSupabase().from("provas").select("*").eq("perfil", profileId).order("data", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getExamTopics(profileId, examId) {
  const { data, error } = await requireSupabase().from("temas_provas").select("*").eq("perfil", profileId).eq("prova", examId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createExam(user, profile, values) {
  const title = String(values.title || "").trim();
  if (!title) throw new Error("Informe o t\u00edtulo da prova.");
  const { data, error } = await requireSupabase().from("provas").insert({
    email_user: user.email, perfil: profile.id, disciplina: values.disciplineId,
    cronograma: values.chronogramId, titulo: title, data: iso(values.dateTime),
  }).select().single();
  if (error) throw error;
  return data;
}

export async function createExamTopic(user, profile, exam, values) {
  const { data, error } = await requireSupabase().from("temas_provas").insert(topicPayload(user, profile, exam, values)).select().single();
  if (error) throw error;
  return data;
}

export async function updateExamTopic(id, user, profile, exam, values) {
  const payload = topicPayload(user, profile, exam, values);
  delete payload.email_user; delete payload.perfil; delete payload.disciplina; delete payload.prova;
  const { data, error } = await requireSupabase().from("temas_provas").update(payload).eq("id", id).eq("perfil", profile.id).eq("prova", exam.id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExamTopic(id, profileId, examId) {
  const { error } = await requireSupabase().from("temas_provas").delete().eq("id", id).eq("perfil", profileId).eq("prova", examId);
  if (error) throw error;
}
