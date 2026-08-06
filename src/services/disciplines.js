import { requireSupabase } from "./supabase.js";

const normalizeOptional = (value) => value?.trim() || null;

function disciplinePayload(user, profile, values) {
  return {
    email_user: user.email,
    perfil: profile.id,
    nome_disciplina: values.name.trim(),
    resumo_disciplina: normalizeOptional(values.summary),
    professor_id: values.teacherId,
  };
}

export async function getDisciplines(profileId) {
  const { data, error } = await requireSupabase()
    .from("disciplinas")
    .select("*")
    .eq("perfil", profileId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createDiscipline(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("disciplinas")
    .insert(disciplinePayload(user, profile, values))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDiscipline(id, profileId, values) {
  const { data, error } = await requireSupabase()
    .from("disciplinas")
    .update({
      nome_disciplina: values.name.trim(),
      resumo_disciplina: normalizeOptional(values.summary),
      professor_id: values.teacherId,
    })
    .eq("id", id)
    .eq("perfil", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDiscipline(id, profileId) {
  const { error } = await requireSupabase()
    .from("disciplinas")
    .delete()
    .eq("id", id)
    .eq("perfil", profileId);
  if (error) throw error;
}
