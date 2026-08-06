/*
 * Copie os valores do painel do Supabase (Settings > API) para este arquivo.
 * A chave anon é pública por design; nunca coloque a service_role no front-end.
 */
export const SUPABASE_URL = "https://pihyudhkkanirwbxingc.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpaHl1ZGhra2FuaXJ3YnhpbmdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NjcxOTMsImV4cCI6MjEwMTU0MzE5M30.ssdWSt0WqEMLaaQGd__RakIkwMTtiE1MgglHF3sCnN8";

export const APP_STORAGE_KEYS = {
  theme: "akademo.theme",
  currentProfile: "akademo.current_profile",
  login: "akademo.login",
  pendingAvatar: "akademo.pending_avatar",
};

export const isSupabaseConfigured = () =>
  SUPABASE_URL.startsWith("https://") && !SUPABASE_ANON_KEY.startsWith("COLE_");
