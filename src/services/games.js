import { requireSupabase } from "./supabase.js";

const MAX_HISTORY = 60;

export function defaultGameData() {
  return {
    version: 1,
    games: {
      calculations: {
        totalCorrect: 0,
        totalIncorrect: 0,
        totalGames: 0,
        highestScore: 0,
        longestStreak: 0,
        lastPlayedAt: null,
        history: [],
      },
    },
  };
}

function safeInteger(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : fallback;
}

export function normalizeGameData(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const gameEntries = source.games && typeof source.games === "object" && !Array.isArray(source.games)
    ? source.games
    : {};
  const calculations = gameEntries.calculations && typeof gameEntries.calculations === "object"
    ? source.games.calculations
    : {};
  const history = Array.isArray(calculations.history)
    ? calculations.history
      .filter((entry) => entry && typeof entry === "object")
      .slice(0, MAX_HISTORY)
      .map((entry) => ({
        id: String(entry.id || ""),
        playedAt: entry.playedAt || null,
        score: safeInteger(entry.score),
        correct: safeInteger(entry.correct),
        incorrect: safeInteger(entry.incorrect),
        largestStreak: safeInteger(entry.largestStreak),
        totalQuestions: safeInteger(entry.totalQuestions),
        settings: {
          size: ["small", "medium", "large"].includes(entry.settings?.size) ? entry.settings.size : "small",
          answerMode: ["written", "choices", "both"].includes(entry.settings?.answerMode) ? entry.settings.answerMode : "written",
          rules: {
            power: Boolean(entry.settings?.rules?.power),
            squareRoot: Boolean(entry.settings?.rules?.squareRoot),
            equations: Boolean(entry.settings?.rules?.equations),
            factorial: Boolean(entry.settings?.rules?.factorial),
            maxPower: Math.min(6, Math.max(2, safeInteger(entry.settings?.rules?.maxPower, 3))),
          },
        },
      }))
    : [];
  const futureGames = Object.fromEntries(
    Object.entries(gameEntries).filter(([key]) => key !== "calculations"),
  );
  return {
    ...source,
    version: Math.max(1, safeInteger(source.version, 1)),
    games: {
      ...futureGames,
      calculations: {
        totalCorrect: safeInteger(calculations.totalCorrect),
        totalIncorrect: safeInteger(calculations.totalIncorrect),
        totalGames: safeInteger(calculations.totalGames),
        highestScore: safeInteger(calculations.highestScore),
        longestStreak: safeInteger(calculations.longestStreak),
        lastPlayedAt: calculations.lastPlayedAt || null,
        history,
      },
    },
  };
}

export async function getGameData(profileId) {
  const { data, error } = await requireSupabase()
    .from("dados_jogos")
    .select("dados")
    .eq("perfil", profileId)
    .maybeSingle();
  if (error) throw error;
  return normalizeGameData(data?.dados);
}

export async function saveGameData(user, profile, data) {
  const normalized = normalizeGameData(data);
  const { data: saved, error } = await requireSupabase()
    .from("dados_jogos")
    .upsert({
      email_user: user.email,
      perfil: profile.id,
      dados: normalized,
    }, { onConflict: "perfil" })
    .select("dados")
    .single();
  if (error) throw error;
  return normalizeGameData(saved?.dados);
}

export function appendCalculationGame(previous, game) {
  const data = normalizeGameData(previous);
  const current = data.games.calculations;
  const entry = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `game-${Date.now()}`,
    playedAt: new Date().toISOString(),
    score: safeInteger(game.score),
    correct: safeInteger(game.correct),
    incorrect: safeInteger(game.incorrect),
    largestStreak: safeInteger(game.largestStreak),
    totalQuestions: safeInteger(game.totalQuestions),
    settings: game.settings,
  };
  return normalizeGameData({
    version: 1,
    games: {
      calculations: {
        totalCorrect: current.totalCorrect + entry.correct,
        totalIncorrect: current.totalIncorrect + entry.incorrect,
        totalGames: current.totalGames + 1,
        highestScore: Math.max(current.highestScore, entry.score),
        longestStreak: Math.max(current.longestStreak, entry.largestStreak),
        lastPlayedAt: entry.playedAt,
        history: [entry, ...current.history].slice(0, MAX_HISTORY),
      },
    },
  });
}
