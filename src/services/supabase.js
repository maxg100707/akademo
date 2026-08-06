import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "../config.js";

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // O callback OAuth é tratado explicitamente em auth.js antes de a interface renderizar.
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error("Configure a URL e uma chave anon válidas em src/config.js antes de usar o AKADEMO.");
  return supabase;
}
