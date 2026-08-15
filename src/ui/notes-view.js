import { createEmptyNote, normalizeNote } from "../services/notes.js";
import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const normalized = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR");

function textFromHtml(value = "") {
  const element = document.createElement("div");
  element.innerHTML = String(value || "");
  return element.textContent || element.innerText || "";
}

function sanitizeHtml(value = "") {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  const allowed = new Set(["P", "BR", "DIV", "H2", "H3", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "U", "BLOCKQUOTE", "SPAN", "TABLE", "TBODY", "THEAD", "TR", "TD", "TH"]);
  const safeStyle = (element, isTableWrap) => {
    const allowedStyles = [];
    String(element.getAttribute("style") || "").split(";").forEach((declaration) => {
      const [rawProperty, ...rawValue] = declaration.split(":");
      const property = String(rawProperty || "").trim().toLowerCase();
      const value = rawValue.join(":").trim().toLowerCase();
      if (!property || !value) return;
      if (property === "font-size" && element.tagName === "SPAN" && /^(?:[8-9]|[1-6]\d|7[0-2])px$/.test(value)) allowedStyles.push(`font-size:${value}`);
      if (property === "text-align" && ["P", "H2", "H3", "DIV", "LI"].includes(element.tagName) && ["left", "right", "center", "justify"].includes(value)) allowedStyles.push(`text-align:${value}`);
      if (isTableWrap && property === "--note-table-width" && /^(?:1[2-9]\d|[2-8]\d\d|900)px$/.test(value)) allowedStyles.push(`${property}:${value}`);
      if (isTableWrap && property === "--note-table-manual-width" && value === "1") allowedStyles.push(`${property}:${value}`);
      if (isTableWrap && property === "--note-table-columns" && /^(?:[1-9]|1\d|20)$/.test(value)) allowedStyles.push(`${property}:${value}`);
      if (isTableWrap && property === "--note-table-min-width" && /^\d{2,5}px$/.test(value)) allowedStyles.push(`${property}:${value}`);
      if (isTableWrap && property === "--note-table-row-height" && /^(?:[2-9]\d|[1-2]\d\d)px$/.test(value)) allowedStyles.push(`${property}:${value}`);
    });
    return allowedStyles.join(";");
  };
  template.content.querySelectorAll("*").forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const isTableWrap = element.tagName === "DIV" && element.classList.contains("note-table-wrap");
    const isTableScroll = element.tagName === "DIV" && element.classList.contains("note-table-scroll");
    const tableConfig = isTableWrap ? normalizeTableConfig(element.getAttribute("data-note-table-config")) : null;
    const tableClasses = element.tagName === "TABLE"
      ? [...element.classList].filter((className) => ["note-table--head-row", "note-table--head-column"].includes(className))
      : [];
    const style = safeStyle(element, isTableWrap);
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
    if (isTableWrap) {
      element.setAttribute("class", "note-table-wrap");
      element.setAttribute("data-note-table", "true");
      if (tableConfig) element.setAttribute("data-note-table-config", JSON.stringify(tableConfig));
    }
    if (isTableScroll) element.setAttribute("class", "note-table-scroll");
    if (tableClasses.length) element.setAttribute("class", tableClasses.join(" "));
    if (style) element.setAttribute("style", style);
  });
  return template.innerHTML || "<p><br></p>";
}

function scopeCopy(scope) {
  if (scope?.type === "lesson") return { label: "RECURSO DA AULA", title: "Anotações desta aula", back: "Aula" };
  if (scope?.type === "exam") return { label: "RECURSO DA PROVA", title: "Anotações desta prova", back: "Prova" };
  if (scope?.type === "presentation") return { label: "RECURSO DA APRESENTAÇÃO", title: "Anotações desta apresentação", back: "Apresentação" };
  return { label: "CONTEÚDOS ESCRITOS", title: "Anotações", back: "" };
}

function activityFor(note, references) {
  const discipline = references.disciplines.find((item) => item.id === note.disciplina);
  const lesson = references.lessons.find((item) => item.id === note.aula);
  const exam = references.exams.find((item) => item.id === note.prova);
  const presentation = references.presentations.find((item) => item.id === note.apresentacao);
  if (lesson) return { kind: "Aula", title: lesson.tema || "Aula", iconName: "book", discipline };
  if (exam) return { kind: "Prova", title: exam.titulo || "Prova", iconName: "exam", discipline };
  if (presentation) return { kind: "Apresentação", title: presentation.titulo || "Apresentação", iconName: "presentation", discipline };
  if (discipline) return { kind: "Disciplina", title: discipline.nome_disciplina, iconName: "graduation", discipline };
  return { kind: "Geral", title: "Sem vínculo acadêmico", iconName: "note", discipline: null };
}

function notePages(note) {
  return normalizeNote(note.anotacao, note.titulo).document.pages;
}

function noteCard(note, references) {
  const activity = activityFor(note, references);
  const pages = notePages(note);
  const content = pages.map((page) => textFromHtml(page.html)).join(" ");
  const search = normalized([note.titulo, activity.kind, activity.title, activity.discipline?.nome_disciplina, content].join(" "));
  const context = activity.discipline
    ? activity.kind === "Disciplina"
      ? "Sem atividade específica"
      : `${activity.kind} · ${activity.title}`
    : "Sem vínculo acadêmico";
  return `<button type="button" class="note-card" data-open-note="${escapeHtml(note.id)}" data-note-discipline="${escapeHtml(note.disciplina || "__none__")}" data-note-search="${escapeHtml(search)}"><span class="note-card__icon">${icon("note", 23)}</span><div class="note-card__body"><div><small>${escapeHtml(activity.discipline?.nome_disciplina || "SEM DISCIPLINA")}</small><span>${icon(activity.iconName, 13)} ${escapeHtml(context)}</span></div><strong>${escapeHtml(note.titulo)}</strong><p>${escapeHtml(content.trim() || "Anotação vazia. Comece a escrever quando quiser.")}</p><footer><span>${icon("file", 14)} ${pages.length} ${pages.length === 1 ? "página" : "páginas"}</span><span>${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(note.updated_at || Date.now())).replace(".", "")}</span></footer></div>${icon("arrowRight", 17)}</button>`;
}

export function notesView({ notes, references, scope }) {
  const copy = scopeCopy(scope);
  const scoped = scope ? notes.filter((note) => String(note[scope.field]) === String(scope.record.id)) : notes;
  return `<section class="page notes-page">${scope ? `<button class="back-link" data-notes-back>${icon("arrowLeft", 18)} ${copy.back}</button>` : ""}<div class="notes-toolbar"><label class="field notes-toolbar__search"><span class="visually-hidden">Buscar anotações</span><span class="field__control">${icon("search", 17)}<input data-notes-search autocomplete="off" placeholder="Buscar pelo título, vínculo ou conteúdo da anotação" /></span></label>${!scope ? `<label class="field notes-toolbar__filter"><span class="visually-hidden">Filtrar por disciplina</span><span class="field__control">${icon("graduation", 17)}<select data-notes-discipline-filter><option value="">Todas as disciplinas</option><option value="__none__">Sem disciplina</option>${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label>` : ""}<button class="button button--primary" data-create-note>${icon("plus", 17)} Nova anotação</button></div><p class="notes-toolbar__count" data-notes-count>${scoped.length} ${scoped.length === 1 ? "anotação salva" : "anotações salvas"}</p><section class="notes-grid" data-notes-grid>${scoped.length ? scoped.map((note) => noteCard(note, references)).join("") : `<section class="notes-empty"><span>${icon("note", 29)}</span><h2>Sua primeira anotação começa aqui</h2><p>Organize ideias, explicações e pontos importantes em páginas feitas para estudar.</p><button class="button button--secondary" data-create-note>${icon("plus", 16)} Criar anotação</button></section>`}</section><p class="notes-search-empty" data-notes-empty-search hidden>Nenhuma anotação corresponde à busca ou ao filtro selecionado.</p></section>`;
}

function targetOptions(disciplineId, references) {
  if (!disciplineId) return `<option value="">Escolha uma disciplina para vincular uma atividade</option>`;
  const entries = [
    ["", "Nenhuma atividade específica"],
    ...references.lessons.filter((item) => item.disciplina === disciplineId).map((item) => [`lesson:${item.id}`, `Aula · ${item.tema || "Sem tema"}`]),
    ...references.exams.filter((item) => item.disciplina === disciplineId).map((item) => [`exam:${item.id}`, `Prova · ${item.titulo}`]),
    ...references.presentations.filter((item) => item.disciplina === disciplineId).map((item) => [`presentation:${item.id}`, `Apresentação · ${item.titulo}`]),
  ];
  return entries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
}

function createModal({ references, scope }) {
  const lockedDiscipline = scope?.disciplineId || "";
  const target = scope?.type ? `${scope.type}:${scope.record.id}` : "";
  const discipline = references.disciplines.find((item) => item.id === lockedDiscipline);
  return `<div class="modal-backdrop" data-note-create-backdrop><section class="modal modal--note-create" role="dialog" aria-modal="true" aria-labelledby="note-create-title"><form data-note-create-form novalidate><header class="note-modal__head"><div><span class="eyebrow">NOVA ANOTAÇÃO</span><h2 id="note-create-title">Prepare sua página</h2><p>Você poderá desenvolver a anotação em um editor de páginas logo em seguida.</p></div><button class="icon-button" type="button" data-close-note-create aria-label="Fechar">${icon("close", 19)}</button></header><div class="note-create__fields"><label class="field"><span>Título</span><span class="field__control">${icon("note", 17)}<input name="title" maxlength="180" placeholder="Ex.: Revisão de probabilidade" required autofocus /></span></label>${scope ? `<section class="note-fixed-context"><span>${icon(scope.type === "lesson" ? "book" : scope.type === "exam" ? "exam" : "presentation", 18)}</span><div><small>VINCULADA A</small><strong>${escapeHtml(discipline?.nome_disciplina || "Disciplina")}</strong><p>${escapeHtml(scope.record.tema || scope.record.titulo || "Atividade")}</p></div></section><input name="disciplineId" type="hidden" value="${escapeHtml(lockedDiscipline)}"/><input name="target" type="hidden" value="${escapeHtml(target)}"/>` : `<label class="field"><span>Disciplina <em>opcional</em></span><span class="field__control">${icon("graduation", 17)}<select name="disciplineId" data-note-discipline><option value="">Anotação geral — sem disciplina</option>${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label><label class="field"><span>Vincular a <em>opcional</em></span><span class="field__control">${icon("organize", 17)}<select name="target" data-note-target disabled>${targetOptions("", references)}</select></span></label>`}</div><footer class="modal__actions"><button class="button button--ghost" type="button" data-close-note-create>Cancelar</button><button class="button button--primary" type="submit">${icon("arrowRight", 17)} Abrir editor</button></footer></form></section></div>`;
}

export function openNoteCreate({ references, scope = null, onCreate }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = createModal({ references, scope });
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-note-create]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-note-create-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  const discipline = modalRoot.querySelector("[data-note-discipline]");
  const target = modalRoot.querySelector("[data-note-target]");
  discipline?.addEventListener("change", () => {
    target.disabled = !discipline.value;
    target.innerHTML = targetOptions(discipline.value, references);
  });
  modalRoot.querySelector("[data-note-create-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);
    const [kind, id] = String(formData.get("target") || "").split(":");
    const values = {
      title: formData.get("title"),
      disciplineId: formData.get("disciplineId"),
      lessonId: kind === "lesson" ? id : "",
      examId: kind === "exam" ? id : "",
      presentationId: kind === "presentation" ? id : "",
      note: createEmptyNote(formData.get("title")),
    };
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      const note = await onCreate(values);
      close();
      return note;
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível criar a anotação.", "error");
    }
  });
}

function pagesHtml(note, { editable = false } = {}) {
  return notePages(note).map((page, index) => `<article lang="pt-BR" class="note-page ${editable ? "note-page--editable" : ""}" ${editable ? `contenteditable="true" spellcheck="true" data-note-page="${escapeHtml(page.id)}"` : ""}>${sanitizeHtml(page.html)}<small ${editable ? 'contenteditable="false"' : ""} class="note-page__number">Página ${index + 1}</small></article>`).join("");
}

function noteConfirm(host, { iconName = "info", title, message, confirmLabel, cancelLabel = "Cancelar", tone = "button--primary", onConfirm, onCancel }) {
  const layer = host.querySelector("[data-note-confirm]");
  layer.hidden = false;
  layer.innerHTML = `<div><span>${icon(iconName, 20)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p><footer><button type="button" class="button button--ghost button--small" data-note-confirm-cancel>${escapeHtml(cancelLabel)}</button><button type="button" class="button ${tone} button--small" data-note-confirm-action>${escapeHtml(confirmLabel)}</button></footer></div>`;
  const clear = () => { layer.hidden = true; layer.innerHTML = ""; };
  layer.querySelector("[data-note-confirm-cancel]").addEventListener("click", () => { clear(); onCancel?.(); });
  layer.querySelector("[data-note-confirm-action]").addEventListener("click", () => { clear(); onConfirm?.(); });
}

function editorModal(note) {
  return `<div class="modal-backdrop modal-backdrop--note-workspace" data-note-editor-backdrop>
    <section class="modal modal--note-workspace" role="dialog" aria-modal="true" aria-labelledby="note-editor-title">
      <header class="note-workspace__head">
        <div><span class="eyebrow">EDITOR DE ANOTAÇÃO</span><h2 id="note-editor-title">${escapeHtml(note.titulo)}</h2></div>
        <div>
          <button class="button button--danger button--small" type="button" data-delete-note>${icon("trash", 15)} Apagar</button>
          <button class="button button--ghost button--small" type="button" data-close-note-editor>Fechar</button>
          <button class="button button--primary button--small" type="button" data-save-note>${icon("save", 15)} Salvar</button>
        </div>
      </header>
      <div class="note-editor-tools" aria-label="Ferramentas de edição">
        <button type="button" data-note-command="bold" title="Negrito"><strong>B</strong></button>
        <button type="button" data-note-command="italic" title="Itálico"><em>I</em></button>
        <button type="button" data-note-command="underline" title="Sublinhado"><u>U</u></button>
        <span></span>
        <div class="note-format-picker" data-note-format-picker>
          <button class="note-format-picker__trigger" type="button" data-note-format-trigger aria-expanded="false"><span data-note-format-label>Texto</span>${icon("chevronDown", 14)}</button>
          <div class="note-format-picker__menu" data-note-format-menu hidden>
            <button class="note-format-picker__option is-active" type="button" data-note-block="p">Texto</button>
            <button class="note-format-picker__option" type="button" data-note-block="h2">Título</button>
            <button class="note-format-picker__option" type="button" data-note-block="h3">Subtítulo</button>
          </div>
        </div>
        <label class="note-font-size" title="Tamanho de fonte personalizado"><span>A</span><input data-note-font-size type="number" min="8" max="72" value="16" inputmode="numeric" aria-label="Tamanho de fonte em pixels" /><span>px</span></label>
        <div class="note-alignment" role="group" aria-label="Alinhamento do texto">
          <button type="button" data-note-align="left" class="is-active" title="Alinhar à esquerda">${icon("alignLeft", 17)}</button>
          <button type="button" data-note-align="center" title="Centralizar">${icon("alignCenter", 17)}</button>
          <button type="button" data-note-align="right" title="Alinhar à direita">${icon("alignRight", 17)}</button>
          <button type="button" data-note-align="justify" title="Justificar texto">${icon("alignJustify", 17)}</button>
        </div>
        <button type="button" data-note-command="insertUnorderedList" title="Lista">• Lista</button>
        <button type="button" data-note-command="insertOrderedList" title="Lista numerada">1. Lista</button>
        <div class="note-table-picker" data-note-table-picker>
          <button class="note-table-picker__trigger" type="button" data-note-table-trigger aria-expanded="false">${icon("table", 16)} Tabela</button>
          <div class="note-table-picker__menu" data-note-table-menu hidden>
            <strong>Inserir tabela</strong>
            <div class="note-table-picker__fields">
              <label>Linhas<input data-note-table-rows type="number" min="1" max="20" value="3" inputmode="numeric" /></label>
              <label>Colunas<input data-note-table-columns type="number" min="1" max="20" value="3" inputmode="numeric" /></label>
              <label>Altura<input data-note-table-row-height type="number" min="28" max="220" value="38" inputmode="numeric" /></label>
            </div>
            <button class="button button--secondary button--small note-table-picker__insert" type="button" data-insert-note-table>${icon("plus", 15)} Inserir tabela</button>
          </div>
        </div>
        <button type="button" data-note-command="removeFormat" title="Limpar formatação">Limpar</button>
      </div>
      <main class="note-workspace__canvas" data-note-pages>
        ${pagesHtml(note, { editable: true })}
        <button class="button button--secondary note-page-add" type="button" data-add-note-page>${icon("plus", 16)} Adicionar página</button>
      </main>
      <div class="note-modal-confirm" data-note-confirm hidden></div>
    </section>
  </div>`;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TABLE_VIEWPORT_MIN_WIDTH = 102;
const TABLE_VIEWPORT_DEFAULT_WIDTH = 420;
const TABLE_THEME_CLASSES = ["note-table-cell--theme-row", "note-table-cell--theme-column", "note-table-cell--theme-cell"];

function validTableColor(value) {
  const color = String(value || "").trim().toLowerCase();
  return color === "transparent" || /^#[0-9a-f]{6}$/.test(color) ? color : "";
}

function tableTextColor(color) {
  if (color === "transparent") return "";
  const { r, g, b } = hexToRgb(color);
  const luminance = ((r * 299) + (g * 587) + (b * 114)) / 255000;
  return luminance > .58 ? "#18211d" : "#ffffff";
}

function normalizeTableRule(value) {
  if (!value || typeof value !== "object") return null;
  const color = validTableColor(value.color);
  const mode = value.mode === "fixed" && color ? "fixed" : "theme";
  return { mode, ...(mode === "fixed" ? { color } : {}), order: clamp(Number.parseInt(value.order, 10) || 0, 0, 9_999_999_999_999) };
}

function normalizeTableConfig(raw) {
  let source = raw;
  if (typeof raw === "string") {
    try { source = JSON.parse(raw); } catch { return null; }
  }
  if (!source || typeof source !== "object") return null;
  const normalizeScope = (value, keyPattern) => Object.fromEntries(Object.entries(value || {}).flatMap(([key, rule]) => {
    if (!keyPattern.test(key)) return [];
    const normalizedRule = normalizeTableRule(rule);
    return normalizedRule ? [[key, normalizedRule]] : [];
  }));
  const borderRule = normalizeTableRule(source.border?.rule);
  const borderWidth = clamp(Number.parseInt(source.border?.width, 10) || 1, 1, 8);
  const config = {
    version: 1,
    border: { width: borderWidth, ...(borderRule ? { rule: borderRule } : {}) },
    rows: normalizeScope(source.rows, /^(?:[0-9]|1[0-9])$/),
    columns: normalizeScope(source.columns, /^(?:[0-9]|1[0-9])$/),
    cells: normalizeScope(source.cells, /^(?:[0-9]|1[0-9]):(?:[0-9]|1[0-9])$/),
  };
  const hasCustomizations = borderWidth !== 1 || borderRule || Object.keys(config.rows).length || Object.keys(config.columns).length || Object.keys(config.cells).length;
  return hasCustomizations ? config : null;
}

function getTableConfig(wrapper) {
  return normalizeTableConfig(wrapper.getAttribute("data-note-table-config")) || {
    version: 1,
    border: { width: 1 },
    rows: {},
    columns: {},
    cells: {},
  };
}

function saveTableConfig(wrapper, config) {
  const normalized = normalizeTableConfig(config);
  if (normalized) wrapper.setAttribute("data-note-table-config", JSON.stringify(normalized));
  else wrapper.removeAttribute("data-note-table-config");
}

function applyTableVisuals(wrapper) {
  const table = wrapper.querySelector("table");
  if (!table) return;
  const config = getTableConfig(wrapper);
  wrapper.style.removeProperty("--note-table-border-color");
  wrapper.style.setProperty("--note-table-border-width", `${config.border.width || 1}px`);
  if (config.border.rule?.mode === "fixed") wrapper.style.setProperty("--note-table-border-color", config.border.rule.color);
  table.classList.remove("note-table--head-row", "note-table--head-column");
  const rows = tableRows(table);
  const allCells = rows.flatMap((row) => [...row.cells]);
  allCells.forEach((cell) => {
    cell.style.removeProperty("background-color");
    cell.style.removeProperty("color");
    cell.classList.remove(...TABLE_THEME_CLASSES);
  });
  const directives = [
    ...Object.entries(config.rows).map(([index, rule]) => ({ order: rule.order || 0, rule, cells: [...(rows[Number(index)]?.cells || [])], themeClass: "note-table-cell--theme-row" })),
    ...Object.entries(config.columns).map(([index, rule]) => ({ order: rule.order || 0, rule, cells: rows.map((row) => row.cells[Number(index)]).filter(Boolean), themeClass: "note-table-cell--theme-column" })),
    ...Object.entries(config.cells).map(([key, rule]) => {
      const [row, column] = key.split(":").map(Number);
      return { order: rule.order || 0, rule, cells: rows[row]?.cells[column] ? [rows[row].cells[column]] : [], themeClass: "note-table-cell--theme-cell" };
    }),
  ].sort((first, second) => first.order - second.order);
  directives.forEach(({ rule, cells, themeClass }) => cells.forEach((cell) => {
    cell.style.removeProperty("background-color");
    cell.style.removeProperty("color");
    cell.classList.remove(...TABLE_THEME_CLASSES);
    if (rule.mode === "fixed") {
      cell.style.backgroundColor = rule.color;
      const textColor = tableTextColor(rule.color);
      if (textColor) cell.style.color = textColor;
    }
    else cell.classList.add(themeClass);
  }));
}

function updateTableColor(wrapper, target, position, rule) {
  const config = getTableConfig(wrapper);
  const nextRule = normalizeTableRule({ ...rule, order: Date.now() });
  if (!nextRule) return;
  if (target === "border") config.border.rule = nextRule;
  else if (target === "row") config.rows[String(position.row)] = nextRule;
  else if (target === "column") config.columns[String(position.column)] = nextRule;
  else if (target === "cell") config.cells[`${position.row}:${position.column}`] = nextRule;
  saveTableConfig(wrapper, config);
  applyTableVisuals(wrapper);
}

function elementFromNode(node) {
  return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
}

function selectionBelongsToPages(range, pages) {
  const page = elementFromNode(range?.commonAncestorContainer)?.closest?.("[data-note-page]");
  return Boolean(page && pages.contains(page));
}

function createTableMarkup(rows, columns, rowHeight = 38) {
  const safeRows = clamp(Number.parseInt(rows, 10) || 3, 1, 20);
  const safeColumns = clamp(Number.parseInt(columns, 10) || 3, 1, 20);
  const safeRowHeight = clamp(Number.parseInt(rowHeight, 10) || 38, 28, 220);
  const width = TABLE_VIEWPORT_DEFAULT_WIDTH;
  const body = Array.from({ length: safeRows }, () => `<tr>${Array.from({ length: safeColumns }, () => "<td><br></td>").join("")}</tr>`).join("");
  return `<p><br></p><div class="note-table-wrap" data-note-table="true" style="--note-table-width:${width}px;--note-table-columns:${safeColumns};--note-table-min-width:${safeColumns * 128}px;--note-table-row-height:${safeRowHeight}px"><div class="note-table-scroll"><table><tbody>${body}</tbody></table></div></div><p><br></p>`;
}

function stylePixels(element, property, fallback = 0) {
  const parsed = Number.parseFloat(element.style.getPropertyValue(property));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function tableRows(table) {
  return [...table.rows];
}

function tableFontSize(table) {
  const elements = [table, ...table.querySelectorAll("td, th, td *, th *")];
  return elements.reduce((largest, element) => Math.max(largest, Number.parseFloat(getComputedStyle(element).fontSize) || 16), 16);
}

let textMeasureContext = null;

function textWidth(text, element) {
  if (!textMeasureContext) textMeasureContext = document.createElement("canvas").getContext("2d");
  const style = getComputedStyle(element);
  if (!textMeasureContext) return String(text).length * (Number.parseFloat(style.fontSize) || 16) * .58;
  textMeasureContext.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return textMeasureContext.measureText(String(text)).width;
}

function preferredColumnWidth(cells, pageWidth) {
  const widths = cells.map((cell) => {
    const words = String(cell.innerText || cell.textContent || "").split(/\s+/).filter(Boolean);
    const longest = words.reduce((largest, word) => textWidth(word, cell) > textWidth(largest, cell) ? word : largest, "");
    const style = getComputedStyle(cell);
    const horizontalPadding = (Number.parseFloat(style.paddingLeft) || 0) + (Number.parseFloat(style.paddingRight) || 0) + 4;
    const fontWidth = (Number.parseFloat(style.fontSize) || 16) * 8;
    return Math.max(fontWidth, textWidth(longest, cell) + horizontalPadding);
  });
  const desired = Math.max(...widths, 96);
  return clamp(Math.ceil(desired), 96, Math.max(300, Math.min(900, Math.floor(pageWidth * .96))));
}

function syncTableMetrics(wrapper) {
  const table = wrapper.querySelector("table");
  if (!table) return;
  const rows = tableRows(table);
  const columns = clamp(rows[0]?.cells.length || 1, 1, 20);
  const fontSize = tableFontSize(table);
  const page = wrapper.closest("[data-note-page]");
  const pageStyle = page ? getComputedStyle(page) : null;
  const usablePageWidth = page ? page.clientWidth - (Number.parseFloat(pageStyle.paddingLeft) || 0) - (Number.parseFloat(pageStyle.paddingRight) || 0) : 680;
  let colgroup = table.querySelector(":scope > colgroup");
  if (!colgroup) {
    colgroup = document.createElement("colgroup");
    table.prepend(colgroup);
  }
  while (colgroup.children.length < columns) colgroup.append(document.createElement("col"));
  while (colgroup.children.length > columns) colgroup.lastElementChild.remove();
  const widths = Array.from({ length: columns }, (_, index) => preferredColumnWidth(rows.map((row) => row.cells[index]).filter(Boolean), usablePageWidth));
  const desiredWidth = widths.reduce((total, width) => total + width, 0);
  const currentWidth = Number.parseFloat(wrapper.style.getPropertyValue("--note-table-width")) || wrapper.getBoundingClientRect().width || TABLE_VIEWPORT_DEFAULT_WIDTH;
  const hasManualWidth = wrapper.style.getPropertyValue("--note-table-manual-width") === "1";
  const expandedWidth = clamp(currentWidth, TABLE_VIEWPORT_MIN_WIDTH, Math.max(TABLE_VIEWPORT_MIN_WIDTH, usablePageWidth));
  wrapper.style.setProperty("--note-table-width", `${Math.round(expandedWidth)}px`);
  if (hasManualWidth) wrapper.style.width = `${Math.round(expandedWidth)}px`;
  const visibleWidth = Math.min(expandedWidth, usablePageWidth);
  const tableWidth = Math.max(desiredWidth, visibleWidth);
  const remaining = Math.max(0, tableWidth - desiredWidth);
  widths.forEach((width, index) => { colgroup.children[index].style.width = `${Math.round(width + (remaining / columns))}px`; });
  wrapper.style.setProperty("--note-table-columns", String(columns));
  wrapper.style.setProperty("--note-table-min-width", `${Math.round(tableWidth)}px`);
  table.style.width = `${Math.round(tableWidth)}px`;
  if (!wrapper.style.getPropertyValue("--note-table-row-height")) wrapper.style.setProperty("--note-table-row-height", `${clamp(Math.round(fontSize * 2.35), 28, 220)}px`);
}

function updateTableDimensions(wrapper, rows, columns) {
  const table = wrapper.querySelector("table");
  if (!table) return;
  const safeRows = clamp(Number.parseInt(rows, 10) || 1, 1, 20);
  const safeColumns = clamp(Number.parseInt(columns, 10) || 1, 1, 20);
  const body = table.tBodies[0] || table.appendChild(document.createElement("tbody"));
  while (tableRows(table).length < safeRows) {
    const row = body.insertRow();
    Array.from({ length: safeColumns }, () => row.insertCell().append(document.createElement("br")));
  }
  while (tableRows(table).length > safeRows) tableRows(table).at(-1)?.remove();
  tableRows(table).forEach((row) => {
    while (row.cells.length < safeColumns) row.insertCell().append(document.createElement("br"));
    while (row.cells.length > safeColumns) row.deleteCell(row.cells.length - 1);
  });
  syncTableMetrics(wrapper);
}

function closeTableContext(workspace) {
  workspace.querySelector("[data-note-table-context]")?.remove();
}

function positionFloatingMenu(menu, clientX, clientY) {
  menu.hidden = false;
  const viewportPadding = 10;
  const bounds = menu.getBoundingClientRect();
  menu.style.left = `${Math.round(clamp(clientX, viewportPadding, Math.max(viewportPadding, window.innerWidth - bounds.width - viewportPadding)))}px`;
  menu.style.top = `${Math.round(clamp(clientY, viewportPadding, Math.max(viewportPadding, window.innerHeight - bounds.height - viewportPadding)))}px`;
}

function rgbToHex(value) {
  const parts = String(value || "").match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!parts || parts.length < 3) return "#2f8d61";
  return `#${parts.map((part) => clamp(Math.round(part), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const normalized = validTableColor(hex) || "#2f8d61";
  if (normalized === "transparent") return { r: 0, g: 0, b: 0 };
  return { r: Number.parseInt(normalized.slice(1, 3), 16), g: Number.parseInt(normalized.slice(3, 5), 16), b: Number.parseInt(normalized.slice(5, 7), 16) };
}

function rgbToHsv({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const difference = max - min;
  let hue = 0;
  if (difference) {
    if (max === red) hue = 60 * (((green - blue) / difference) % 6);
    else if (max === green) hue = 60 * ((blue - red) / difference + 2);
    else hue = 60 * ((red - green) / difference + 4);
  }
  return { h: (hue + 360) % 360, s: max ? difference / max : 0, v: max };
}

function hsvToHex({ h, s, v }) {
  const chroma = v * s;
  const segment = h / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0] : segment < 2 ? [secondary, chroma, 0] : segment < 3 ? [0, chroma, secondary] : segment < 4 ? [0, secondary, chroma] : segment < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  const match = v - chroma;
  return `#${[red, green, blue].map((value) => clamp(Math.round((value + match) * 255), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function tableRuleFor(config, target, position) {
  if (target === "border") return config.border.rule || { mode: "theme" };
  if (target === "row") return config.rows[String(position.row)] || { mode: "theme" };
  if (target === "column") return config.columns[String(position.column)] || { mode: "theme" };
  return config.cells[`${position.row}:${position.column}`] || { mode: "theme" };
}

function openTableColorPicker(workspace, anchor, rule, fallbackColor, onSave) {
  workspace.querySelector("[data-note-color-picker]")?.remove();
  let thematic = rule.mode !== "fixed";
  let transparent = rule.mode === "fixed" && rule.color === "transparent";
  let color = validTableColor(rule.color) || rgbToHex(fallbackColor);
  if (color === "transparent") color = "#2f8d61";
  let hsv = rgbToHsv(hexToRgb(color));
  const picker = document.createElement("section");
  picker.className = "note-color-picker";
  picker.dataset.noteColorPicker = "true";
  picker.innerHTML = `<header><strong>Cor</strong><button type="button" data-note-color-close aria-label="Fechar">×</button></header><div class="note-color-picker__surface" data-note-color-surface><i data-note-color-marker></i></div><div class="note-color-picker__hue"><span data-note-color-preview></span><input data-note-color-hue type="range" min="0" max="360" value="${Math.round(hsv.h)}" aria-label="Matiz" /></div><label class="note-color-picker__theme"><span><i data-note-color-theme-switch></i> Usar cor da temática</span><button type="button" data-note-color-theme-toggle aria-pressed="${thematic}"></button></label><div class="note-color-picker__values"><label>Hexadecimal<input data-note-color-hex value="${color}" maxlength="7" /></label><label>R<input data-note-color-r type="number" min="0" max="255" /></label><label>V<input data-note-color-g type="number" min="0" max="255" /></label><label>B<input data-note-color-b type="number" min="0" max="255" /></label></div><button class="note-color-picker__transparent" type="button" data-note-color-transparent>Usar transparente</button><footer><button class="button button--ghost button--small" type="button" data-note-color-cancel>Cancelar</button><button class="button button--primary button--small" type="button" data-note-color-save>Aceitar</button></footer>`;
  workspace.append(picker);
  const anchorBounds = anchor.getBoundingClientRect();
  positionFloatingMenu(picker, anchorBounds.right + 8, anchorBounds.top);
  const surface = picker.querySelector("[data-note-color-surface]");
  const marker = picker.querySelector("[data-note-color-marker]");
  const preview = picker.querySelector("[data-note-color-preview]");
  const themeButton = picker.querySelector("[data-note-color-theme-toggle]");
  const fields = {
    hex: picker.querySelector("[data-note-color-hex]"),
    r: picker.querySelector("[data-note-color-r]"),
    g: picker.querySelector("[data-note-color-g]"),
    b: picker.querySelector("[data-note-color-b]"),
    hue: picker.querySelector("[data-note-color-hue]"),
  };
  const update = () => {
    color = hsvToHex(hsv);
    const rgb = hexToRgb(color);
    // O refinamento visual global remove degradês. Este é um controle funcional,
    // portanto sua superfície precisa manter o gradiente de saturação/valor.
    surface.style.setProperty("background-image", `linear-gradient(to top, #000, rgba(0, 0, 0, 0)), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`, "important");
    marker.style.left = `${hsv.s * 100}%`;
    marker.style.top = `${(1 - hsv.v) * 100}%`;
    preview.style.background = thematic ? fallbackColor : transparent ? "transparent" : color;
    fields.hex.value = color;
    fields.r.value = String(rgb.r);
    fields.g.value = String(rgb.g);
    fields.b.value = String(rgb.b);
    fields.hue.value = String(Math.round(hsv.h));
    picker.classList.toggle("is-thematic", thematic);
    picker.classList.toggle("is-transparent", transparent);
    themeButton.setAttribute("aria-pressed", String(thematic));
  };
  const useCustom = () => { thematic = false; transparent = false; update(); };
  const setFromHex = (value) => {
    const valid = validTableColor(value);
    if (!valid || valid === "transparent") return;
    hsv = rgbToHsv(hexToRgb(valid));
    useCustom();
  };
  const moveSurface = (event) => {
    const bounds = surface.getBoundingClientRect();
    hsv.s = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    hsv.v = clamp(1 - ((event.clientY - bounds.top) / bounds.height), 0, 1);
    useCustom();
  };
  surface.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    moveSurface(event);
    const move = (moveEvent) => moveSurface(moveEvent);
    const stop = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", stop); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop, { once: true });
  });
  fields.hue.addEventListener("input", () => { hsv.h = Number(fields.hue.value); useCustom(); });
  fields.hex.addEventListener("change", () => setFromHex(fields.hex.value));
  [fields.r, fields.g, fields.b].forEach((field) => field.addEventListener("change", () => setFromHex(`#${[fields.r, fields.g, fields.b].map((input) => clamp(Number.parseInt(input.value, 10) || 0, 0, 255).toString(16).padStart(2, "0")).join("")}`)));
  themeButton.addEventListener("click", () => { thematic = !thematic; update(); });
  picker.querySelector("[data-note-color-transparent]").addEventListener("click", () => { thematic = false; transparent = true; update(); });
  const close = () => picker.remove();
  picker.querySelector("[data-note-color-close]").addEventListener("click", close);
  picker.querySelector("[data-note-color-cancel]").addEventListener("click", close);
  picker.querySelector("[data-note-color-save]").addEventListener("click", () => { onSave({ mode: thematic ? "theme" : "fixed", color: transparent ? "transparent" : color }); close(); });
  update();
}

function cellPositionInTable(table, cell) {
  const rows = tableRows(table);
  const row = Math.max(0, rows.indexOf(cell?.parentElement));
  return { row, column: Math.max(0, cell?.cellIndex || 0) };
}

function openTableContextMenu(workspace, wrapper, event, onChange, targetCell = null) {
  closeTableContext(workspace);
  const table = wrapper.querySelector("table");
  if (!table) return;
  const rows = tableRows(table).length || 1;
  const columns = tableRows(table)[0]?.cells.length || 1;
  const rowHeight = clamp(Math.round(stylePixels(wrapper, "--note-table-row-height", table.getBoundingClientRect().height / rows)), 28, 220);
  const borderWidth = clamp(Number.parseInt(getTableConfig(wrapper).border.width, 10) || 1, 1, 8);
  const position = cellPositionInTable(table, targetCell || tableRows(table)[0]?.cells[0]);
  const selectedCell = tableRows(table)[position.row]?.cells[position.column] || tableRows(table)[0]?.cells[0];
  const color = (target) => target === "border"
    ? getComputedStyle(selectedCell).borderTopColor
    : getComputedStyle(selectedCell).backgroundColor;
  const colorButton = (target, label) => `<button type="button" data-table-context-color="${target}"><i style="background:${rgbToHex(color(target))}"></i>${label}</button>`;
  const menu = document.createElement("section");
  menu.className = "note-table-context-menu";
  menu.dataset.noteTableContext = "true";
  menu.innerHTML = `<strong>Opções da tabela</strong><small>Célula ${position.row + 1} × ${position.column + 1}</small><div class="note-table-context-menu__fields"><label>Linhas<input data-table-context-rows type="number" min="1" max="20" value="${rows}" inputmode="numeric" /></label><label>Colunas<input data-table-context-columns type="number" min="1" max="20" value="${columns}" inputmode="numeric" /></label><label>Altura<input data-table-context-height type="number" min="28" max="220" value="${rowHeight}" inputmode="numeric" /></label><label>Borda<input data-table-context-border-width type="number" min="1" max="8" value="${borderWidth}" inputmode="numeric" /></label></div><div class="note-table-context-menu__colors">${colorButton("border", "Cor da borda")}${colorButton("row", "Cor desta linha")}${colorButton("column", "Cor desta coluna")}${colorButton("cell", "Cor desta célula")}</div><div class="note-table-context-menu__actions"><button class="button button--danger button--small" type="button" data-table-context-delete>Apagar tabela</button></div>`;
  workspace.append(menu);
  positionFloatingMenu(menu, event.clientX, event.clientY);
  const updateDimensions = () => {
    updateTableDimensions(wrapper, menu.querySelector("[data-table-context-rows]").value, menu.querySelector("[data-table-context-columns]").value);
    const height = clamp(Number.parseInt(menu.querySelector("[data-table-context-height]").value, 10) || rowHeight, 28, 220);
    const width = clamp(Number.parseInt(menu.querySelector("[data-table-context-border-width]").value, 10) || borderWidth, 1, 8);
    wrapper.style.setProperty("--note-table-row-height", `${height}px`);
    const nextConfig = getTableConfig(wrapper);
    nextConfig.border.width = width;
    saveTableConfig(wrapper, nextConfig);
    applyTableVisuals(wrapper);
    syncTableMetrics(wrapper);
    onChange?.();
  };
  menu.querySelectorAll("[data-table-context-rows], [data-table-context-columns], [data-table-context-height], [data-table-context-border-width]").forEach((input) => input.addEventListener("change", updateDimensions));
  menu.querySelectorAll("[data-table-context-color]").forEach((button) => button.addEventListener("click", () => {
    const target = button.dataset.tableContextColor;
    const currentRule = tableRuleFor(getTableConfig(wrapper), target, position);
    const fallback = target === "border" ? getComputedStyle(selectedCell).borderTopColor : getComputedStyle(selectedCell).backgroundColor;
    openTableColorPicker(workspace, button, currentRule, fallback, (rule) => {
      updateTableColor(wrapper, target, position, rule);
      const refreshedColor = target === "border" ? getComputedStyle(selectedCell).borderTopColor : getComputedStyle(selectedCell).backgroundColor;
      button.querySelector("i").style.background = rule.mode === "theme" ? rgbToHex(refreshedColor) : rule.color;
      onChange?.();
    });
  }));
  menu.querySelector("[data-table-context-delete]").addEventListener("click", () => {
    wrapper.remove();
    closeTableContext(workspace);
    onChange?.();
  });
}

function pageBlockAtPointer(page, clientX, clientY) {
  const target = elementFromNode(document.elementFromPoint(clientX, clientY));
  if (!target || !page.contains(target)) return null;
  return [...page.children].find((child) => child !== target && child.contains(target) && !child.classList.contains("note-page__number"))
    || (target.parentElement === page && !target.classList.contains("note-page__number") ? target : null);
}

function moveTableInDocument(wrapper, page, clientX, clientY) {
  const target = pageBlockAtPointer(page, clientX, clientY);
  if (target && target !== wrapper) {
    const bounds = target.getBoundingClientRect();
    target.insertAdjacentElement(clientY > bounds.top + (bounds.height / 2) ? "afterend" : "beforebegin", wrapper);
    return true;
  }
  if (target === wrapper) return false;
  const pageNumber = page.querySelector(".note-page__number");
  const firstBlock = [...page.children].find((child) => !child.classList.contains("note-page__number"));
  if (clientY < (firstBlock?.getBoundingClientRect().top || Number.POSITIVE_INFINITY)) page.prepend(wrapper);
  else if (pageNumber) pageNumber.insertAdjacentElement("beforebegin", wrapper);
  else page.append(wrapper);
  return true;
}

function editorTableControls(pages, onChange) {
  const workspace = pages.closest(".modal--note-workspace");
  pages.querySelectorAll(".note-table-wrap").forEach((wrapper) => {
    wrapper.querySelectorAll(".note-table__drag, .note-table__resize").forEach((control) => control.remove());
    let table = wrapper.querySelector("table");
    if (!table) return;
    let scroll = wrapper.querySelector(":scope > .note-table-scroll");
    if (!scroll) {
      scroll = document.createElement("div");
      scroll.className = "note-table-scroll";
      table.replaceWith(scroll);
      scroll.append(table);
    }
    const columns = clamp(table.rows[0]?.cells.length || 1, 1, 20);
    const page = wrapper.closest("[data-note-page]");
    if (page && !wrapper.previousElementSibling) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      page.insertBefore(paragraph, wrapper);
    }
    if (page && (!wrapper.nextElementSibling || wrapper.nextElementSibling.classList.contains("note-page__number"))) {
      const paragraph = document.createElement("p");
      paragraph.innerHTML = "<br>";
      wrapper.insertAdjacentElement("afterend", paragraph);
    }
    wrapper.setAttribute("data-note-table", "true");
    wrapper.contentEditable = "false";
    table.contentEditable = "true";
    wrapper.style.removeProperty("--note-table-x");
    wrapper.style.removeProperty("--note-table-y");
    if (!wrapper.style.getPropertyValue("--note-table-width")) wrapper.style.setProperty("--note-table-width", `${TABLE_VIEWPORT_DEFAULT_WIDTH}px`);
    syncTableMetrics(wrapper);
    applyTableVisuals(wrapper);

    const drag = document.createElement("button");
    drag.type = "button";
    drag.className = "note-table__drag";
    drag.dataset.noteTableControl = "drag";
    drag.setAttribute("aria-label", "Mover tabela");
    drag.title = "Arraste para posicionar a tabela";
    drag.innerHTML = icon("organize", 13);
    const resize = document.createElement("button");
    resize.type = "button";
    resize.className = "note-table__resize";
    resize.dataset.noteTableControl = "resize";
    resize.setAttribute("aria-label", "Redimensionar tabela");
    resize.title = "Arraste para alterar a largura";
    resize.innerHTML = "↘";
    wrapper.append(drag, resize);

    resize.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      resize.setPointerCapture?.(event.pointerId);
      resize.classList.add("is-resizing");
      const page = wrapper.closest("[data-note-page]");
      if (!page) return;
      const pageRect = page.getBoundingClientRect();
      const pageStyle = getComputedStyle(page);
      const paddingRight = Number.parseFloat(pageStyle.paddingRight) || 0;
      const startRect = wrapper.getBoundingClientRect();
      const startWidth = startRect.width;
      const totalRows = Math.max(1, tableRows(table).length);
      const startRowHeight = stylePixels(wrapper, "--note-table-row-height", startRect.height / totalRows);
      let changed = false;
      const move = (moveEvent) => {
        const deltaX = moveEvent.clientX - event.clientX;
        const deltaY = moveEvent.clientY - event.clientY;
        const maxWidth = Math.max(TABLE_VIEWPORT_MIN_WIDTH, pageRect.right - paddingRight - startRect.left);
        const width = clamp(startWidth + deltaX, TABLE_VIEWPORT_MIN_WIDTH, maxWidth);
        wrapper.style.setProperty("--note-table-width", `${Math.round(width)}px`);
        wrapper.style.setProperty("--note-table-manual-width", "1");
        // A largura direta torna o redimensionamento imediato; a variável acima
        // é preservada na anotação e restaura a medida quando ela for reaberta.
        wrapper.style.width = `${Math.round(width)}px`;
        // A tabela pode ter uma largura calculada anteriormente. Atualizá-la
        // junto ao contêiner evita a sensação de que o puxador não respondeu.
        const minimumTableWidth = Number.parseFloat(wrapper.style.getPropertyValue("--note-table-min-width")) || TABLE_VIEWPORT_MIN_WIDTH;
        table.style.width = `${Math.round(Math.max(width, minimumTableWidth))}px`;
        const rowHeight = clamp(startRowHeight + (deltaY / totalRows), 28, 220);
        wrapper.style.setProperty("--note-table-row-height", `${Math.round(rowHeight)}px`);
        changed = true;
      };
      const stop = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", stop);
        document.removeEventListener("pointercancel", stop);
        if (resize.hasPointerCapture?.(event.pointerId)) resize.releasePointerCapture(event.pointerId);
        resize.classList.remove("is-resizing");
        if (changed) onChange?.();
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop, { once: true });
      document.addEventListener("pointercancel", stop, { once: true });
    });
    drag.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const page = wrapper.closest("[data-note-page]");
      if (!page) return;
      const preview = document.createElement("div");
      preview.className = "note-table-drag-preview";
      preview.innerHTML = `${icon("organize", 15)} Mover tabela`;
      document.body.append(preview);
      const placePreview = (moveEvent) => {
        preview.style.left = `${moveEvent.clientX + 14}px`;
        preview.style.top = `${moveEvent.clientY + 14}px`;
      };
      placePreview(event);
      wrapper.classList.add("is-table-moving");
      const move = (moveEvent) => placePreview(moveEvent);
      const stop = (stopEvent) => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", stop);
        document.removeEventListener("pointercancel", stop);
        preview.remove();
        wrapper.classList.remove("is-table-moving");
        if (stopEvent.type === "pointerup" && moveTableInDocument(wrapper, page, stopEvent.clientX, stopEvent.clientY)) onChange?.();
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop, { once: true });
      document.addEventListener("pointercancel", stop, { once: true });
    });
    if (!wrapper.dataset.noteTableContextBound) wrapper.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (workspace) openTableContextMenu(workspace, wrapper, event, onChange, elementFromNode(event.target)?.closest?.("td, th"));
    });
    wrapper.dataset.noteTableContextBound = "true";
  });
}

function serializeEditor(note, host) {
  const documentData = normalizeNote(note.anotacao, note.titulo);
  documentData.document.pages = [...host.querySelectorAll("[data-note-page]")].map((page, index) => {
    const copy = page.cloneNode(true);
    copy.querySelectorAll(".note-page__number").forEach((number) => number.remove());
    copy.querySelectorAll(".note-table__drag, .note-table__resize").forEach((control) => control.remove());
    copy.querySelectorAll("colgroup").forEach((group) => group.remove());
    return {
      id: page.dataset.notePage || `page_${index + 1}`,
      html: sanitizeHtml(copy.innerHTML),
    };
  });
  if (!documentData.document.pages.length) documentData.document.pages = createEmptyNote(note.titulo).document.pages;
  return documentData;
}

function selectedEditorBlock() {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  return element?.closest?.("h2, h3, p, li") || null;
}

export function openNoteEditor(note, { onSave, onDelete, onClosed } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = editorModal(note);
  document.body.classList.add("is-note-workspace-open");
  const workspace = modalRoot.querySelector(".modal--note-workspace");
  const pages = workspace.querySelector("[data-note-pages]");
  const snapshot = JSON.stringify(normalizeNote(note.anotacao, note.titulo));
  let dirty = false;
  let saving = false;
  let savedRange = null;
  let applyingFontSize = false;
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (selectionBelongsToPages(range, pages)) savedRange = range.cloneRange();
  };
  const restoreSelection = () => {
    if (!savedRange || !selectionBelongsToPages(savedRange, pages)) return false;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  };
  const closeEditorMenus = () => {
    workspace.querySelectorAll("[data-note-format-menu], [data-note-table-menu]").forEach((menu) => { menu.hidden = true; });
    workspace.querySelectorAll("[data-note-format-trigger], [data-note-table-trigger]").forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  };
  const openEditorMenu = (menu, trigger) => {
    if (menu.parentElement !== workspace) workspace.append(menu);
    const triggerRect = trigger.getBoundingClientRect();
    positionFloatingMenu(menu, triggerRect.left, triggerRect.bottom + 8);
  };
  const refreshTextControls = () => {
    const block = selectedEditorBlock();
    if (!block || !pages.contains(block)) return;
    const labels = { P: "Texto", H2: "Título", H3: "Subtítulo" };
    const label = labels[block.tagName] || "Texto";
    workspace.querySelector("[data-note-format-label]").textContent = label;
    workspace.querySelectorAll("[data-note-block]").forEach((button) => button.classList.toggle("is-active", button.dataset.noteBlock.toUpperCase() === block.tagName));
    const alignment = getComputedStyle(block).textAlign;
    const activeAlignment = ["center", "right", "justify"].includes(alignment) ? alignment : "left";
    workspace.querySelectorAll("[data-note-align]").forEach((button) => button.classList.toggle("is-active", button.dataset.noteAlign === activeAlignment));
    if (!applyingFontSize) {
      const selectedElement = elementFromNode(window.getSelection()?.anchorNode);
      const selectedSize = Number.parseFloat(selectedElement ? getComputedStyle(selectedElement).fontSize : "") || Number.parseFloat(getComputedStyle(block).fontSize) || 16;
      workspace.querySelector("[data-note-font-size]").value = String(clamp(Math.round(selectedSize), 8, 72));
    }
  };
  const onSelectionChange = () => {
    rememberSelection();
    refreshTextControls();
  };
  const onDocumentClick = (event) => {
    if (!event.target.closest("[data-note-format-picker], [data-note-table-picker], [data-note-format-menu], [data-note-table-menu]")) closeEditorMenus();
    if (!event.target.closest("[data-note-table-context]")) closeTableContext(workspace);
  };
  const teardown = () => {
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("selectionchange", onSelectionChange);
    document.removeEventListener("click", onDocumentClick);
    document.body.classList.remove("is-note-workspace-open");
    closeModal();
  };
  const close = () => { teardown(); onClosed?.(); };
  const value = () => serializeEditor(note, workspace);
  const isDirty = () => dirty || JSON.stringify(value()) !== snapshot;
  const save = async () => {
    if (saving) return;
    const button = workspace.querySelector("[data-save-note]");
    try {
      saving = true;
      setButtonLoading(button, true);
      const updated = await onSave(value());
      teardown();
      onClosed?.(updated);
    } catch (error) {
      saving = false;
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar a anotação.", "error");
    }
  };
  const requestClose = () => {
    if (saving) return;
    if (!isDirty()) return close();
    noteConfirm(workspace, {
      iconName: "save",
      title: "Salvar alterações antes de sair?",
      message: "A anotação tem mudanças que ainda não foram salvas.",
      confirmLabel: "Salvar alterações",
      cancelLabel: "Descartar",
      onConfirm: save,
      onCancel: close,
    });
  };
  const appendPage = () => {
    const number = pages.querySelectorAll("[data-note-page]").length + 1;
    const page = document.createElement("article");
    page.className = "note-page note-page--editable";
    page.contentEditable = "true";
    page.spellcheck = true;
    page.dataset.notePage = `page_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${number}`}`;
    page.innerHTML = `<p><br></p><small contenteditable="false" class="note-page__number">Página ${number}</small>`;
    pages.append(page);
    requestAnimationFrame(() => pages.scrollTo({ top: pages.scrollHeight, behavior: "smooth" }));
    page.focus();
    dirty = true;
  };
  const applyFontSize = () => {
    const input = workspace.querySelector("[data-note-font-size]");
    const size = Number.parseInt(input.value, 10);
    if (!Number.isFinite(size) || size < 8 || size > 72) return;
    applyingFontSize = true;
    if (!restoreSelection()) {
      applyingFontSize = false;
      return;
    }
    document.execCommand("fontSize", false, "7");
    pages.querySelectorAll("font[size='7']").forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = `${size}px`;
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
    pages.querySelectorAll(".note-table-wrap").forEach(syncTableMetrics);
    input.value = String(size);
    applyingFontSize = false;
    dirty = true;
    rememberSelection();
  };
  const insertTable = () => {
    const rows = workspace.querySelector("[data-note-table-rows]").value;
    const columns = workspace.querySelector("[data-note-table-columns]").value;
    const rowHeight = workspace.querySelector("[data-note-table-row-height]").value;
    const markup = createTableMarkup(rows, columns, rowHeight);
    if (restoreSelection()) document.execCommand("insertHTML", false, markup);
    else {
      const lastPage = [...pages.querySelectorAll("[data-note-page]")].at(-1);
      const pageNumber = lastPage?.querySelector(".note-page__number");
      if (pageNumber) pageNumber.insertAdjacentHTML("beforebegin", markup);
      else lastPage?.insertAdjacentHTML("beforeend", markup);
    }
    editorTableControls(pages, () => { dirty = true; });
    closeEditorMenus();
    dirty = true;
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") requestClose();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(); }
  };
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("click", onDocumentClick);
  workspace.querySelectorAll("[data-note-command]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      if (!restoreSelection()) return;
      document.execCommand(button.dataset.noteCommand, false);
      dirty = true;
      refreshTextControls();
    });
  });
  workspace.querySelectorAll("[data-note-block]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      if (!restoreSelection()) return;
      const tagName = button.dataset.noteBlock.toUpperCase();
      const currentBlock = selectedEditorBlock();
      if (!currentBlock || !pages.contains(currentBlock)) return;
      if (currentBlock.tagName !== tagName) {
        document.execCommand("formatBlock", false, tagName);
        dirty = true;
      }
      workspace.querySelector("[data-note-format-label]").textContent = button.textContent;
      closeEditorMenus();
      refreshTextControls();
    });
  });
  workspace.querySelector("[data-note-format-trigger]").addEventListener("mousedown", (event) => event.preventDefault());
  workspace.querySelector("[data-note-format-trigger]").addEventListener("click", () => {
    const menu = workspace.querySelector("[data-note-format-menu]");
    const willOpen = menu.hidden;
    closeEditorMenus();
    const trigger = workspace.querySelector("[data-note-format-trigger]");
    if (willOpen) openEditorMenu(menu, trigger);
    trigger.setAttribute("aria-expanded", String(willOpen));
  });
  workspace.querySelector("[data-note-table-trigger]").addEventListener("mousedown", (event) => event.preventDefault());
  workspace.querySelector("[data-note-table-trigger]").addEventListener("click", () => {
    const menu = workspace.querySelector("[data-note-table-menu]");
    const willOpen = menu.hidden;
    closeEditorMenus();
    const trigger = workspace.querySelector("[data-note-table-trigger]");
    if (willOpen) openEditorMenu(menu, trigger);
    trigger.setAttribute("aria-expanded", String(willOpen));
  });
  const fontSizeInput = workspace.querySelector("[data-note-font-size]");
  fontSizeInput.addEventListener("input", applyFontSize);
  fontSizeInput.addEventListener("change", () => {
    const value = clamp(Number.parseInt(fontSizeInput.value, 10) || 16, 8, 72);
    fontSizeInput.value = String(value);
    applyFontSize();
  });
  workspace.querySelectorAll("[data-note-align]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      if (!restoreSelection()) return;
      const commands = { left: "justifyLeft", center: "justifyCenter", right: "justifyRight", justify: "justifyFull" };
      document.execCommand(commands[button.dataset.noteAlign], false);
      dirty = true;
      refreshTextControls();
    });
  });
  workspace.querySelector("[data-insert-note-table]").addEventListener("mousedown", (event) => event.preventDefault());
  workspace.querySelector("[data-insert-note-table]").addEventListener("click", insertTable);
  pages.addEventListener("input", (event) => {
    dirty = true;
    elementFromNode(event.target)?.closest?.(".note-table-wrap") && syncTableMetrics(elementFromNode(event.target).closest(".note-table-wrap"));
  });
  workspace.querySelector("[data-add-note-page]").addEventListener("click", appendPage);
  workspace.querySelector("[data-save-note]").addEventListener("click", save);
  workspace.querySelectorAll("[data-close-note-editor]").forEach((button) => button.addEventListener("click", requestClose));
  modalRoot.querySelector("[data-note-editor-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) requestClose(); });
  workspace.querySelector("[data-delete-note]").addEventListener("click", () => noteConfirm(workspace, {
    iconName: "trash",
    title: "Apagar esta anotação?",
    message: "O documento e todas as suas páginas serão removidos.",
    confirmLabel: "Apagar anotação",
    tone: "button--danger",
    onConfirm: async () => {
      const button = workspace.querySelector("[data-delete-note]");
      try {
        setButtonLoading(button, true);
        await onDelete();
        teardown();
        onClosed?.(null, { deleted: true });
      } catch (error) {
        setButtonLoading(button, false);
        showToast(error.message || "Não foi possível apagar a anotação.", "error");
      }
    },
  }));
  editorTableControls(pages, () => { dirty = true; });
  pages.querySelector("[data-note-page]")?.focus();
  rememberSelection();
  refreshTextControls();
}

function viewerModal(note) {
  return `<div class="modal-backdrop modal-backdrop--note-workspace" data-note-viewer-backdrop><section class="modal modal--note-workspace modal--note-viewer" role="dialog" aria-modal="true" aria-labelledby="note-viewer-title"><header class="note-workspace__head"><div><span class="eyebrow">VISUALIZADOR DE ANOTAÇÃO</span><h2 id="note-viewer-title">${escapeHtml(note.titulo)}</h2></div><div><button class="button button--danger button--small" type="button" data-delete-note-view>${icon("trash", 15)} Apagar</button><button class="button button--secondary button--small" type="button" data-edit-note>${icon("edit", 15)} Editar</button><button class="icon-button" type="button" data-close-note-view aria-label="Fechar">${icon("close", 19)}</button></div></header><div class="note-viewer__tools"><button type="button" data-note-zoom="out" aria-label="Diminuir zoom">−</button><strong data-note-zoom-value>100%</strong><button type="button" data-note-zoom="in" aria-label="Aumentar zoom">+</button></div><main class="note-viewer__stage"><div class="note-viewer__pages" data-note-view-pages>${pagesHtml(note)}</div></main><footer class="note-viewer__footer"><button class="button button--ghost button--small" type="button" data-note-page-prev>${icon("arrowLeft", 15)} Anterior</button><span data-note-page-count></span><button class="button button--ghost button--small" type="button" data-note-page-next>Próxima ${icon("arrowRight", 15)}</button></footer><div class="note-modal-confirm" data-note-confirm hidden></div></section></div>`;
}

export function openNoteViewer(note, { onEdit, onDelete, onClosed } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = viewerModal(note);
  document.body.classList.add("is-note-workspace-open");
  const workspace = modalRoot.querySelector(".modal--note-workspace");
  workspace.querySelectorAll(".note-table-wrap").forEach((wrapper) => {
    applyTableVisuals(wrapper);
    syncTableMetrics(wrapper);
  });
  const pages = [...workspace.querySelectorAll(".note-page")];
  let index = 0;
  let zoom = 1;
  const close = () => { document.removeEventListener("keydown", onKeydown); document.body.classList.remove("is-note-workspace-open"); closeModal(); onClosed?.(); };
  const update = () => {
    pages.forEach((page, pageIndex) => { page.hidden = pageIndex !== index; });
    workspace.querySelector("[data-note-page-count]").textContent = `Página ${index + 1} de ${pages.length}`;
    workspace.querySelector("[data-note-page-prev]").disabled = index === 0;
    workspace.querySelector("[data-note-page-next]").disabled = index === pages.length - 1;
    workspace.querySelector("[data-note-view-pages]").style.setProperty("--note-zoom", String(zoom));
    workspace.querySelector("[data-note-zoom-value]").textContent = `${Math.round(zoom * 100)}%`;
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  workspace.querySelector("[data-close-note-view]").addEventListener("click", close);
  modalRoot.querySelector("[data-note-viewer-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  workspace.querySelector("[data-note-page-prev]").addEventListener("click", () => { index = Math.max(0, index - 1); update(); });
  workspace.querySelector("[data-note-page-next]").addEventListener("click", () => { index = Math.min(pages.length - 1, index + 1); update(); });
  workspace.querySelectorAll("[data-note-zoom]").forEach((button) => button.addEventListener("click", () => { zoom = Math.max(.6, Math.min(1.6, zoom + (button.dataset.noteZoom === "in" ? .1 : -.1))); update(); }));
  workspace.querySelector("[data-edit-note]").addEventListener("click", () => { document.body.classList.remove("is-note-workspace-open"); closeModal(); document.removeEventListener("keydown", onKeydown); onEdit?.(); });
  workspace.querySelector("[data-delete-note-view]").addEventListener("click", () => noteConfirm(workspace, {
    iconName: "trash",
    title: "Apagar esta anotação?",
    message: "O documento e todas as suas páginas serão removidos.",
    confirmLabel: "Apagar anotação",
    tone: "button--danger",
    onConfirm: async () => {
      const button = workspace.querySelector("[data-delete-note-view]");
      try {
        setButtonLoading(button, true);
        await onDelete?.();
        close();
      } catch (error) {
        setButtonLoading(button, false);
        showToast(error.message || "Não foi possível apagar a anotação.", "error");
      }
    },
  }));
  update();
}

export function bindNotesCatalog(root, { notes, references, scope, onBack, onCreate, onOpen }) {
  root.querySelector("[data-notes-back]")?.addEventListener("click", onBack);
  root.querySelectorAll("[data-create-note]").forEach((button) => button.addEventListener("click", () => openNoteCreate({ references, scope, onCreate })));
  root.querySelectorAll("[data-open-note]").forEach((button) => button.addEventListener("click", () => {
    const note = notes.find((item) => item.id === button.dataset.openNote);
    if (note) onOpen(note);
  }));
  const search = root.querySelector("[data-notes-search]");
  const filter = root.querySelector("[data-notes-discipline-filter]");
  const count = root.querySelector("[data-notes-count]");
  const empty = root.querySelector("[data-notes-empty-search]");
  const apply = () => {
    const query = normalized(search?.value || "");
    const discipline = filter?.value || "";
    let visible = 0;
    root.querySelectorAll("[data-open-note]").forEach((card) => {
      const show = (!query || card.dataset.noteSearch.includes(query)) && (!discipline || card.dataset.noteDiscipline === discipline);
      card.hidden = !show;
      card.classList.toggle("is-note-filtered", !show);
      if (show) visible += 1;
    });
    if (empty) empty.hidden = visible > 0 || (!query && !discipline);
    if (count) count.textContent = query || discipline ? `${visible} ${visible === 1 ? "resultado encontrado" : "resultados encontrados"}` : `${scope ? notes.filter((item) => String(item[scope.field]) === String(scope.record.id)).length : notes.length} anotações salvas`;
  };
  search?.addEventListener("input", apply);
  filter?.addEventListener("change", apply);
}
