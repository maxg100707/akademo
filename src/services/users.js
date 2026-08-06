import { APP_STORAGE_KEYS } from "../config.js";
import { extensionFromFile } from "../utils/formatters.js";
import { requireSupabase } from "./supabase.js";

export async function getUserRecord(userId) {
  const { data, error } = await requireSupabase().from("users").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureUserRecord(user) {
  const client = requireSupabase();
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Estudante";
  const { error } = await client.from("users").upsert({ id: user.id, email: user.email, nome: name }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
  return getUserRecord(user.id);
}

export async function updatePersonalInfo(user, { name, photoFile }) {
  const client = requireSupabase();
  let photoPath;
  if (photoFile) {
    await provisionUserStorage();
    const extension = extensionFromFile(photoFile);
    const bucket = user.email;
    const path = `foto_perfil_akademo.${extension}`;
    const { error: uploadError } = await client.storage.from(bucket).upload(path, photoFile, {
      upsert: true, contentType: photoFile.type || "image/*", cacheControl: "3600",
    });
    if (uploadError) throw uploadError;
    photoPath = `${bucket}/${path}`;
  }
  const changes = { nome: name.trim() };
  if (photoPath) changes.foto_perfil_path = photoPath;
  const { data, error } = await client.from("users").update(changes).eq("id", user.id).select().single();
  if (error) throw error;
  await client.auth.updateUser({ data: { full_name: name.trim() } });
  return data;
}

export async function provisionUserStorage() {
  const { data, error } = await requireSupabase().functions.invoke("provision-user-storage");
  if (error) throw error;
  return data;
}

export async function applyPendingAvatar(user) {
  const raw = localStorage.getItem(APP_STORAGE_KEYS.pendingAvatar);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw);
    if (pending.email !== user.email || !pending.dataUrl) return null;
    const response = await fetch(pending.dataUrl);
    const blob = await response.blob();
    const file = new File([blob], pending.fileName || "foto_perfil_akademo.jpg", { type: pending.type || blob.type });
    const record = await updatePersonalInfo(user, { name: pending.name, photoFile: file });
    localStorage.removeItem(APP_STORAGE_KEYS.pendingAvatar);
    return record;
  } catch {
    localStorage.removeItem(APP_STORAGE_KEYS.pendingAvatar);
    return null;
  }
}

export async function profilePhotoUrl(record) {
  if (!record?.foto_perfil_path) return null;
  if (record.foto_perfil_path.startsWith("http")) return record.foto_perfil_path;
  const slash = record.foto_perfil_path.indexOf("/");
  if (slash < 1) return null;
  const bucket = record.foto_perfil_path.slice(0, slash);
  const path = record.foto_perfil_path.slice(slash + 1);
  const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrl(path, 60 * 30);
  return error ? null : data.signedUrl;
}
