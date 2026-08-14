import { requireSupabase } from "./supabase.js";
import { digitsOnly } from "../utils/phone.js";

export const CONTACT_TYPES = [
  { value: 0, label: "Diretor" },
  { value: 1, label: "Coordenador" },
  { value: 2, label: "Mentor" },
  { value: 3, label: "Funcionário" },
  { value: 4, label: "Aluno" },
  { value: 5, label: "Outro" },
];

const normalizeOptional = (value) => value?.trim() || null;
const normalizePhone = (value) => digitsOnly(value) || null;

function contactPayload(user, profile, values) {
  const type = Number(values.type);
  if (!CONTACT_TYPES.some((item) => item.value === type)) {
    throw new Error("Selecione um tipo de contato válido.");
  }
  return {
    email_user: user.email,
    perfil: profile.id,
    nome: values.name.trim(),
    tipo: type,
    telefone: normalizePhone(values.phone),
    email: normalizeOptional(values.email),
    obs: normalizeOptional(values.observations),
  };
}

export async function getContacts(profileId) {
  const { data, error } = await requireSupabase()
    .from("contatos")
    .select("*")
    .eq("perfil", profileId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createContact(user, profile, values) {
  const { data, error } = await requireSupabase()
    .from("contatos")
    .insert(contactPayload(user, profile, values))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateContact(id, profileId, values) {
  const type = Number(values.type);
  if (!CONTACT_TYPES.some((item) => item.value === type)) {
    throw new Error("Selecione um tipo de contato válido.");
  }
  const { data, error } = await requireSupabase()
    .from("contatos")
    .update({
      nome: values.name.trim(),
      tipo: type,
      telefone: normalizePhone(values.phone),
      email: normalizeOptional(values.email),
      obs: normalizeOptional(values.observations),
    })
    .eq("id", id)
    .eq("perfil", profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteContact(id, profileId) {
  const { error } = await requireSupabase()
    .from("contatos")
    .delete()
    .eq("id", id)
    .eq("perfil", profileId);
  if (error) throw error;
}
