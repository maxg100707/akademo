import { requireSupabase } from "./supabase.js";

const optional = (value) => String(value || "").trim() || null;
const has = (source, key) => Object.prototype.hasOwnProperty.call(source || {}, key);

function association(values = {}) {
  const links = [
    ["aula", values.lessonId ?? values.aula],
    ["prova", values.examId ?? values.prova],
    ["apresentacao", values.presentationId ?? values.apresentacao],
  ].filter(([, value]) => Boolean(value));

  if (links.length > 1) throw new Error("Escolha apenas uma aula, prova ou apresentação.");

  return Object.fromEntries(["aula", "prova", "apresentacao"].map((key) => [
    key,
    links.find(([kind]) => kind === key)?.[1] || null,
  ]));
}

function payload(user, profile, values, previous = {}) {
  const termo = String(values.term ?? values.termo ?? previous.termo ?? "").trim();
  const definicao = String(values.definition ?? values.definicao ?? previous.definicao ?? "").trim();
  if (!termo) throw new Error("Informe o termo do glossário.");
  if (!definicao) throw new Error("Informe a definição do termo.");

  const disciplina = optional(
    has(values, "disciplineId") ? values.disciplineId
      : has(values, "disciplina") ? values.disciplina
        : previous.disciplina,
  );
  const links = association({
    lessonId: has(values, "lessonId") ? values.lessonId : has(values, "aula") ? values.aula : previous.aula,
    examId: has(values, "examId") ? values.examId : has(values, "prova") ? values.prova : previous.prova,
    presentationId: has(values, "presentationId") ? values.presentationId : has(values, "apresentacao") ? values.apresentacao : previous.apresentacao,
  });
  if (!disciplina && Object.values(links).some(Boolean)) {
    throw new Error("Escolha uma disciplina antes de vincular uma atividade.");
  }

  return {
    email_user: user.email,
    perfil: profile.id,
    disciplina,
    ...links,
    termo,
    definicao,
    exemplo: optional(has(values, "example") ? values.example : has(values, "exemplo") ? values.exemplo : previous.exemplo),
  };
}

export async function getGlossaryTerms(profileId) {
  const { data, error } = await requireSupabase()
    .from("glossario")
    .select("*")
    .eq("perfil", profileId)
    .order("termo", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createGlossaryTerm(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("glossario")
    .insert(payload(user, profile, values))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGlossaryTerm(id, user, profile, previous, values) {
  const next = payload(user, profile, values, previous);
  delete next.email_user;
  delete next.perfil;
  const { data, error } = await requireSupabase()
    .from("glossario")
    .update(next)
    .eq("id", id)
    .eq("perfil", profile.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGlossaryTerm(id, profileId) {
  const { error } = await requireSupabase()
    .from("glossario")
    .delete()
    .eq("id", id)
    .eq("perfil", profileId);
  if (error) throw error;
}
