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
  const allowed = new Set(["P", "BR", "DIV", "H2", "H3", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "U", "BLOCKQUOTE"]);
  template.content.querySelectorAll("*").forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
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
  return notePages(note).map((page, index) => `<article class="note-page ${editable ? "note-page--editable" : ""}" ${editable ? `contenteditable="true" spellcheck="true" data-note-page="${escapeHtml(page.id)}"` : ""}>${sanitizeHtml(page.html)}<small ${editable ? 'contenteditable="false"' : ""} class="note-page__number">Página ${index + 1}</small></article>`).join("");
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
  return `<div class="modal-backdrop modal-backdrop--note-workspace" data-note-editor-backdrop><section class="modal modal--note-workspace" role="dialog" aria-modal="true" aria-labelledby="note-editor-title"><header class="note-workspace__head"><div><span class="eyebrow">EDITOR DE ANOTAÇÃO</span><h2 id="note-editor-title">${escapeHtml(note.titulo)}</h2></div><div><button class="button button--danger button--small" type="button" data-delete-note>${icon("trash", 15)} Apagar</button><button class="button button--ghost button--small" type="button" data-close-note-editor>Fechar</button><button class="button button--primary button--small" type="button" data-save-note>${icon("save", 15)} Salvar</button></div></header><div class="note-editor-tools" aria-label="Ferramentas de edição"><button type="button" data-note-command="bold" title="Negrito"><strong>B</strong></button><button type="button" data-note-command="italic" title="Itálico"><em>I</em></button><button type="button" data-note-command="underline" title="Sublinhado"><u>U</u></button><span></span><button type="button" data-note-block="p">Texto</button><button type="button" data-note-block="h2">Título</button><button type="button" data-note-block="h3">Subtítulo</button><button type="button" data-note-command="insertUnorderedList" title="Lista">• Lista</button><button type="button" data-note-command="insertOrderedList" title="Lista numerada">1. Lista</button><button type="button" data-note-command="removeFormat" title="Limpar formatação">Limpar</button></div><main class="note-workspace__canvas" data-note-pages>${pagesHtml(note, { editable: true })}<button class="button button--secondary note-page-add" type="button" data-add-note-page>${icon("plus", 16)} Adicionar página</button></main><div class="note-modal-confirm" data-note-confirm hidden></div></section></div>`;
}

function serializeEditor(note, host) {
  const documentData = normalizeNote(note.anotacao, note.titulo);
  documentData.document.pages = [...host.querySelectorAll("[data-note-page]")].map((page, index) => {
    const copy = page.cloneNode(true);
    copy.querySelectorAll(".note-page__number").forEach((number) => number.remove());
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
  const teardown = () => { document.removeEventListener("keydown", onKeydown); document.body.classList.remove("is-note-workspace-open"); closeModal(); };
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
    page.scrollIntoView({ behavior: "smooth", block: "start" });
    page.focus();
    dirty = true;
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") requestClose();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); save(); }
  };
  document.addEventListener("keydown", onKeydown);
  workspace.querySelectorAll("[data-note-command]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => { document.execCommand(button.dataset.noteCommand, false); dirty = true; });
  });
  workspace.querySelectorAll("[data-note-block]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      const tagName = button.dataset.noteBlock.toUpperCase();
      const currentBlock = selectedEditorBlock();
      if (!currentBlock || !pages.contains(currentBlock)) return;
      if (currentBlock.tagName === tagName) return;
      document.execCommand("formatBlock", false, tagName);
      dirty = true;
    });
  });
  pages.addEventListener("input", () => { dirty = true; });
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
  pages.querySelector("[data-note-page]")?.focus();
}

function viewerModal(note) {
  return `<div class="modal-backdrop modal-backdrop--note-workspace" data-note-viewer-backdrop><section class="modal modal--note-workspace modal--note-viewer" role="dialog" aria-modal="true" aria-labelledby="note-viewer-title"><header class="note-workspace__head"><div><span class="eyebrow">VISUALIZADOR DE ANOTAÇÃO</span><h2 id="note-viewer-title">${escapeHtml(note.titulo)}</h2></div><div><button class="button button--danger button--small" type="button" data-delete-note-view>${icon("trash", 15)} Apagar</button><button class="button button--secondary button--small" type="button" data-edit-note>${icon("edit", 15)} Editar</button><button class="icon-button" type="button" data-close-note-view aria-label="Fechar">${icon("close", 19)}</button></div></header><div class="note-viewer__tools"><button type="button" data-note-zoom="out" aria-label="Diminuir zoom">−</button><strong data-note-zoom-value>100%</strong><button type="button" data-note-zoom="in" aria-label="Aumentar zoom">+</button></div><main class="note-viewer__stage"><div class="note-viewer__pages" data-note-view-pages>${pagesHtml(note)}</div></main><footer class="note-viewer__footer"><button class="button button--ghost button--small" type="button" data-note-page-prev>${icon("arrowLeft", 15)} Anterior</button><span data-note-page-count></span><button class="button button--ghost button--small" type="button" data-note-page-next>Próxima ${icon("arrowRight", 15)}</button></footer><div class="note-modal-confirm" data-note-confirm hidden></div></section></div>`;
}

export function openNoteViewer(note, { onEdit, onDelete, onClosed } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = viewerModal(note);
  document.body.classList.add("is-note-workspace-open");
  const workspace = modalRoot.querySelector(".modal--note-workspace");
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
