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
  {
    id: "quick-actions",
    label: "Ações rápidas",
    description: "Exibe até seis atalhos para iniciar tarefas frequentes.",
  },
];

export const DASHBOARD_QUICK_ACTIONS = [
  { id: "create-lesson", label: "Cadastrar aula", iconName: "book" },
  { id: "add-file", label: "Adicionar arquivo", iconName: "upload" },
  { id: "add-task", label: "Adicionar tarefa", iconName: "check" },
  { id: "create-exam", label: "Cadastrar prova", iconName: "exam" },
  { id: "create-presentation", label: "Cadastrar apresentação", iconName: "presentation" },
  { id: "create-mindmap", label: "Criar mapa mental", iconName: "mindMap" },
  { id: "create-note", label: "Criar anotação", iconName: "note" },
  { id: "create-glossary", label: "Registrar termo", iconName: "glossary" },
  { id: "create-video", label: "Registrar vídeo", iconName: "video" },
  { id: "cycle-palette", label: "Mudar temática", iconName: "sparkles" },
  { id: "create-contact", label: "Novo contato", iconName: "users" },
];

const WIDGET_IDS = new Set(DASHBOARD_WIDGETS.map((widget) => widget.id));
const QUICK_ACTION_IDS = new Set(DASHBOARD_QUICK_ACTIONS.map((action) => action.id));
const PALETTE_IDS = new Set(["forest", "flames", "cosmic"]);
const MODULE_IDS = new Set([
  "schedules",
  "lessons",
  "chronogram",
  "tasks",
  "exams",
  "presentations",
  "files",
  "mindmaps",
  "notes",
  "glossary",
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
    appearance: {
      palette: "forest",
    },
    dashboard: {
      widgets: defaultWidgets(),
      favorites: [],
      quickActions: [],
    },
  };
}

export function normalizePalette(value) {
  return PALETTE_IDS.has(value) ? value : "forest";
}

export function normalizeSettings(input) {
  const source = input && typeof input === "object" ? input : {};
  const appearance = source.appearance && typeof source.appearance === "object"
    ? source.appearance
    : {};
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
  const quickActions = Array.isArray(dashboard.quickActions)
    ? dashboard.quickActions
      .filter((id, index, values) => QUICK_ACTION_IDS.has(id) && values.indexOf(id) === index)
      .slice(0, 6)
    : [];

  return {
    version: 1,
    appearance: {
      palette: normalizePalette(appearance.palette),
    },
    dashboard: {
      widgets: [...orderedKnownWidgets, ...missingWidgets],
      favorites,
      quickActions,
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
