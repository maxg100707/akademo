import { requireSupabase } from "./supabase.js";

export const MIND_MAP_COLORS = ["#16895d", "#1877c9", "#7c3aed", "#c26412", "#c2415b", "#177d78"];
export const MIND_MAP_SHAPES = ["rounded", "rect", "ellipse", "diamond"];
export const MIND_MAP_SIZES = ["small", "medium", "large"];
export const MIND_MAP_CONNECTION_SIDES = ["auto", "top", "right", "bottom", "left"];

const optional = (value) => String(value || "").trim() || null;

function nodeId() {
  if (globalThis.crypto?.randomUUID) return `node_${globalThis.crypto.randomUUID()}`;
  return `node_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function connectionId() {
  if (globalThis.crypto?.randomUUID) return `connection_${globalThis.crypto.randomUUID()}`;
  return `connection_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textStyle(value = {}) {
  return {
    bold: Boolean(value?.bold),
    italic: Boolean(value?.italic),
    font_size: Math.max(10, Math.min(48, Math.round(number(value?.font_size ?? value?.fontSize, 16)))),
  };
}

function normalizeNode(raw, index, title) {
  const shape = MIND_MAP_SHAPES.includes(raw?.shape) ? raw.shape : "rounded";
  const style = raw?.style === "sticky" ? "sticky" : "normal";
  return {
    id: String(raw?.id || `node_${index + 1}`),
    parent_id: raw?.parent_id || raw?.parentId || null,
    x: Math.max(0, number(raw?.x, index ? 390 : 120)),
    y: Math.max(0, number(raw?.y, index ? 180 + index * 90 : 270)),
    text: String(raw?.text || (index ? "Novo tópico" : title || "Mapa mental")).trim() || "Novo tópico",
    color: MIND_MAP_COLORS.includes(raw?.color) ? raw.color : MIND_MAP_COLORS[index % MIND_MAP_COLORS.length],
    shape,
    style,
    size: MIND_MAP_SIZES.includes(raw?.size) ? raw.size : "medium",
    connection_in: MIND_MAP_CONNECTION_SIDES.includes(raw?.connection_in || raw?.connectionIn) ? (raw?.connection_in || raw?.connectionIn) : "auto",
    connection_out: MIND_MAP_CONNECTION_SIDES.includes(raw?.connection_out || raw?.connectionOut) ? (raw?.connection_out || raw?.connectionOut) : "auto",
    text_style: textStyle(raw?.text_style || raw?.textStyle),
  };
}

function normalizeConnection(raw, index, ids) {
  const sourceId = String(raw?.source_id || raw?.sourceId || raw?.source || raw?.from || "");
  const targetId = String(raw?.target_id || raw?.targetId || raw?.target || raw?.to || "");
  if (!ids.has(sourceId) || !ids.has(targetId) || sourceId === targetId) return null;
  const sourceSide = raw?.source_side || raw?.sourceSide || raw?.from_side || raw?.fromSide || "auto";
  const targetSide = raw?.target_side || raw?.targetSide || raw?.to_side || raw?.toSide || "auto";
  return {
    id: String(raw?.id || `connection_${index + 1}`),
    source_id: sourceId,
    target_id: targetId,
    source_side: MIND_MAP_CONNECTION_SIDES.includes(sourceSide) ? sourceSide : "auto",
    target_side: MIND_MAP_CONNECTION_SIDES.includes(targetSide) ? targetSide : "auto",
  };
}

export function normalizeMindMap(raw, title = "Mapa mental") {
  const source = raw && typeof raw === "object" ? raw : {};
  const sourceNodes = Array.isArray(source.nodes) ? source.nodes : Array.isArray(source.mapa) ? source.mapa : [];
  const nodes = sourceNodes.length
    ? sourceNodes.map((node, index) => normalizeNode(node, index, title))
    : [normalizeNode({ id: "root", x: 115, y: 270, text: title, color: MIND_MAP_COLORS[0], text_style: { bold: true, font_size: 18 } }, 0, title)];

  const ids = new Set();
  nodes.forEach((node, index) => {
    while (ids.has(node.id)) node.id = `${node.id}_${index + 1}`;
    ids.add(node.id);
  });
  const root = nodes.find((node) => node.id === String(source.root_id || source.rootId || ""))
    || nodes.find((node) => node.id === "root")
    || nodes.find((node) => node.style !== "sticky" && (!node.parent_id || !ids.has(node.parent_id) || node.parent_id === node.id))
    || nodes.find((node) => !node.parent_id || !ids.has(node.parent_id) || node.parent_id === node.id)
    || nodes[0];
  root.style = "normal";
  const hasExplicitConnections = Array.isArray(source.connections) || Array.isArray(source.links);
  const rawConnections = Array.isArray(source.connections) ? source.connections : Array.isArray(source.links) ? source.links : [];
  const connections = hasExplicitConnections
    ? rawConnections.map((connection, index) => normalizeConnection(connection, index, ids)).filter(Boolean)
    : nodes.filter((node) => node.parent_id && ids.has(node.parent_id) && node.parent_id !== node.id).map((node, index) => ({
      id: `legacy_connection_${index + 1}`,
      source_id: node.parent_id,
      target_id: node.id,
      source_side: MIND_MAP_CONNECTION_SIDES.includes(nodes.find((item) => item.id === node.parent_id)?.connection_out) ? nodes.find((item) => item.id === node.parent_id).connection_out : "auto",
      target_side: MIND_MAP_CONNECTION_SIDES.includes(node.connection_in) ? node.connection_in : "auto",
    }));
  const connectionIds = new Set();
  connections.forEach((connection, index) => {
    while (connectionIds.has(connection.id)) connection.id = `${connection.id}_${index + 1}`;
    connectionIds.add(connection.id);
  });
  nodes.forEach((node) => {
    delete node.parent_id;
    delete node.connection_in;
    delete node.connection_out;
  });
  return {
    titulo: String(source.titulo || title || "Mapa mental").trim() || "Mapa mental",
    descricao: String(source.descricao || "").trim(),
    updated_at: String(source.updated_at || ""),
    root_id: root.id,
    nodes,
    connections,
  };
}

function association(values) {
  const links = [
    ["aula", values.lessonId],
    ["prova", values.examId],
    ["apresentacao", values.presentationId],
  ].filter(([, value]) => Boolean(value));
  if (links.length > 1) throw new Error("Escolha apenas uma aula, prova ou apresentação para o mapa.");
  return Object.fromEntries(["aula", "prova", "apresentacao"].map((key) => [key, links.find(([kind]) => kind === key)?.[1] || null]));
}

function payload(user, profile, values, previous = {}) {
  const tema = String(values.theme || values.tema || "").trim();
  if (!tema) throw new Error("Informe o tema do mapa mental.");
  const disciplina = optional(values.disciplineId ?? values.disciplina ?? previous.disciplina);
  const links = association({
    lessonId: values.lessonId ?? values.aula ?? previous.aula,
    examId: values.examId ?? values.prova ?? previous.prova,
    presentationId: values.presentationId ?? values.apresentacao ?? previous.apresentacao,
  });
  if (!disciplina && Object.values(links).some(Boolean)) throw new Error("Selecione uma disciplina antes de vincular o mapa a uma atividade.");
  const mapa = normalizeMindMap(values.map || values.mapa || previous.mapa, tema);
  mapa.titulo = tema;
  mapa.descricao = String(values.description ?? values.descricao ?? previous.descricao ?? "").trim();
  mapa.updated_at = new Date().toISOString();
  return {
    email_user: user.email,
    perfil: profile.id,
    disciplina,
    ...links,
    tema,
    descricao: optional(mapa.descricao),
    mapa,
  };
}

function record(item) {
  if (!item) return item;
  return { ...item, mapa: normalizeMindMap(item.mapa, item.tema), descricao: item.descricao || "" };
}

export async function getMindMaps(profileId) {
  const { data, error } = await requireSupabase().from("mapas_mentais").select("*").eq("perfil", profileId).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(record);
}

export async function createMindMap(user, profile, values) {
  const { data, error } = await requireSupabase().from("mapas_mentais").insert(payload(user, profile, values)).select().single();
  if (error) throw error;
  return record(data);
}

export async function updateMindMap(id, user, profile, previous, values) {
  const next = payload(user, profile, values, previous);
  delete next.email_user;
  delete next.perfil;
  const { data, error } = await requireSupabase().from("mapas_mentais").update(next).eq("id", id).eq("perfil", profile.id).select().single();
  if (error) throw error;
  return record(data);
}

export async function deleteMindMap(id, profileId) {
  const { error } = await requireSupabase().from("mapas_mentais").delete().eq("id", id).eq("perfil", profileId);
  if (error) throw error;
}

export function createMapNode({ x = 400, y = 250, text = "Novo tópico", color = MIND_MAP_COLORS[0], style = "normal" } = {}) {
  return { id: nodeId(), x, y, text, color, shape: "rounded", style, size: "medium", text_style: textStyle({}) };
}

export function createMapConnection({ sourceId, targetId, sourceSide = "auto", targetSide = "auto" } = {}) {
  return { id: connectionId(), source_id: sourceId, target_id: targetId, source_side: sourceSide, target_side: targetSide };
}
