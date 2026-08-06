import { APP_STORAGE_KEYS } from "../config.js";

export const escapeHtml = (value = "") =>
  String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);

export const firstName = (name = "") => name.trim().split(/\s+/)[0] || "estudante";

export const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";

export function profileLabel(profile) {
  return profile ? `${profile.curso} · ${profile.semestre}º semestre` : "Sem perfil";
}

export function getStoredProfile() {
  try { return JSON.parse(localStorage.getItem(APP_STORAGE_KEYS.currentProfile)); } catch { return null; }
}

export function storeProfile(profile) {
  localStorage.setItem(APP_STORAGE_KEYS.currentProfile, JSON.stringify(profile));
}

export function removeStoredProfile() {
  localStorage.removeItem(APP_STORAGE_KEYS.currentProfile);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function extensionFromFile(file) {
  const fromName = file?.name?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  return file?.type?.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
}
