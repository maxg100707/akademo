import { requireSupabase } from "./supabase.js";
import { digitsOnly } from "../utils/phone.js";

const normalizeOptional = (value) => value?.trim() || null;
const normalizePhone = (value) => digitsOnly(value) || null;

function teacherPayload(user, profile, values) {
  return {
    email_user: user.email,
    perfil: profile.id,
    nome_professor: values.name.trim(),
    email_professor: normalizeOptional(values.email),
    telefone_professor: normalizePhone(values.phone),
    obs: normalizeOptional(values.observations),
  };
}

export async function getTeachers(profileId) {
  const { data, error } = await requireSupabase()
    .from("professores")
    .select("*")
    .eq("perfil", profileId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createTeacher(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("professores")
    .insert(teacherPayload(user, profile, values))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTeacher(id, profileId, values) {
  const { data, error } = await requireSupabase()
    .from("professores")
    .update({
      nome_professor: values.name.trim(),
      email_professor: normalizeOptional(values.email),
      telefone_professor: normalizePhone(values.phone),
      obs: normalizeOptional(values.observations),
    })
    .eq("id", id)
    .eq("perfil", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeacher(id, profileId) {
  const { error } = await requireSupabase()
    .from("professores")
    .delete()
    .eq("id", id)
    .eq("perfil", profileId);
  if (error) throw error;
}
