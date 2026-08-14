import { requireSupabase } from "./supabase.js";

const optional = (value) => String(value || "").trim() || null;

function pageId(index) {
  if (globalThis.crypto?.randomUUID) return `page_${globalThis.crypto.randomUUID()}`;
  return `page_${Date.now()}_${index}_${Math.random().toString(16).slice(2)}`;
}

function cleanHtml(value) {
  return String(value || "").trim() || "<p><br></p>";
}

function normalizePage(page, index) {
  return {
    id: String(page?.id || pageId(index)),
    html: cleanHtml(page?.html ?? page?.content ?? ""),
  };
}

export function createEmptyNote(title = "Nova anotação") {
  const now = new Date().toISOString();
  return {
    version: 1,
    format: "akademo-document",
    metadata: {
      title: String(title || "Nova anotação").trim() || "Nova anotação",
      created_at: now,
      updated_at: now,
    },
    document: {
      page_size: "a4",
      pages: [normalizePage(null, 0)],
    },
  };
}

export function normalizeNote(value, title = "Anotação") {
  const source = value && typeof value === "object" ? value : {};
  const sourcePages = Array.isArray(source?.document?.pages)
    ? source.document.pages
    : Array.isArray(source.pages)
      ? source.pages
      : [];
  const base = createEmptyNote(title);
  const pages = sourcePages.length ? sourcePages.map(normalizePage) : base.document.pages;
  return {
    version: 1,
    format: "akademo-document",
    metadata: {
      title: String(source?.metadata?.title || source?.title || title || "Anotação").trim() || "Anotação",
      created_at: String(source?.metadata?.created_at || source?.created_at || base.metadata.created_at),
      updated_at: String(source?.metadata?.updated_at || source?.updated_at || base.metadata.updated_at),
    },
    document: { page_size: "a4", pages },
  };
}

function association(values) {
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
  const titulo = String(values.title ?? values.titulo ?? previous.titulo ?? "").trim();
  if (!titulo) throw new Error("Informe um título para a anotação.");
  const disciplina = optional(values.disciplineId ?? values.disciplina ?? previous.disciplina);
  const links = association({
    lessonId: values.lessonId ?? values.aula ?? previous.aula,
    examId: values.examId ?? values.prova ?? previous.prova,
    presentationId: values.presentationId ?? values.apresentacao ?? previous.apresentacao,
  });
  if (!disciplina && Object.values(links).some(Boolean)) {
    throw new Error("Escolha uma disciplina antes de vincular uma atividade.");
  }
  const anotacao = normalizeNote(values.note ?? values.anotacao ?? previous.anotacao, titulo);
  anotacao.metadata.title = titulo;
  anotacao.metadata.created_at = previous.anotacao?.metadata?.created_at || anotacao.metadata.created_at;
  anotacao.metadata.updated_at = new Date().toISOString();
  return {
    email_user: user.email,
    perfil: profile.id,
    disciplina,
    ...links,
    titulo,
    anotacao,
  };
}

function record(note) {
  if (!note) return note;
  return { ...note, anotacao: normalizeNote(note.anotacao, note.titulo) };
}

export async function getNotes(profileId) {
  const { data, error } = await requireSupabase()
    .from("anotacoes")
    .select("*")
    .eq("perfil", profileId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(record);
}

export async function createNote(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("anotacoes")
    .insert(payload(user, profile, values))
    .select()
    .single();
  if (error) throw error;
  return record(data);
}

export async function updateNote(id, user, profile, previous, values) {
  const next = payload(user, profile, values, previous);
  delete next.email_user;
  delete next.perfil;
  const { data, error } = await requireSupabase()
    .from("anotacoes")
    .update(next)
    .eq("id", id)
    .eq("perfil", profile.id)
    .select()
    .single();
  if (error) throw error;
  return record(data);
}

export async function deleteNote(id, profileId) {
  const { error } = await requireSupabase()
    .from("anotacoes")
    .delete()
    .eq("id", id)
    .eq("perfil", profileId);
  if (error) throw error;
}
