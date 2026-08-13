import { requireSupabase } from "./supabase.js";

const normalizeOptional = (value) => String(value || "").trim() || null;
const normalizeCompleted = (value) => value === true || value === "true" || value === "on" || value === 1;

function deadlineIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("Informe uma data limite v\u00e1lida.");
  return date.toISOString();
}

function taskPayload(user, profile, values) {
  const title = String(values.title || "").trim();
  const disciplineId = String(values.disciplineId || "").trim() || null;
  const lessonId = String(values.lessonId || "").trim() || null;
  const examId = String(values.examId || "").trim() || null;
  const presentationId = String(values.presentationId || "").trim() || null;
  if (!title) throw new Error("Informe o t\u00edtulo da tarefa.");
  if ([lessonId, examId, presentationId].filter(Boolean).length > 1)
    throw new Error("Vincule a tarefa a apenas uma aula, prova ou apresentação.");
  return {
    email_user: user.email,
    perfil: profile.id,
    disciplina: disciplineId,
    aula: lessonId,
    prova: examId,
    apresentacao: presentationId,
    titulo: title,
    descricao: normalizeOptional(values.description),
    prazo: deadlineIso(values.deadline),
    completa: normalizeCompleted(values.completed),
  };
}

export async function getTasks(profileId) {
  const { data, error } = await requireSupabase()
    .from("tarefas")
    .select("*")
    .eq("perfil", profileId)
    .order("completa", { ascending: true })
    .order("prazo", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTask(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("tarefas")
    .insert(taskPayload(user, profile, values))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id, profile, values) {
  const payload = taskPayload({ email: "" }, profile, values);
  delete payload.email_user;
  delete payload.perfil;
  const { data, error } = await requireSupabase()
    .from("tarefas")
    .update(payload)
    .eq("id", id)
    .eq("perfil", profile.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setTaskCompleted(task, profileId, completed) {
  const { data, error } = await requireSupabase()
    .from("tarefas")
    .update({ completa: Boolean(completed) })
    .eq("id", task.id)
    .eq("perfil", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id, profileId) {
  const { error } = await requireSupabase()
    .from("tarefas")
    .delete()
    .eq("id", id)
    .eq("perfil", profileId);
  if (error) throw error;
}
