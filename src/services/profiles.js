import { requireSupabase } from "./supabase.js";

export async function getProfiles(userId) {
  const { data, error } = await requireSupabase().from("perfil_estudo").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createStudyProfile(user, values) {
  const payload = {
    user_id: user.id, email: user.email,
    instituicao: values.institution.trim(), curso: values.course.trim(), semestre: Number(values.semester),
  };
  const { data, error } = await requireSupabase().from("perfil_estudo").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateStudyProfile(id, values) {
  const { data, error } = await requireSupabase().from("perfil_estudo").update({
    instituicao: values.institution.trim(), curso: values.course.trim(), semestre: Number(values.semester),
  }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteStudyProfile(id) {
  const { error } = await requireSupabase().from("perfil_estudo").delete().eq("id", id);
  if (error) throw error;
}
