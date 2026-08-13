import {
  MIND_MAP_COLORS,
  MIND_MAP_SHAPES,
  MIND_MAP_SIZES,
  createMapConnection,
  createMapNode,
  normalizeMindMap,
} from "../services/mindmaps.js";
import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import {
  closeModal,
  confirmModal,
  setButtonLoading,
  showToast,
  unsavedModal,
} from "./components.js";

const shapeNames = {
  rounded: "Arredondado",
  rect: "Retângulo",
  ellipse: "Elipse",
  diamond: "Losango",
};
const sizeNames = { small: "Pequeno", medium: "Médio", large: "Grande" };
const NODE_SIDES = ["top", "right", "bottom", "left"];
const NODE_LAYOUT = {
  regular: { width: 264, height: 124 },
  sticky: { width: 258, height: 138 },
  diamond: { width: 194, height: 194 },
  levelGap: 146,
  slotHeight: 166,
  padding: 76,
};

function normalized(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function activityFor(map, references) {
  const discipline = references.disciplines.find(
    (item) => item.id === map.disciplina,
  );
  const lesson = references.lessons.find((item) => item.id === map.aula);
  const exam = references.exams.find((item) => item.id === map.prova);
  const presentation = references.presentations.find(
    (item) => item.id === map.apresentacao,
  );
  if (lesson)
    return { label: "Aula", title: lesson.tema || "Aula", iconName: "book" };
  if (exam) return { label: "Prova", title: exam.titulo, iconName: "exam" };
  if (presentation)
    return {
      label: "Apresentação",
      title: presentation.titulo,
      iconName: "presentation",
    };
  if (discipline)
    return {
      label: "Disciplina",
      title: discipline.nome_disciplina,
      iconName: "graduation",
    };
  return {
    label: "Geral",
    title: "Sem vínculo acadêmico",
    iconName: "organize",
  };
}

function mapCard(map, references) {
  const activity = activityFor(map, references);
  const nodeCount = map.mapa?.nodes?.length || 0;
  const search = normalized(
    [
      map.tema,
      map.descricao,
      activity.label,
      activity.title,
      references.disciplines.find((item) => item.id === map.disciplina)
        ?.nome_disciplina,
      ...(map.mapa?.nodes || []).map((node) => node?.text),
    ].join(" "),
  );
  return `<button class="mindmap-card" type="button" data-open-mindmap="${escapeHtml(map.id)}" data-map-search="${escapeHtml(search)}"><span class="mindmap-card__art">${icon("mindMap", 26)}</span><div class="mindmap-card__content"><div><small>${escapeHtml(activity.label)}</small><span>${icon(activity.iconName, 13)} ${escapeHtml(activity.title)}</span></div><strong>${escapeHtml(map.tema)}</strong><p>${map.descricao ? escapeHtml(map.descricao) : "Sem descrição adicionada."}</p><footer><span>${icon("organize", 14)} ${nodeCount} ${nodeCount === 1 ? "nó" : "nós"}</span><span>${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(map.updated_at || Date.now())).replace(".", "")}</span></footer></div>${icon("arrowRight", 18)}</button>`;
}

function scopeCopy(scope) {
  if (scope?.type === "lesson")
    return {
      eyebrow: "RECURSO DA AULA",
      title: "Mapas desta aula",
      description: "Organize visualmente os conceitos estudados nesta aula.",
      back: "Aula",
    };
  if (scope?.type === "exam")
    return {
      eyebrow: "RECURSO DA PROVA",
      title: "Mapas desta prova",
      description: "Conecte temas e revisões em um mapa mental.",
      back: "Prova",
    };
  if (scope?.type === "presentation")
    return {
      eyebrow: "RECURSO DA APRESENTAÇÃO",
      title: "Mapas desta apresentação",
      description:
        "Estruture ideias, sequência e pontos principais da apresentação.",
      back: "Apresentação",
    };
  return {
    eyebrow: "CONTEÚDOS VISUAIS",
    title: "Mapas mentais",
    description: "Transforme conteúdos em conexões claras para estudar melhor.",
    back: "",
  };
}

export function mindMapsView({ maps, references, scope }) {
  const copy = scopeCopy(scope);
  const displayed = scope
    ? maps.filter((map) => String(map[scope.field]) === String(scope.record.id))
    : maps;
  return `<section class="page mindmaps-page">${scope ? `<button class="back-link" data-mindmaps-back>${icon("arrowLeft", 18)} ${copy.back}</button>` : ""}<div class="page-heading page-heading--row"><div><span class="eyebrow">${copy.eyebrow}</span><h1>${copy.title}</h1><p>${copy.description}</p></div><button class="button button--primary" data-create-mindmap>${icon("plus", 17)} Novo mapa</button></div><section class="mindmaps-toolbar"><label class="mindmaps-search field"><span class="field__control">${icon("search", 17)}<input data-mindmap-search autocomplete="off" placeholder="Buscar por tema, disciplina, aula, prova, apresentação ou palavra-chave" /></span></label><p><span>${icon("mindMap", 16)}</span><strong>${displayed.length}</strong> ${displayed.length === 1 ? "mapa neste espaço" : "mapas neste espaço"}</p></section><div class="mindmaps-catalog" data-mindmaps-catalog>${displayed.length ? displayed.map((map) => mapCard(map, references)).join("") : `<section class="mindmaps-empty"><span>${icon("mindMap", 30)}</span><h2>Seu primeiro mapa começa aqui</h2><p>Crie um mapa mental para conectar ideias e estudar com mais clareza.</p><button class="button button--secondary" data-create-mindmap>${icon("plus", 16)} Criar mapa</button></section>`}</div><p class="mindmaps-search-empty" data-mindmap-search-empty hidden>Nenhum mapa combina com esta busca. Tente o tema, a disciplina ou uma atividade relacionada.</p></section>`;
}

function targetOptions(disciplineId, references) {
  if (!disciplineId)
    return `<option value="">Selecione uma disciplina para vincular uma atividade</option>`;
  const options = [
    ["", "Nenhuma atividade específica"],
    ...references.lessons
      .filter((item) => item.disciplina === disciplineId)
      .map((item) => [
        `lesson:${item.id}`,
        `Aula · ${item.tema || "Sem tema"}`,
      ]),
    ...references.exams
      .filter((item) => item.disciplina === disciplineId)
      .map((item) => [`exam:${item.id}`, `Prova · ${item.titulo}`]),
    ...references.presentations
      .filter((item) => item.disciplina === disciplineId)
      .map((item) => [
        `presentation:${item.id}`,
        `Apresentação · ${item.titulo}`,
      ]),
  ];
  return options
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`,
    )
    .join("");
}

function createMapModal({ references, context }) {
  const lockedDiscipline = context?.disciplineId || "";
  const target = context?.type ? `${context.type}:${context.record.id}` : "";
  const discipline = references.disciplines.find(
    (item) => item.id === lockedDiscipline,
  );
  return `<div class="modal-backdrop" data-mindmap-create-backdrop><section class="modal modal--mindmap-create" role="dialog" aria-modal="true" aria-labelledby="mindmap-create-title"><form data-mindmap-create-form novalidate><header class="mindmap-modal-head"><div><span class="eyebrow">NOVO MAPA MENTAL</span><h2 id="mindmap-create-title">Comece por uma ideia</h2><p>Depois você poderá desenvolver os tópicos livremente no editor visual.</p></div><button class="icon-button" type="button" data-close-mindmap-create aria-label="Fechar">${icon("close", 19)}</button></header><div class="mindmap-create-fields"><label class="field"><span>Tema do mapa</span><span class="field__control">${icon("mindMap", 17)}<input name="theme" maxlength="180" placeholder="Ex.: Fundamentos de estatística" required autofocus /></span></label><label class="field"><span>Descrição <em>opcional</em></span><textarea class="field__textarea" name="description" maxlength="4000" placeholder="Qual é o objetivo deste mapa?"></textarea></label>${context ? `<div class="mindmap-fixed-context"><span>${icon(context.type === "lesson" ? "book" : context.type === "exam" ? "exam" : "presentation", 18)}</span><div><small>VINCULADO A</small><strong>${escapeHtml(discipline?.nome_disciplina || "Disciplina")}</strong><p>${escapeHtml(context.record.tema || context.record.titulo || "Atividade")}</p></div></div><input type="hidden" name="disciplineId" value="${escapeHtml(lockedDiscipline)}"/><input type="hidden" name="target" value="${escapeHtml(target)}"/>` : `<label class="field"><span>Disciplina <em>opcional</em></span><span class="field__control">${icon("graduation", 17)}<select name="disciplineId" data-mindmap-discipline><option value="">Mapa geral — sem disciplina</option>${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label><label class="field"><span>Vincular a <em>opcional</em></span><span class="field__control">${icon("organize", 17)}<select name="target" data-mindmap-target disabled>${targetOptions("", references)}</select></span></label>`}</div><footer class="modal__actions"><button class="button button--ghost" type="button" data-close-mindmap-create>Cancelar</button><button class="button button--primary" type="submit">${icon("arrowRight", 17)} Abrir editor</button></footer></form></section></div>`;
}

export function openMindMapCreate({ references, context = null, onCreate }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = createMapModal({ references, context });
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };
  document.addEventListener("keydown", onKeydown);
  modalRoot
    .querySelectorAll("[data-close-mindmap-create]")
    .forEach((button) => button.addEventListener("click", close));
  modalRoot
    .querySelector("[data-mindmap-create-backdrop]")
    .addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });
  const discipline = modalRoot.querySelector("[data-mindmap-discipline]");
  const target = modalRoot.querySelector("[data-mindmap-target]");
  discipline?.addEventListener("change", () => {
    target.disabled = !discipline.value;
    target.innerHTML = targetOptions(discipline.value, references);
  });
  modalRoot
    .querySelector("[data-mindmap-create-form]")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const [kind, id] = String(data.get("target") || "").split(":");
      const values = {
        theme: data.get("theme"),
        description: data.get("description"),
        disciplineId: data.get("disciplineId"),
        lessonId: kind === "lesson" ? id : "",
        examId: kind === "exam" ? id : "",
        presentationId: kind === "presentation" ? id : "",
      };
      const button = form.querySelector("[type=submit]");
      try {
        setButtonLoading(button, true);
        await onCreate(values);
        close();
      } catch (error) {
        setButtonLoading(button, false);
        showToast(
          error.message || "Não foi possível criar o mapa mental.",
          "error",
        );
      }
    });
}

function nodeBox(node) {
  const scale = node.size === "small" ? 0.82 : node.size === "large" ? 1.32 : 1;
  const base =
    node.shape === "diamond"
      ? NODE_LAYOUT.diamond
      : node.style === "sticky"
        ? NODE_LAYOUT.sticky
        : NODE_LAYOUT.regular;
  if (node.shape === "diamond")
    return {
      width: Math.round(base.width * scale),
      height: Math.round(base.height * scale),
    };
  const width = Math.round(base.width * scale);
  const fontSize = Math.max(
    10,
    Math.min(48, Number(node.text_style?.font_size || 16)),
  );
  const charactersPerLine = Math.max(
    14,
    Math.floor((width - 48) / Math.max(7, fontSize * 0.52)),
  );
  const lines = Math.max(
    1,
    Math.ceil(String(node.text || "").length / charactersPerLine),
  );
  const textHeight = Math.ceil(lines * fontSize * 1.28);
  return {
    width,
    height: Math.max(Math.round(base.height * scale), textHeight + 58),
  };
}

function nodeCenter(node) {
  const box = nodeBox(node);
  return {
    x: Number(node.x) + box.width / 2,
    y: Number(node.y) + box.height / 2,
  };
}

function automaticSide(node, toward) {
  const center = nodeCenter(node);
  const dx = Number(toward.x) - center.x;
  const dy = Number(toward.y) - center.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

function sideVector(side) {
  return (
    {
      top: { x: 0, y: -1 },
      right: { x: 1, y: 0 },
      bottom: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
    }[side] || { x: 1, y: 0 }
  );
}

function oppositeSide(side) {
  return (
    { top: "bottom", right: "left", bottom: "top", left: "right" }[side] ||
    "left"
  );
}

function boundaryPoint(node, toward, side = "auto") {
  const box = nodeBox(node);
  const center = nodeCenter(node);
  const resolvedSide = side === "auto" ? automaticSide(node, toward) : side;
  if (resolvedSide === "top") return { x: center.x, y: Number(node.y) };
  if (resolvedSide === "right")
    return { x: Number(node.x) + box.width, y: center.y };
  if (resolvedSide === "bottom")
    return { x: center.x, y: Number(node.y) + box.height };
  if (resolvedSide === "left") return { x: Number(node.x), y: center.y };
  const dx = Number(toward.x) - center.x;
  const dy = Number(toward.y) - center.y;
  if (!dx && !dy) return center;
  const multiplier =
    1 /
    Math.max(Math.abs(dx) / (box.width / 2), Math.abs(dy) / (box.height / 2));
  return { x: center.x + dx * multiplier, y: center.y + dy * multiplier };
}

function cubicPoint(start, firstControl, secondControl, end, progress = 0.5) {
  const inverse = 1 - progress;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * progress * firstControl.x +
      3 * inverse * progress ** 2 * secondControl.x +
      progress ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * progress * firstControl.y +
      3 * inverse * progress ** 2 * secondControl.y +
      progress ** 3 * end.y,
  };
}

function curvedPath(start, end, outputSide = "auto", inputSide = "auto") {
  const distance = Math.min(
    168,
    Math.max(56, Math.hypot(end.x - start.x, end.y - start.y) * 0.34),
  );
  const resolvedOutput =
    outputSide === "auto"
      ? Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
        ? end.x >= start.x
          ? "right"
          : "left"
        : end.y >= start.y
          ? "bottom"
          : "top"
      : outputSide;
  const resolvedInput =
    inputSide === "auto"
      ? Math.abs(start.x - end.x) >= Math.abs(start.y - end.y)
        ? start.x >= end.x
          ? "right"
          : "left"
        : start.y >= end.y
          ? "bottom"
          : "top"
      : inputSide;
  const outVector = sideVector(resolvedOutput);
  const inVector = sideVector(resolvedInput);
  const firstControl = {
    x: start.x + outVector.x * distance,
    y: start.y + outVector.y * distance,
  };
  const secondControl = {
    x: end.x + inVector.x * distance,
    y: end.y + inVector.y * distance,
  };
  return {
    d: `M ${start.x} ${start.y} C ${firstControl.x} ${firstControl.y}, ${secondControl.x} ${secondControl.y}, ${end.x} ${end.y}`,
    mid: cubicPoint(start, firstControl, secondControl, end),
  };
}

function edgePath(source, target, connection) {
  const sourceCenter = nodeCenter(source);
  const targetCenter = nodeCenter(target);
  const outputSide = connection.source_side || "auto";
  const inputSide = connection.target_side || "auto";
  const resolvedOutput =
    outputSide === "auto" ? automaticSide(source, targetCenter) : outputSide;
  const resolvedInput =
    inputSide === "auto" ? automaticSide(target, sourceCenter) : inputSide;
  const start = boundaryPoint(source, targetCenter, resolvedOutput);
  const end = boundaryPoint(target, sourceCenter, resolvedInput);
  return {
    start,
    end,
    ...curvedPath(start, end, resolvedOutput, resolvedInput),
  };
}

function editorEdges(nodes, connections = []) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return connections
    .filter(
      (connection) =>
        byId.has(connection.source_id) && byId.has(connection.target_id),
    )
    .map((connection) => {
      const source = byId.get(connection.source_id);
      const target = byId.get(connection.target_id);
      const edge = edgePath(source, target, connection);
      return `<g class="mindmap-edge" data-mindmap-edge="${escapeHtml(connection.id)}"><path class="mindmap-edge__line" d="${edge.d}" stroke="${escapeHtml(source.color)}"/><circle class="mindmap-edge__handle mindmap-edge__handle--output" data-mindmap-edge-handle="output" cx="${edge.start.x}" cy="${edge.start.y}" r="7" fill="${escapeHtml(source.color)}"/><circle class="mindmap-edge__handle mindmap-edge__handle--input" data-mindmap-edge-handle="input" cx="${edge.end.x}" cy="${edge.end.y}" r="7" fill="${escapeHtml(target.color)}"/><g class="mindmap-edge__delete" data-mindmap-delete-connection role="button" aria-label="Excluir conexão" tabindex="0" transform="translate(${edge.mid.x} ${edge.mid.y})"><circle r="13"/><path d="M-4 -5H4M-2 -7H2M-5 -4L-4 6H4L5 -4M-1 -1V3M2 -1V3"/></g></g>`;
    })
    .join("");
}

function canvasMetrics(nodes) {
  const boxes = nodes.map((node) => {
    const box = nodeBox(node);
    return {
      x: Number(node.x),
      y: Number(node.y),
      width: box.width,
      height: box.height,
    };
  });
  return {
    width: Math.max(
      940,
      ...boxes.map((box) => box.x + box.width + NODE_LAYOUT.padding),
    ),
    height: Math.max(
      610,
      ...boxes.map((box) => box.y + box.height + NODE_LAYOUT.padding),
    ),
  };
}

function connectedSide(node, connection, nodesById) {
  if (connection.source_id === node.id) {
    const target = nodesById.get(connection.target_id);
    return connection.source_side === "auto" && target
      ? automaticSide(node, nodeCenter(target))
      : connection.source_side;
  }
  if (connection.target_id === node.id) {
    const source = nodesById.get(connection.source_id);
    return connection.target_side === "auto" && source
      ? automaticSide(node, nodeCenter(source))
      : connection.target_side;
  }
  return null;
}

function nodeAddTargets(node, nodes, connections) {
  const nodesById = new Map(nodes.map((item) => [item.id, item]));
  const occupied = new Set(
    connections
      .map((connection) => connectedSide(node, connection, nodesById))
      .filter(Boolean),
  );
  return `<div class="mindmap-node__add-targets" aria-label="Criar conexão">${NODE_SIDES.map((side) => `<button class="mindmap-node__plus mindmap-node__plus--${side} ${occupied.has(side) ? "mindmap-node__plus--occupied" : ""}" type="button" data-mindmap-add-at="${side}" aria-label="Criar conexão pela ${side}" title="Arraste para conectar ou criar um ramo">+</button>`).join("")}</div>`;
}

function editorNode(node, selectedId, rootId, nodes, connections) {
  const textStyle = node.text_style || {};
  const box = nodeBox(node);
  return `<article class="mindmap-node mindmap-node--${escapeHtml(node.shape)} mindmap-node--${escapeHtml(node.style)} ${node.id === rootId ? "mindmap-node--root" : ""} ${node.id === selectedId ? "is-selected" : ""}" data-mindmap-node="${escapeHtml(node.id)}" style="--node-x:${Number(node.x)}px;--node-y:${Number(node.y)}px;--node-width:${box.width}px;--node-height:${box.height}px;--node-color:${escapeHtml(node.color)};--node-font-size:${Number(textStyle.font_size || 16)}px;--node-font-weight:${textStyle.bold ? 800 : 600};--node-font-style:${textStyle.italic ? "italic" : "normal"}"><button class="mindmap-node__drag" type="button" data-mindmap-drag-handle aria-label="Mover ${escapeHtml(node.text)}" title="Arraste para mover">${icon("organize", 14)}</button><div contenteditable="false" spellcheck="true" data-mindmap-node-text>${escapeHtml(node.text)}</div>${nodeAddTargets(node, nodes, connections)}</article>`;
}

function editorCanvas(mindMap, selectedId) {
  const { nodes, connections, root_id: rootId } = mindMap;
  const metrics = canvasMetrics(nodes);
  return `<div class="mindmap-canvas" data-mindmap-canvas style="width:${metrics.width}px;height:${metrics.height}px"><svg class="mindmap-edges" data-mindmap-edges viewBox="0 0 ${metrics.width} ${metrics.height}" preserveAspectRatio="none">${editorEdges(nodes, connections)}</svg><div class="mindmap-nodes" data-mindmap-nodes>${nodes.map((node) => editorNode(node, selectedId, rootId, nodes, connections)).join("")}</div></div>`;
}

function editorContext(map, scope, references) {
  const activity = activityFor(map, references);
  return `<div class="mindmap-editor-context"><span>${icon(activity.iconName, 17)}</span><div><small>${escapeHtml(activity.label)}</small><strong>${escapeHtml(activity.title)}</strong></div>${scope ? `<em>Mapa vinculado</em>` : ""}</div>`;
}

export function mindMapEditorView({ map, scope, references }) {
  const mindMap = normalizeMindMap(map.mapa, map.tema);
  const rootId = mindMap.root_id || mindMap.nodes[0]?.id;
  return `<section class="page mindmap-editor-page"><button class="back-link" data-mindmap-editor-back>${icon("arrowLeft", 18)} Mapas mentais</button><header class="mindmap-editor-header"><div><span class="eyebrow">EDITOR VISUAL</span><input data-mindmap-title maxlength="180" value="${escapeHtml(map.tema)}" aria-label="Tema do mapa"/><textarea data-mindmap-description maxlength="4000" placeholder="Adicionar descrição opcional">${escapeHtml(map.descricao || "")}</textarea></div>${editorContext(map, scope, references)}<div class="mindmap-editor-header__actions"><button class="button button--ghost" data-mindmap-layout>${icon("organize", 16)} Organizar</button><button class="button button--primary" data-mindmap-save>${icon("save", 16)} Salvar</button><button class="icon-button mindmap-delete-map" type="button" data-delete-mindmap aria-label="Excluir mapa" title="Excluir mapa">${icon("trash", 17)}</button></div></header><section class="mindmap-workspace"><section class="mindmap-stage"><header class="mindmap-stage__bar"><div><span>${icon("mindMap", 17)}</span><strong>Área do mapa</strong><small>Arraste linhas, dê dois cliques no texto para editar.</small></div><span data-mindmap-node-count>${mindMap.nodes.length} ${mindMap.nodes.length === 1 ? "nó" : "nós"}</span></header><div class="mindmap-canvas-wrap"><div class="mindmap-node-toolbar" data-mindmap-node-toolbar hidden><label class="mindmap-shape-field">Forma<select data-mindmap-shape>${MIND_MAP_SHAPES.map((shape) => `<option value="${shape}">${shapeNames[shape]}</option>`).join("")}</select></label><div class="mindmap-colors">${MIND_MAP_COLORS.map((color) => `<button type="button" data-mindmap-color="${color}" style="--map-color:${color}" aria-label="Usar cor ${color}"></button>`).join("")}</div><div class="mindmap-text-tools"><button type="button" data-mindmap-bold aria-label="Negrito"><b>B</b></button><button type="button" data-mindmap-italic aria-label="Itálico"><i>I</i></button><button type="button" data-mindmap-font="decrease" aria-label="Diminuir texto">A−</button><button type="button" data-mindmap-font="increase" aria-label="Aumentar texto">A+</button></div><div class="mindmap-size-tools" data-mindmap-size-tools>${MIND_MAP_SIZES.map((size) => `<button type="button" data-mindmap-size="${size}" title="${sizeNames[size]}">${size === "small" ? "A−" : size === "large" ? "A+" : "A"}</button>`).join("")}</div><button class="mindmap-delete-node" type="button" data-mindmap-delete-node aria-label="Remover nó" title="Remover nó">${icon("trash", 16)}</button></div><div class="mindmap-canvas-actions"><button type="button" data-mindmap-add-child>${icon("plus", 16)} Nó</button><button type="button" data-mindmap-add-note>${icon("file", 16)} Nota</button></div>${editorCanvas(mindMap, rootId)}</div></section></section></section>`;
}

export function bindMindMapsCatalog(
  root,
  { maps, references, scope, onBack, onCreate, onOpen },
) {
  root.querySelector("[data-mindmaps-back]")?.addEventListener("click", onBack);
  root
    .querySelectorAll("[data-create-mindmap]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        openMindMapCreate({ references, context: scope, onCreate }),
      ),
    );
  root.querySelectorAll("[data-open-mindmap]").forEach((button) =>
    button.addEventListener("click", () => {
      const map = maps.find(
        (item) => String(item.id) === button.dataset.openMindmap,
      );
      if (map) onOpen(map);
    }),
  );
  const search = root.querySelector("[data-mindmap-search]");
  const empty = root.querySelector("[data-mindmap-search-empty]");
  search?.addEventListener("input", () => {
    const terms = normalized(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    root.querySelectorAll("[data-open-mindmap]").forEach((card) => {
      const matches = terms.every((term) =>
        card.dataset.mapSearch.includes(term),
      );
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    if (empty) empty.hidden = visible > 0 || !terms.length;
  });
}

export function bindMindMapEditor(root, { map, onBack, onSave, onDelete }) {
  const working = normalizeMindMap(map.mapa, map.tema);
  let selectedId = null;
  const canvas = root.querySelector("[data-mindmap-canvas]");
  const nodesRoot = root.querySelector("[data-mindmap-nodes]");
  const edgesRoot = root.querySelector("[data-mindmap-edges]");
  const viewport = root.querySelector(".mindmap-canvas-wrap");
  root
    .querySelector(".mindmap-stage__bar")
    .insertAdjacentHTML(
      "beforeend",
      `<div class="mindmap-viewport-tools"><button type="button" data-mindmap-zoom="out" aria-label="Diminuir zoom" title="Diminuir zoom">−</button><button type="button" data-mindmap-fit title="Encaixar mapa na área">${icon("organize", 15)}</button><button type="button" data-mindmap-zoom="in" aria-label="Aumentar zoom" title="Aumentar zoom">+</button></div>`,
    );
  const viewState = { zoom: 1, x: 0, y: 0 };
  const selected = () =>
    working.nodes.find((node) => node.id === selectedId) || null;
  const rootNode = () =>
    working.nodes.find((node) => node.id === working.root_id) ||
    working.nodes[0];
  const updateCanvasBounds = () => {
    const metrics = canvasMetrics(working.nodes);
    canvas.style.width = `${metrics.width}px`;
    canvas.style.height = `${metrics.height}px`;
    edgesRoot.setAttribute("viewBox", `0 0 ${metrics.width} ${metrics.height}`);
  };
  const applyViewport = () => {
    canvas.style.transform = `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.zoom})`;
  };
  const updateNodePositions = () => {
    nodesRoot.querySelectorAll("[data-mindmap-node]").forEach((element) => {
      const node = working.nodes.find(
        (item) => item.id === element.dataset.mindmapNode,
      );
      if (!node) return;
      element.style.setProperty("--node-x", `${node.x}px`);
      element.style.setProperty("--node-y", `${node.y}px`);
    });
  };
  const rebaseCanvasIfNeeded = () => {
    const minX = Math.min(...working.nodes.map((node) => Number(node.x)));
    const minY = Math.min(...working.nodes.map((node) => Number(node.y)));
    const shiftX = minX < NODE_LAYOUT.padding ? NODE_LAYOUT.padding - minX : 0;
    const shiftY = minY < NODE_LAYOUT.padding ? NODE_LAYOUT.padding - minY : 0;
    if (!shiftX && !shiftY) return;
    working.nodes.forEach((node) => {
      node.x = Number(node.x) + shiftX;
      node.y = Number(node.y) + shiftY;
    });
    viewState.x -= shiftX * viewState.zoom;
    viewState.y -= shiftY * viewState.zoom;
    applyViewport();
  };
  const fitViewport = () => {
    const metrics = canvasMetrics(working.nodes);
    const width = Math.max(1, viewport.clientWidth - 34);
    const height = Math.max(1, viewport.clientHeight - 34);
    viewState.zoom = Math.max(
      0.26,
      Math.min(1.3, Math.min(width / metrics.width, height / metrics.height)),
    );
    viewState.x = (viewport.clientWidth - metrics.width * viewState.zoom) / 2;
    viewState.y = (viewport.clientHeight - metrics.height * viewState.zoom) / 2;
    applyViewport();
  };
  const zoomAt = (
    factor,
    pointX = viewport.clientWidth / 2,
    pointY = viewport.clientHeight / 2,
  ) => {
    const nextZoom = Math.max(0.22, Math.min(2.6, viewState.zoom * factor));
    const worldX = (pointX - viewState.x) / viewState.zoom;
    const worldY = (pointY - viewState.y) / viewState.zoom;
    viewState.x = pointX - worldX * nextZoom;
    viewState.y = pointY - worldY * nextZoom;
    viewState.zoom = nextZoom;
    applyViewport();
  };
  const paintEdges = () => {
    updateCanvasBounds();
    edgesRoot.innerHTML = editorEdges(working.nodes, working.connections);
    bindEdges();
  };
  const updateTools = () => {
    const node = selected();
    const toolbar = root.querySelector("[data-mindmap-node-toolbar]");
    toolbar.hidden = !node;
    if (!node) {
      root.querySelector("[data-mindmap-node-count]").textContent =
        `${working.nodes.length} ${working.nodes.length === 1 ? "nó" : "nós"}`;
      return;
    }
    root.querySelector("[data-mindmap-shape]").value = node.shape || "rounded";
    root
      .querySelectorAll("[data-mindmap-color]")
      .forEach((button) =>
        button.classList.toggle(
          "is-active",
          button.dataset.mindmapColor === node?.color,
        ),
      );
    root
      .querySelector("[data-mindmap-bold]")
      .classList.toggle("is-active", Boolean(node?.text_style?.bold));
    root
      .querySelector("[data-mindmap-italic]")
      .classList.toggle("is-active", Boolean(node?.text_style?.italic));
    root
      .querySelectorAll("[data-mindmap-size]")
      .forEach((button) =>
        button.classList.toggle(
          "is-active",
          button.dataset.mindmapSize === node?.size,
        ),
      );
    root.querySelector("[data-mindmap-node-count]").textContent =
      `${working.nodes.length} ${working.nodes.length === 1 ? "nó" : "nós"}`;
  };
  const selectNode = (id = null) => {
    selectedId = id;
    nodesRoot
      .querySelectorAll("[data-mindmap-node]")
      .forEach((node) =>
        node.classList.toggle("is-selected", node.dataset.mindmapNode === id),
      );
    updateTools();
  };
  const startNodeDrag = (event, node, element) => {
    selectNode(node.id);
    event.preventDefault();
    event.stopPropagation();
    let previousX = event.clientX;
    let previousY = event.clientY;
    const move = (moveEvent) => {
      node.x =
        Number(node.x) + (moveEvent.clientX - previousX) / viewState.zoom;
      node.y =
        Number(node.y) + (moveEvent.clientY - previousY) / viewState.zoom;
      previousX = moveEvent.clientX;
      previousY = moveEvent.clientY;
      rebaseCanvasIfNeeded();
      updateNodePositions();
      paintEdges();
    };
    const stop = () => {
      repaint();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };
  const worldPoint = (event) => {
    const rect = viewport.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - viewState.x) / viewState.zoom,
      y: (event.clientY - rect.top - viewState.y) / viewState.zoom,
    };
  };
  const identicalConnection = (candidate, excludedId = null) =>
    working.connections.some((connection) => {
      if (connection.id === excludedId) return false;
      const sameDirection =
        connection.source_id === candidate.source_id &&
        connection.target_id === candidate.target_id &&
        connection.source_side === candidate.source_side &&
        connection.target_side === candidate.target_side;
      const reverseDirection =
        connection.source_id === candidate.target_id &&
        connection.target_id === candidate.source_id &&
        connection.source_side === candidate.target_side &&
        connection.target_side === candidate.source_side;
      return sameDirection || reverseDirection;
    });
  const addConnection = ({ sourceId, targetId, sourceSide, targetSide }) => {
    if (!sourceId || !targetId || sourceId === targetId) return false;
    const connection = createMapConnection({
      sourceId,
      targetId,
      sourceSide,
      targetSide,
    });
    if (identicalConnection(connection)) {
      showToast("Essas mesmas posições já possuem uma conexão.", "error");
      return false;
    }
    working.connections.push(connection);
    return true;
  };
  const nearestConnectionTarget = (event, isValid = () => true) => {
    const viewportRect = viewport.getBoundingClientRect();
    const threshold = 40;
    let closest = null;
    working.nodes.forEach((node) =>
      NODE_SIDES.forEach((side) => {
        const point = boundaryPoint(node, nodeCenter(node), side);
        const screenPoint = {
          x: viewportRect.left + viewState.x + point.x * viewState.zoom,
          y: viewportRect.top + viewState.y + point.y * viewState.zoom,
        };
        const distance = Math.hypot(
          event.clientX - screenPoint.x,
          event.clientY - screenPoint.y,
        );
        if (distance > threshold || !isValid(node, side)) return;
        if (!closest || distance < closest.distance)
          closest = { node, side, point, distance };
      }),
    );
    return closest;
  };
  const previewMarkup = (path, color, target = null) =>
    `${editorEdges(working.nodes, working.connections)}<path class="mindmap-edge-preview" d="${path}" stroke="${escapeHtml(color)}"/>${target ? `<g class="mindmap-connection-target" transform="translate(${target.point.x} ${target.point.y})"><circle r="13"/><circle r="5"/></g>` : ""}`;
  const previewConnection = (connection, kind, event) => {
    const source = working.nodes.find(
      (node) => node.id === connection.source_id,
    );
    const target = working.nodes.find(
      (node) => node.id === connection.target_id,
    );
    if (!source || !target) return;
    const pointer = worldPoint(event);
    const candidate =
      kind === "output"
        ? nearestConnectionTarget(
            event,
            (node, side) =>
              node.id !== target.id &&
              !identicalConnection(
                {
                  source_id: node.id,
                  target_id: target.id,
                  source_side: side,
                  target_side: connection.target_side,
                },
                connection.id,
              ),
          )
        : nearestConnectionTarget(
            event,
            (node, side) =>
              node.id !== source.id &&
              !identicalConnection(
                {
                  source_id: source.id,
                  target_id: node.id,
                  source_side: connection.source_side,
                  target_side: side,
                },
                connection.id,
              ),
          );
    const fixed =
      kind === "output"
        ? boundaryPoint(target, pointer, connection.target_side)
        : boundaryPoint(source, pointer, connection.source_side);
    const start = kind === "output" ? candidate?.point || pointer : fixed;
    const end = kind === "output" ? fixed : candidate?.point || pointer;
    const curve = curvedPath(
      start,
      end,
      kind === "output"
        ? candidate?.side || connection.source_side
        : connection.source_side,
      kind === "input"
        ? candidate?.side || connection.target_side
        : connection.target_side,
    );
    edgesRoot.innerHTML = previewMarkup(curve.d, source.color, candidate);
  };
  const startConnectionDrag = (event, connection, kind) => {
    event.preventDefault();
    event.stopPropagation();
    const previous = { ...connection };
    const edgeElement = edgesRoot.querySelector(
      `[data-mindmap-edge="${connection.id}"]`,
    );
    edgeElement?.classList.add("is-editing");
    const move = (moveEvent) => {
      previewConnection(connection, kind, moveEvent);
    };
    const stop = (stopEvent) => {
      const source = working.nodes.find(
        (node) => node.id === connection.source_id,
      );
      const target = working.nodes.find(
        (node) => node.id === connection.target_id,
      );
      const candidate =
        stopEvent?.type === "pointerup" && source && target
          ? kind === "output"
            ? nearestConnectionTarget(
                stopEvent,
                (node, side) =>
                  node.id !== target.id &&
                  !identicalConnection(
                    {
                      source_id: node.id,
                      target_id: target.id,
                      source_side: side,
                      target_side: connection.target_side,
                    },
                    connection.id,
                  ),
              )
            : nearestConnectionTarget(
                stopEvent,
                (node, side) =>
                  node.id !== source.id &&
                  !identicalConnection(
                    {
                      source_id: source.id,
                      target_id: node.id,
                      source_side: connection.source_side,
                      target_side: side,
                    },
                    connection.id,
                  ),
              )
          : null;
      if (candidate) {
        if (kind === "output") {
          connection.source_id = candidate.node.id;
          connection.source_side = candidate.side;
        } else {
          connection.target_id = candidate.node.id;
          connection.target_side = candidate.side;
        }
      }
      const invalidConnection =
        connection.source_id === connection.target_id ||
        identicalConnection(connection, connection.id);
      if (invalidConnection) {
        Object.assign(connection, previous);
        showToast(
          "Essa ligação já existe ou conectaria o nó a ele mesmo.",
          "error",
        );
      }
      if (!invalidConnection) repaint();
      else paintEdges();
      updateTools();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };
  const createChildAt = (source, sourceSide, point) => {
    const node = createMapNode({
      x: point.x - NODE_LAYOUT.regular.width / 2,
      y: point.y - NODE_LAYOUT.regular.height / 2,
      color: source.color,
      style: "normal",
    });
    const targetSide = automaticSide(node, nodeCenter(source));
    working.nodes.push(node);
    if (
      !addConnection({
        sourceId: source.id,
        targetId: node.id,
        sourceSide,
        targetSide,
      })
    ) {
      working.nodes = working.nodes.filter((item) => item.id !== node.id);
      return;
    }
    rebaseCanvasIfNeeded();
    selectedId = node.id;
    repaint();
  };
  const startAddDrag = (event, source, sourceSide) => {
    selectNode(source.id);
    event.preventDefault();
    event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    const move = (moveEvent) => {
      moved ||=
        Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) >
        6;
      const pointer = worldPoint(moveEvent);
      const candidate = nearestConnectionTarget(
        moveEvent,
        (node, side) =>
          node.id !== source.id &&
          !identicalConnection({
            source_id: source.id,
            target_id: node.id,
            source_side: sourceSide,
            target_side: side,
          }),
      );
      const anchor = boundaryPoint(source, pointer, sourceSide);
      const end = candidate?.point || pointer;
      const curve = curvedPath(
        anchor,
        end,
        sourceSide,
        candidate?.side || "auto",
      );
      edgesRoot.innerHTML = previewMarkup(curve.d, source.color, candidate);
    };
    const stop = (stopEvent) => {
      const candidate =
        stopEvent?.type === "pointerup"
          ? nearestConnectionTarget(
              stopEvent,
              (node, side) =>
                node.id !== source.id &&
                !identicalConnection({
                  source_id: source.id,
                  target_id: node.id,
                  source_side: sourceSide,
                  target_side: side,
                }),
            )
          : null;
      if (candidate) {
        if (
          addConnection({
            sourceId: source.id,
            targetId: candidate.node.id,
            sourceSide,
            targetSide: candidate.side,
          })
        )
          repaint();
        else paintEdges();
      } else if (moved && stopEvent?.type === "pointerup")
        createChildAt(source, sourceSide, worldPoint(stopEvent));
      else addNode("normal", source, sourceSide);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };
  const bindEdges = () => {
    edgesRoot.querySelectorAll("[data-mindmap-edge]").forEach((element) => {
      const connection = working.connections.find(
        (item) => item.id === element.dataset.mindmapEdge,
      );
      if (!connection) return;
      element
        .querySelectorAll("[data-mindmap-edge-handle]")
        .forEach((handle) =>
          handle.addEventListener("pointerdown", (event) =>
            startConnectionDrag(
              event,
              connection,
              handle.dataset.mindmapEdgeHandle,
            ),
          ),
        );
      element
        .querySelector(".mindmap-edge__line")
        ?.addEventListener("pointerdown", (event) => {
          const source = working.nodes.find(
            (node) => node.id === connection.source_id,
          );
          const target = working.nodes.find(
            (node) => node.id === connection.target_id,
          );
          if (!source || !target) return;
          const edge = edgePath(source, target, connection);
          const pointer = worldPoint(event);
          const sourceDistance = Math.hypot(
            pointer.x - edge.start.x,
            pointer.y - edge.start.y,
          );
          const targetDistance = Math.hypot(
            pointer.x - edge.end.x,
            pointer.y - edge.end.y,
          );
          startConnectionDrag(
            event,
            connection,
            sourceDistance <= targetDistance ? "output" : "input",
          );
        });
      const remove = () => {
        working.connections = working.connections.filter(
          (item) => item.id !== connection.id,
        );
        repaint();
      };
      element
        .querySelector("[data-mindmap-delete-connection]")
        ?.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      element
        .querySelector("[data-mindmap-delete-connection]")
        ?.addEventListener("click", (event) => {
          event.stopPropagation();
          remove();
        });
      element
        .querySelector("[data-mindmap-delete-connection]")
        ?.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            remove();
          }
        });
    });
  };
  const bindNodes = () => {
    nodesRoot.querySelectorAll("[data-mindmap-node]").forEach((element) => {
      const node = working.nodes.find(
        (item) => item.id === element.dataset.mindmapNode,
      );
      const text = element.querySelector("[data-mindmap-node-text]");
      text.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        selectNode(node.id);
      });
      text.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectNode(node.id);
        text.contentEditable = "true";
        text.classList.add("is-editing");
        element.classList.add("is-text-editing");
        text.focus();
      });
      text.addEventListener("blur", () => {
        text.contentEditable = "false";
        text.classList.remove("is-editing");
        element.classList.remove("is-text-editing");
      });
      text.addEventListener("input", () => {
        node.text = text.textContent.trim().slice(0, 180) || "Novo tópico";
        const box = nodeBox(node);
        element.style.setProperty("--node-width", `${box.width}px`);
        element.style.setProperty("--node-height", `${box.height}px`);
        paintEdges();
        updateTools();
      });
      element.addEventListener("pointerdown", (event) => {
        if (
          !event.target.closest(
            "[data-mindmap-node-text], [data-mindmap-drag-handle], [data-mindmap-add-at]",
          )
        )
          startNodeDrag(event, node, element);
      });
      element
        .querySelector("[data-mindmap-drag-handle]")
        .addEventListener("pointerdown", (event) =>
          startNodeDrag(event, node, element),
        );
      element
        .querySelectorAll("[data-mindmap-add-at]")
        .forEach((button) =>
          button.addEventListener("pointerdown", (event) =>
            startAddDrag(event, node, button.dataset.mindmapAddAt),
          ),
        );
    });
  };
  const repaint = () => {
    nodesRoot.innerHTML = working.nodes
      .map((node) =>
        editorNode(
          node,
          selectedId,
          working.root_id,
          working.nodes,
          working.connections,
        ),
      )
      .join("");
    paintEdges();
    bindNodes();
    updateTools();
  };
  const autoLayout = () => {
    const mapRoot = rootNode();
    if (!mapRoot) return;
    mapRoot.style = "normal";
    const byId = new Map(working.nodes.map((node) => [node.id, node]));
    const normalizedDirection = (vector) => {
      const length = Math.hypot(vector.x, vector.y) || 1;
      return { x: vector.x / length, y: vector.y / length };
    };
    const relationVector = (connection, source, target) => {
      const sourceSide =
        connection.source_side === "auto"
          ? automaticSide(source, nodeCenter(target))
          : connection.source_side;
      const targetSide =
        connection.target_side === "auto"
          ? oppositeSide(sourceSide)
          : connection.target_side;
      const output = sideVector(sourceSide);
      const input = sideVector(targetSide);
      const raw = { x: output.x - input.x, y: output.y - input.y };
      return {
        side: sourceSide,
        vector: normalizedDirection(raw.x || raw.y ? raw : output),
      };
    };
    const branches = new Map();
    const branchOffset = (connection, side) => {
      const key = `${connection.source_id}:${side}`;
      const current = branches.get(key) || 0;
      branches.set(key, current + 1);
      return current === 0
        ? 0
        : (current % 2 ? Math.ceil(current / 2) : -current / 2) * 102;
    };
    const placed = new Set([mapRoot.id]);
    const rectAt = (node, x = node.x, y = node.y) => {
      const box = nodeBox(node);
      return { left: x, top: y, right: x + box.width, bottom: y + box.height };
    };
    const overlaps = (node, x, y) => {
      const current = rectAt(node, x, y);
      return working.nodes.some((other) => {
        if (other.id === node.id || !placed.has(other.id)) return false;
        const candidate = rectAt(other);
        const gap = 44;
        return (
          current.left < candidate.right + gap &&
          current.right + gap > candidate.left &&
          current.top < candidate.bottom + gap &&
          current.bottom + gap > candidate.top
        );
      });
    };
    const placeWithoutOverlap = (node, center, direction) => {
      const box = nodeBox(node);
      const vector = normalizedDirection(direction);
      const perpendicular = { x: -vector.y, y: vector.x };
      for (let ring = 0; ring < 30; ring += 1) {
        const forward = ring * 114;
        const lateralValues = ring
          ? Array.from({ length: ring * 2 + 1 }, (_, index) => index - ring)
          : [0];
        for (const lateral of lateralValues) {
          const candidateCenter = {
            x: center.x + vector.x * forward + perpendicular.x * lateral * 118,
            y: center.y + vector.y * forward + perpendicular.y * lateral * 118,
          };
          const x = candidateCenter.x - box.width / 2;
          const y = candidateCenter.y - box.height / 2;
          if (!overlaps(node, x, y)) {
            node.x = x;
            node.y = y;
            return;
          }
        }
      }
      node.x = center.x - box.width / 2;
      node.y = center.y - box.height / 2;
    };
    mapRoot.x = NODE_LAYOUT.padding + 260;
    mapRoot.y = NODE_LAYOUT.padding + 310;
    const positionTarget = (source, target, connection) => {
      const { side, vector } = relationVector(connection, source, target);
      const sourceBox = nodeBox(source);
      const targetBox = nodeBox(target);
      const distance = Math.max(
        286,
        (sourceBox.width + targetBox.width) / 2 + 156,
      );
      const perpendicular = { x: -vector.y, y: vector.x };
      const spread = branchOffset(connection, side);
      const sourceCenter = nodeCenter(source);
      const center = {
        x: sourceCenter.x + vector.x * distance + perpendicular.x * spread,
        y: sourceCenter.y + vector.y * distance + perpendicular.y * spread,
      };
      placeWithoutOverlap(target, center, vector);
    };
    const positionSource = (source, target, connection) => {
      const { side, vector } = relationVector(connection, source, target);
      const sourceBox = nodeBox(source);
      const targetBox = nodeBox(target);
      const distance = Math.max(
        286,
        (sourceBox.width + targetBox.width) / 2 + 156,
      );
      const perpendicular = { x: -vector.y, y: vector.x };
      const spread = branchOffset(connection, side);
      const targetCenter = nodeCenter(target);
      const center = {
        x: targetCenter.x - vector.x * distance - perpendicular.x * spread,
        y: targetCenter.y - vector.y * distance - perpendicular.y * spread,
      };
      placeWithoutOverlap(source, center, { x: -vector.x, y: -vector.y });
    };
    let changed = true;
    while (changed) {
      changed = false;
      working.connections.forEach((connection) => {
        const source = byId.get(connection.source_id);
        const target = byId.get(connection.target_id);
        if (!source || !target) return;
        if (placed.has(source.id) && !placed.has(target.id)) {
          positionTarget(source, target, connection);
          placed.add(target.id);
          changed = true;
        } else if (!placed.has(source.id) && placed.has(target.id)) {
          positionSource(source, target, connection);
          placed.add(source.id);
          changed = true;
        }
      });
    }
    const freeNodes = working.nodes.filter((node) => !placed.has(node.id));
    freeNodes.forEach((node, index) => {
      const column = Math.floor(index / 4);
      const row = index % 4;
      placeWithoutOverlap(
        node,
        {
          x:
            NODE_LAYOUT.padding +
            790 +
            column * (NODE_LAYOUT.regular.width + 78),
          y: NODE_LAYOUT.padding + 100 + row * (NODE_LAYOUT.slotHeight + 72),
        },
        { x: 1, y: 0 },
      );
      placed.add(node.id);
    });
    rebaseCanvasIfNeeded();
    repaint();
    requestAnimationFrame(fitViewport);
  };
  const addNode = (style, sourceNode = selected(), sourceSide = null) => {
    const parent = sourceNode;
    const metrics = canvasMetrics(working.nodes);
    const box = parent
      ? nodeBox(parent)
      : nodeBox({
          size: "medium",
          shape: "rounded",
          style: "normal",
          text_style: {},
        });
    const node = createMapNode({
      x:
        style === "sticky"
          ? Math.max(80, metrics.width - 290)
          : parent
            ? Number(parent.x) + box.width + NODE_LAYOUT.levelGap
            : Math.max(NODE_LAYOUT.padding, metrics.width / 2 - box.width / 2),
      y:
        style === "sticky"
          ? 80 +
            ((working.nodes.filter((item) => item.style === "sticky").length *
              128) %
              Math.max(160, metrics.height - 180))
          : parent
            ? Number(parent.y) + 118
            : Math.max(
                NODE_LAYOUT.padding,
                metrics.height / 2 - box.height / 2,
              ),
      color:
        style === "sticky"
          ? "#c26412"
          : parent?.color ||
            MIND_MAP_COLORS[working.nodes.length % MIND_MAP_COLORS.length],
      style,
    });
    if (style === "normal" && sourceSide && parent) {
      const newBox = nodeBox(node);
      if (sourceSide === "top") {
        node.x = Number(parent.x) + (box.width - newBox.width) / 2;
        node.y = Number(parent.y) - newBox.height - 92;
      } else if (sourceSide === "bottom") {
        node.x = Number(parent.x) + (box.width - newBox.width) / 2;
        node.y = Number(parent.y) + box.height + 92;
      } else if (sourceSide === "left") {
        node.x = Number(parent.x) - newBox.width - 112;
        node.y = Number(parent.y) + (box.height - newBox.height) / 2;
      } else {
        node.x = Number(parent.x) + box.width + 112;
        node.y = Number(parent.y) + (box.height - newBox.height) / 2;
      }
    }
    working.nodes.push(node);
    if (style === "normal" && parent)
      working.connections.push(
        createMapConnection({
          sourceId: parent.id,
          targetId: node.id,
          sourceSide: sourceSide || "right",
          targetSide: sourceSide ? oppositeSide(sourceSide) : "left",
        }),
      );
    rebaseCanvasIfNeeded();
    selectedId = node.id;
    repaint();
  };
  const editorSnapshot = () =>
    JSON.stringify({
      theme: root.querySelector("[data-mindmap-title]").value.trim(),
      description: root.querySelector("[data-mindmap-description]").value,
      map: working,
    });
  let savedSnapshot = editorSnapshot();
  const saveMap = async (
    button = root.querySelector("[data-mindmap-save]"),
    { silent = false } = {},
  ) => {
    const theme = root.querySelector("[data-mindmap-title]").value.trim();
    if (!theme) {
      showToast("Informe o tema do mapa mental.", "error");
      return false;
    }
    try {
      setButtonLoading(button, true);
      await onSave({
        theme,
        description: root.querySelector("[data-mindmap-description]").value,
        map: {
          ...working,
          titulo: theme,
          descricao: root.querySelector("[data-mindmap-description]").value,
          updated_at: new Date().toISOString(),
        },
      });
      savedSnapshot = editorSnapshot();
      if (!silent) showToast("Mapa mental salvo.");
      return true;
    } catch (error) {
      showToast(
        error.message || "Não foi possível salvar o mapa mental.",
        "error",
      );
      return false;
    } finally {
      setButtonLoading(button, false);
    }
  };
  const leaveEditor = async () => {
    if (editorSnapshot() === savedSnapshot) return onBack();
    const choice = await unsavedModal();
    if (choice === "discard") return onBack();
    if (
      choice === "save" &&
      (await saveMap(root.querySelector("[data-mindmap-save]"), {
        silent: true,
      }))
    )
      onBack();
  };
  root.querySelector(".app-shell")?.addEventListener(
    "click",
    async (event) => {
      const navigation = event.target.closest("[data-nav]");
      if (!navigation || editorSnapshot() === savedSnapshot) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const choice = await unsavedModal();
      if (choice === "discard") {
        savedSnapshot = editorSnapshot();
        navigation.click();
      } else if (
        choice === "save" &&
        (await saveMap(root.querySelector("[data-mindmap-save]"), {
          silent: true,
        }))
      )
        navigation.click();
    },
    true,
  );
  bindNodes();
  bindEdges();
  updateTools();
  viewport.addEventListener("pointerdown", (event) => {
    if (
      event.target.closest(
        "[data-mindmap-node-toolbar], .mindmap-canvas-actions",
      )
    )
      return;
    if (event.target.closest("[data-mindmap-node]")) return;
    if (!event.target.closest("[data-mindmap-edge]")) selectNode(null);
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const panX = viewState.x;
    const panY = viewState.y;
    viewport.classList.add("is-panning");
    const move = (moveEvent) => {
      viewState.x = panX + moveEvent.clientX - startX;
      viewState.y = panY + moveEvent.clientY - startY;
      applyViewport();
    };
    const stop = () => {
      viewport.classList.remove("is-panning");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  });
  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      zoomAt(
        event.deltaY < 0 ? 1.12 : 0.89,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    },
    { passive: false },
  );
  root
    .querySelectorAll("[data-mindmap-zoom]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        zoomAt(button.dataset.mindmapZoom === "in" ? 1.18 : 0.85),
      ),
    );
  root
    .querySelector("[data-mindmap-fit]")
    .addEventListener("click", fitViewport);
  root
    .querySelector("[data-mindmap-editor-back]")
    .addEventListener("click", leaveEditor);
  root
    .querySelector("[data-mindmap-add-child]")
    .addEventListener("click", () => addNode("normal"));
  root
    .querySelector("[data-mindmap-add-note]")
    .addEventListener("click", () => addNode("sticky"));
  root
    .querySelector("[data-mindmap-layout]")
    .addEventListener("click", autoLayout);
  root
    .querySelector("[data-mindmap-shape]")
    .addEventListener("change", (event) => {
      selected().shape = event.target.value;
      repaint();
    });
  root.querySelectorAll("[data-mindmap-color]").forEach((button) =>
    button.addEventListener("click", () => {
      selected().color = button.dataset.mindmapColor;
      repaint();
    }),
  );
  root.querySelectorAll("[data-mindmap-size]").forEach((button) =>
    button.addEventListener("click", () => {
      selected().size = button.dataset.mindmapSize;
      repaint();
    }),
  );
  root.querySelector("[data-mindmap-bold]").addEventListener("click", () => {
    selected().text_style.bold = !selected().text_style.bold;
    repaint();
  });
  root.querySelector("[data-mindmap-italic]").addEventListener("click", () => {
    selected().text_style.italic = !selected().text_style.italic;
    repaint();
  });
  root.querySelectorAll("[data-mindmap-font]").forEach((button) =>
    button.addEventListener("click", () => {
      const current = Number(selected().text_style.font_size || 16);
      selected().text_style.font_size = Math.max(
        10,
        Math.min(
          48,
          current + (button.dataset.mindmapFont === "increase" ? 2 : -2),
        ),
      );
      repaint();
    }),
  );
  root
    .querySelector("[data-mindmap-delete-node]")
    .addEventListener("click", () => {
      const node = selected();
      if (!node || working.nodes.length === 1)
        return showToast("Todo mapa precisa ter ao menos um nó.", "error");
      working.nodes = working.nodes.filter((item) => item.id !== node.id);
      working.connections = working.connections.filter(
        (connection) =>
          connection.source_id !== node.id && connection.target_id !== node.id,
      );
      if (working.root_id === node.id)
        working.root_id =
          working.nodes.find((item) => item.style !== "sticky")?.id ||
          working.nodes[0].id;
      selectedId = null;
      repaint();
    });
  root
    .querySelector("[data-mindmap-save]")
    .addEventListener("click", (event) => saveMap(event.currentTarget));
  root
    .querySelector("[data-delete-mindmap]")
    .addEventListener("click", async () => {
      if (
        await confirmModal({
          title: "Excluir este mapa?",
          message: `“${map.tema}” e todos os seus nós serão removidos.`,
          confirmLabel: "Excluir mapa",
          tone: "danger",
        })
      )
        await onDelete();
    });
  root.mindmapViewportObserver?.disconnect();
  if ("ResizeObserver" in window) {
    root.mindmapViewportObserver = new ResizeObserver(() => fitViewport());
    root.mindmapViewportObserver.observe(viewport);
  }
  requestAnimationFrame(fitViewport);
}
