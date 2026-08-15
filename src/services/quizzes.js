import { requireSupabase } from "./supabase.js";

const optional = (value) => String(value ?? "").trim() || null;

function makeId(prefix = "item") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeQuestions(value) {
  if (!Array.isArray(value) || !value.length) throw new Error("Adicione pelo menos uma pergunta ao quiz.");
  if (value.length > 80) throw new Error("Um quiz pode ter no máximo 80 perguntas.");
  return value.map((question, questionIndex) => {
    const statement = String(question?.statement ?? question?.enunciado ?? "").trim();
    const alternatives = Array.isArray(question?.alternatives ?? question?.alternativas)
      ? (question.alternatives ?? question.alternativas) : [];
    if (!statement) throw new Error(`Preencha o enunciado da pergunta ${questionIndex + 1}.`);
    if (statement.length > 5000) throw new Error("Cada enunciado pode ter no máximo 5000 caracteres.");
    if (alternatives.length < 4 || alternatives.length > 6) throw new Error(`A pergunta ${questionIndex + 1} precisa ter entre 4 e 6 alternativas.`);
    const normalizedAlternatives = alternatives.map((alternative, alternativeIndex) => {
      const text = String(alternative?.text ?? alternative?.texto ?? "").trim();
      if (!text) throw new Error(`Preencha a alternativa ${alternativeIndex + 1} da pergunta ${questionIndex + 1}.`);
      if (text.length > 3000) throw new Error("Cada alternativa pode ter no máximo 3000 caracteres.");
      return { id: String(alternative?.id || makeId("alternative")), text };
    });
    const correctId = String(question?.correctId ?? question?.correta ?? "");
    if (!normalizedAlternatives.some((alternative) => alternative.id === correctId)) {
      throw new Error(`Selecione a alternativa correta da pergunta ${questionIndex + 1}.`);
    }
    return { id: String(question?.id || makeId("question")), statement, alternatives: normalizedAlternatives, correctId };
  });
}

function quizPayload(user, values, previous = {}) {
  const tema = String(values.theme ?? values.tema ?? previous.tema ?? "").trim();
  if (!tema) throw new Error("Informe o tema do quiz.");
  if (tema.length > 180) throw new Error("O tema pode ter no máximo 180 caracteres.");
  const descricao = optional(values.description ?? values.descricao ?? previous.descricao);
  if (!descricao) throw new Error("Informe uma descrição para o quiz.");
  if (descricao.length > 3000) throw new Error("A descrição pode ter no máximo 3000 caracteres.");
  const publico = typeof values.public === "boolean" ? values.public : values.publico ?? previous.publico ?? true;
  return {
    email_user: user.email,
    tema,
    descricao,
    publico: Boolean(publico),
    revelar_nome: Boolean(publico) && Boolean(values.revealName ?? values.revelar_nome ?? previous.revelar_nome),
    nome_autor: String(values.authorName ?? values.nome_autor ?? previous.nome_autor ?? "").trim().slice(0, 180) || "Estudante AKADEMO",
    perguntas: normalizeQuestions(values.questions ?? values.perguntas ?? previous.perguntas),
  };
}

export function quizQuestions(quiz) {
  return Array.isArray(quiz?.perguntas) ? quiz.perguntas : [];
}

export async function getPublicQuizzes() {
  const { data, error } = await requireSupabase()
    .from("quizes")
    .select("id, publico, revelar_nome, nome_autor, tema, descricao, perguntas, created_at, updated_at")
    .eq("publico", true)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMyQuizzes(user) {
  const { data, error } = await requireSupabase()
    .from("quizes")
    .select("*")
    .eq("email_user", user.email)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createQuiz(user, values) {
  const { data, error } = await requireSupabase()
    .from("quizes")
    .insert(quizPayload(user, values))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuiz(id, user, previous, values) {
  const next = quizPayload(user, values, previous);
  delete next.email_user;
  const { data, error } = await requireSupabase()
    .from("quizes")
    .update(next)
    .eq("id", id)
    .eq("email_user", user.email)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteQuiz(id, user) {
  const { error } = await requireSupabase()
    .from("quizes")
    .delete()
    .eq("id", id)
    .eq("email_user", user.email);
  if (error) throw error;
}

export async function getQuizResults(user) {
  const { data, error } = await requireSupabase()
    .from("resultados_quiz")
    .select("*")
    .eq("email_user", user.email)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveQuizResult(user, quiz, result) {
  const payload = {
    email_user: user.email,
    quiz: quiz.id,
    resultado: {
      version: 1,
      quizId: quiz.id,
      quizTheme: quiz.tema,
      answeredAt: new Date().toISOString(),
      totalQuestions: result.totalQuestions,
      correctCount: result.correctCount,
      incorrectCount: result.incorrectCount,
      percentage: result.percentage,
      questions: result.questions,
    },
  };
  const { data, error } = await requireSupabase()
    .from("resultados_quiz")
    .upsert(payload, { onConflict: "email_user,quiz" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
