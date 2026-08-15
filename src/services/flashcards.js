import { requireSupabase } from "./supabase.js";

const optional = (value) => String(value ?? "").trim() || null;
const has = (source, key) => Object.prototype.hasOwnProperty.call(source || {}, key);

function makeCardId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `card-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCards(cards) {
  if (!Array.isArray(cards) || !cards.length) {
    throw new Error("Adicione ao menos um flashcard ao conjunto.");
  }
  return cards.map((card, index) => {
    const front = String(card?.front ?? card?.frente ?? "").trim();
    const back = String(card?.back ?? card?.verso ?? "").trim();
    if (!front || !back) throw new Error(`Preencha frente e verso do card ${index + 1}.`);
    if (front.length > 6000 || back.length > 6000) throw new Error("Cada lado do flashcard pode ter no máximo 6000 caracteres.");
    return { id: String(card?.id || makeCardId()), front, back };
  });
}

function association(values = {}) {
  const linked = [
    ["aula", values.lessonId ?? values.aula],
    ["prova", values.examId ?? values.prova],
    ["apresentacao", values.presentationId ?? values.apresentacao],
  ].filter(([, value]) => Boolean(value));
  if (linked.length > 1) throw new Error("Escolha apenas uma aula, prova ou apresentação.");
  return Object.fromEntries(["aula", "prova", "apresentacao"].map((key) => [
    key,
    linked.find(([kind]) => kind === key)?.[1] || null,
  ]));
}

function payload(user, profile, values, previous = {}) {
  const tema_colecao = String(values.theme ?? values.tema_colecao ?? previous.tema_colecao ?? "").trim();
  if (!tema_colecao) throw new Error("Informe o tema do conjunto.");
  if (tema_colecao.length > 180) throw new Error("O tema pode ter no máximo 180 caracteres.");
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
    tema_colecao,
    descricao: optional(has(values, "description") ? values.description : has(values, "descricao") ? values.descricao : previous.descricao),
    cards: normalizeCards(has(values, "cards") ? values.cards : previous.cards),
  };
}

export async function getFlashcardCollections(profileId) {
  const { data, error } = await requireSupabase()
    .from("flashcards")
    .select("*")
    .eq("perfil", profileId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createFlashcardCollection(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("flashcards")
    .insert(payload(user, profile, values))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFlashcardCollection(id, user, profile, previous, values) {
  const next = payload(user, profile, values, previous);
  delete next.email_user;
  delete next.perfil;
  const { data, error } = await requireSupabase()
    .from("flashcards")
    .update(next)
    .eq("id", id)
    .eq("perfil", profile.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFlashcardCollection(id, profileId) {
  const { error } = await requireSupabase()
    .from("flashcards")
    .delete()
    .eq("id", id)
    .eq("perfil", profileId);
  if (error) throw error;
}
