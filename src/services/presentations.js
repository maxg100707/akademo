import { requireSupabase } from "./supabase.js";

const optional = (value) => String(value || "").trim() || null;

function iso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()))
    throw new Error("Escolha uma data de apresentação válida.");
  return date.toISOString();
}

function normalizeLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => ({
      titulo: String(link?.titulo || "").trim(),
      url: String(link?.url || "").trim(),
    }))
    .filter((link) => link.titulo && link.url);
}

function normalizeContentIds(contents) {
  return [
    ...new Set(
      (Array.isArray(contents) ? contents : []).map(String).filter(Boolean),
    ),
  ];
}

export async function getPresentations(profileId) {
  const { data, error } = await requireSupabase()
    .from("apresentacoes")
    .select("*")
    .eq("perfil", profileId)
    .order("data", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createPresentation(user, profile, values) {
  const title = String(values.title || "").trim();
  if (!title) throw new Error("Informe o título da apresentação.");
  const { data, error } = await requireSupabase()
    .from("apresentacoes")
    .insert({
      email_user: user.email,
      perfil: profile.id,
      disciplina: values.disciplineId,
      cronograma: values.chronogramId,
      titulo: title,
      data: iso(values.dateTime),
      instrucao: null,
      links: [],
      conteudos: [],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePresentation(id, user, profile, presentation, values) {
  const { data, error } = await requireSupabase()
    .from("apresentacoes")
    .update({
      instrucao: optional(values.instructions),
      links: normalizeLinks(values.links),
      conteudos: normalizeContentIds(values.contents),
    })
    .eq("id", id)
    .eq("perfil", profile.id)
    .eq("disciplina", presentation.disciplina)
    .eq("email_user", user.email)
    .select()
    .single();
  if (error) throw error;
  return data;
}
