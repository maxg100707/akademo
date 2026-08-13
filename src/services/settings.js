import { requireSupabase } from "./supabase.js";

export const DASHBOARD_WIDGETS = [
  {
    id: "next-class",
    label: "Próxima aula",
    description: "Exibe a aula atual ou o próximo encontro da sua grade.",
  },
  {
    id: "academic-calendar",
    label: "Calendário acadêmico",
    description: "Reúne tarefas, provas e apresentações próximas.",
  },
  {
    id: "favorites",
    label: "Favoritos",
    description: "Fixa até quatro módulos para acesso rápido.",
  },
  {
    id: "schedules",
    label: "Horários",
    description: "Mostra uma miniatura prática da grade semanal.",
  },
  {
    id: "recent-lessons",
    label: "Últimas aulas",
    description: "Mostra as quatro aulas registradas mais recentes.",
  },
];

const WIDGET_IDS = new Set(DASHBOARD_WIDGETS.map((widget) => widget.id));
const MODULE_IDS = new Set([
  "schedules",
  "lessons",
  "chronogram",
  "tasks",
  "exams",
  "presentations",
  "files",
  "mindmaps",
  "videos",
  "disciplines",
  "teachers",
  "profiles",
]);

const SETTINGS_CACHE_PREFIX = "akademo.settings.v1";

function settingsCacheKey(user, profileId) {
  const userId = typeof user === "string" ? user : user?.id;
  if (!userId || !profileId) return "";
  return `${SETTINGS_CACHE_PREFIX}:${userId}:${profileId}`;
}

function readSettingsCache(user, profileId) {
  const key = settingsCacheKey(user, profileId);
  if (!key || typeof localStorage === "undefined") return null;
  try {
    const cached = JSON.parse(localStorage.getItem(key) || "null");
    return cached?.config && typeof cached.config === "object"
      ? normalizeSettings(cached.config)
      : null;
  } catch {
    return null;
  }
}

function writeSettingsCache(user, profileId, config) {
  const key = settingsCacheKey(user, profileId);
  if (!key || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), config: normalizeSettings(config) }));
  } catch {
    // O Supabase continua sendo a fonte segura caso o navegador não tenha espaço para cache.
  }
}

function defaultWidgets() {
  return DASHBOARD_WIDGETS.map((widget) => ({
    id: widget.id,
    enabled: widget.id === "next-class" || widget.id === "academic-calendar",
  }));
}

export function defaultSettings() {
  return {
    version: 1,
    dashboard: {
      widgets: defaultWidgets(),
      favorites: [],
    },
  };
}

export function normalizeSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  const dashboard = source.dashboard && typeof source.dashboard === "object"
    ? source.dashboard
    : {};
  const savedWidgets = Array.isArray(dashboard.widgets) ? dashboard.widgets : [];
  const widgetsById = new Map(
    savedWidgets
      .filter((widget) => widget && WIDGET_IDS.has(widget.id))
      .map((widget) => [widget.id, { id: widget.id, enabled: Boolean(widget.enabled) }]),
  );
  const orderedKnownWidgets = savedWidgets
    .map((widget) => widget?.id)
    .filter((id, index, values) => WIDGET_IDS.has(id) && values.indexOf(id) === index)
    .map((id) => widgetsById.get(id));
  const missingWidgets = DASHBOARD_WIDGETS
    .filter((widget) => !widgetsById.has(widget.id))
    .map((widget) => ({
      id: widget.id,
      enabled: widget.id === "next-class" || widget.id === "academic-calendar",
    }));
  const favorites = Array.isArray(dashboard.favorites)
    ? dashboard.favorites
      .filter((id, index, values) => MODULE_IDS.has(id) && values.indexOf(id) === index)
      .slice(0, 4)
    : [];

  return {
    version: 1,
    dashboard: {
      widgets: [...orderedKnownWidgets, ...missingWidgets],
      favorites,
    },
  };
}

function settingsMigrationMessage(error) {
  if (error?.code === "42P01") {
    return new Error("Execute a migration configuracoes-migration.sql no Supabase para salvar as configurações.");
  }
  return error;
}

export async function getSettings(user, profileId) {
  const cached = readSettingsCache(user, profileId);
  if (cached) return cached;
  const { data, error } = await requireSupabase()
    .from("configuracoes")
    .select("config")
    .eq("perfil", profileId)
    .maybeSingle();
  if (error) throw settingsMigrationMessage(error);
  const normalized = normalizeSettings(data?.config);
  writeSettingsCache(user, profileId, normalized);
  return normalized;
}

export async function saveSettings(user, profile, config) {
  const normalized = normalizeSettings(config);
  const { data, error } = await requireSupabase()
    .from("configuracoes")
    .upsert(
      {
        email_user: user.email,
        perfil: profile.id,
        config: normalized,
      },
      { onConflict: "perfil" },
    )
    .select("config")
    .single();
  if (error) throw settingsMigrationMessage(error);
  const normalizedSaved = normalizeSettings(data?.config);
  writeSettingsCache(user, profile.id, normalizedSaved);
  return normalizedSaved;
}
