import { requireSupabase } from "./supabase.js";

function profilePeriod(values) {
  if (!values.startDate || !values.endDate) throw new Error("Informe as datas de início e fim do perfil.");
  const start = new Date(`${values.startDate}T00:00:00`);
  const end = new Date(`${values.endDate}T23:59:59.999`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end < start) {
    throw new Error("A data de fim deve ser igual ou posterior à data de início.");
  }
  return { data_inicio: start.toISOString(), data_fim: end.toISOString() };
}

export async function getProfiles(userId) {
  const { data, error } = await requireSupabase().from("perfil_estudo").select("*").eq("user_id", userId).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createStudyProfile(user, values) {
  const payload = {
    user_id: user.id, email: user.email,
    instituicao: values.institution.trim(), curso: values.course.trim(), semestre: Number(values.semester),
    ...profilePeriod(values),
  };
  const { data, error } = await requireSupabase().from("perfil_estudo").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateStudyProfile(id, values) {
  const { data, error } = await requireSupabase().from("perfil_estudo").update({
    instituicao: values.institution.trim(), curso: values.course.trim(), semestre: Number(values.semester),
    ...profilePeriod(values),
  }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteStudyProfile(id) {
  const { error } = await requireSupabase().from("perfil_estudo").delete().eq("id", id);
  if (error) throw error;
}
