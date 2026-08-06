import { APP_STORAGE_KEYS } from "../config.js";
import { requireSupabase } from "./supabase.js";

const redirectTo = `${window.location.origin}${window.location.pathname}`;

export async function currentSession() {
  const { data, error } = await requireSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function completeOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
  const providerError = params.get("error_description") || params.get("error") || hashParams.get("error_description") || hashParams.get("error");
  if (providerError) {
    if (providerError.includes("Unable to exchange external code")) {
      throw new Error("O Google autorizou a conta, mas o Supabase não conseguiu validá-la. Em Authentication > Providers > Google, cole novamente o Client ID e o Client Secret do mesmo cliente OAuth Web criado no Google Cloud.");
    }
    throw new Error(providerError);
  }
  const code = params.get("code");
  const client = requireSupabase();
  let result;

  if (code) {
    // Callback PKCE: ?code=... precisa ser trocado pela sessão usando o verifier salvo pelo SDK.
    result = await client.auth.exchangeCodeForSession(code);
  } else {
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (!accessToken || !refreshToken) return null;
    // Callback implícito: tokens chegam no fragmento da URL (#access_token=...).
    result = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }

  if (result.error) throw result.error;
  // Não deixe códigos ou tokens temporários visíveis na URL depois de criar a sessão.
  window.history.replaceState({}, document.title, window.location.pathname);
  return result.data.session;
}

export async function signIn(email, password) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp({ name, email, password }) {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: redirectTo },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // Força a tela de escolha de conta, mesmo quando o navegador já tem uma conta Google ativa.
      queryParams: { access_type: "offline", prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();
  if (error) throw error;
  localStorage.removeItem(APP_STORAGE_KEYS.login);
  localStorage.removeItem(APP_STORAGE_KEYS.currentProfile);
}

export function onAuthChange(callback) {
  return requireSupabase().auth.onAuthStateChange(callback);
}
