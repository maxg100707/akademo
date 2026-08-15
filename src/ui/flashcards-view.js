import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const normalize = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .replace(/\s+/g, " ")
  .trim();
const same = (first, second) => String(first || "") === String(second || "");
const findById = (items, id) => (items || []).find((item) => same(item.id, id));
const cardList = (value) => Array.isArray(value) ? value : [];

function scopeCopy(scope) {
  if (scope?.type === "lesson") return { back: "Aula", title: "Flashcards desta aula" };
  if (scope?.type === "exam") return { back: "Prova", title: "Flashcards desta prova" };
  if (scope?.type === "presentation") return { back: "Apresentação", title: "Flashcards desta apresentação" };
  return { back: "", title: "Flashcards" };
}

function activityFor(collection, references) {
  const discipline = findById(references.disciplines, collection.disciplina);
  const lesson = findById(references.lessons, collection.aula);
  const exam = findById(references.exams, collection.prova);
  const presentation = findById(references.presentations, collection.apresentacao);
  if (lesson) return { kind: "Aula", title: lesson.tema || "Aula", iconName: "book", discipline };
  if (exam) return { kind: "Prova", title: exam.titulo || "Prova", iconName: "exam", discipline };
  if (presentation) return { kind: "Apresentação", title: presentation.titulo || "Apresentação", iconName: "presentation", discipline };
  if (discipline) return { kind: "Disciplina", title: discipline.nome_disciplina, iconName: "graduation", discipline };
  return { kind: "Geral", title: "Sem disciplina", iconName: "flashcards", discipline: null };
}

function contextLabel(activity) {
  if (!activity.discipline) return "SEM DISCIPLINA";
  return activity.kind === "Disciplina"
    ? activity.discipline.nome_disciplina
    : `${activity.discipline.nome_disciplina} · ${activity.kind}`;
}

function collectionCard(collection, references) {
  const activity = activityFor(collection, references);
  const cards = cardList(collection.cards);
  const searchable = normalize([
    collection.tema_colecao,
    collection.descricao,
    activity.kind,
    activity.title,
    activity.discipline?.nome_disciplina,
    ...cards.flatMap((card) => [card.front, card.back]),
  ].join(" "));
  return `<button class="flashcards-collection" type="button" data-open-flashcards="${escapeHtml(collection.id)}" data-flashcards-search="${escapeHtml(searchable)}" data-flashcards-discipline="${escapeHtml(collection.disciplina || "__none__")}"><span class="flashcards-collection__icon">${icon("flashcards", 23)}</span><div class="flashcards-collection__copy"><small>${escapeHtml(contextLabel(activity))}</small><strong>${escapeHtml(collection.tema_colecao)}</strong>${collection.descricao ? `<p>${escapeHtml(collection.descricao)}</p>` : `<p class="flashcards-collection__placeholder">Conjunto pronto para revisar.</p>`}<span>${icon(activity.iconName, 13)} ${escapeHtml(activity.title)}</span></div><em>${cards.length} ${cards.length === 1 ? "card" : "cards"}</em></button>`;
}

export function flashcardsView({ collections, references, scope }) {
  const copy = scopeCopy(scope);
  const scoped = scope ? collections.filter((collection) => same(collection[scope.field], scope.record.id)) : collections;
  const grid = scoped.length
    ? scoped.map((collection) => collectionCard(collection, references)).join("")
    : `<section class="flashcards-empty"><span>${icon("flashcards", 30)}</span><h2>Seu primeiro conjunto começa aqui</h2><p>Crie cards de frente e verso para revisar conceitos no seu ritmo.</p><button class="button button--secondary" type="button" data-create-flashcards>${icon("plus", 16)} Adicionar conjunto</button></section>`;
  return `<section class="page flashcards-page">${scope ? `<button class="back-link" type="button" data-flashcards-back>${icon("arrowLeft", 18)} ${copy.back}</button>` : ""}<div class="flashcards-toolbar"><label class="field flashcards-toolbar__search"><span class="visually-hidden">Buscar conjuntos de flashcards</span><span class="field__control">${icon("search", 17)}<input data-flashcards-search-input autocomplete="off" placeholder="Buscar tema, descrição, disciplina ou conteúdo" /></span></label>${!scope ? `<label class="field flashcards-toolbar__filter"><span class="visually-hidden">Filtrar por disciplina</span><span class="field__control">${icon("graduation", 17)}<select data-flashcards-discipline-filter><option value="">Todas as disciplinas</option><option value="__none__">Sem disciplina</option>${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label>` : ""}<button class="button button--primary" type="button" data-create-flashcards>${icon("plus", 17)} Adicionar conjunto</button></div><div class="flashcards-toolbar__meta"><p>${scope ? escapeHtml(copy.title) : "Conjuntos curtos e práticos para suas revisões."}</p><strong data-flashcards-count>${scoped.length} ${scoped.length === 1 ? "conjunto" : "conjuntos"}</strong></div><section class="flashcards-grid" data-flashcards-grid>${grid}</section><p class="flashcards-search-empty" data-flashcards-empty hidden>Nenhum conjunto corresponde à sua busca ou filtro.</p></section>`;
}

function targetOptions(disciplineId, references, selected = "") {
  if (!disciplineId) return `<option value="">Escolha uma disciplina para vincular uma atividade</option>`;
  const options = [
    ["", "Nenhuma atividade específica"],
    ...references.lessons.filter((item) => same(item.disciplina, disciplineId)).map((item) => [`lesson:${item.id}`, `Aula · ${item.tema || "Sem tema"}`]),
    ...references.exams.filter((item) => same(item.disciplina, disciplineId)).map((item) => [`exam:${item.id}`, `Prova · ${item.titulo || "Sem título"}`]),
    ...references.presentations.filter((item) => same(item.disciplina, disciplineId)).map((item) => [`presentation:${item.id}`, `Apresentação · ${item.titulo || "Sem título"}`]),
  ];
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${same(value, selected) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function selectedActivity(collection) {
  if (collection?.aula) return `lesson:${collection.aula}`;
  if (collection?.prova) return `exam:${collection.prova}`;
  if (collection?.apresentacao) return `presentation:${collection.apresentacao}`;
  return "";
}

function cardRow(card, position) {
  const id = String(card?.id || `new-${Date.now()}-${position}-${Math.random().toString(16).slice(2)}`);
  return `<article class="flashcard-editor-card" data-flashcard-editor-card data-card-id="${escapeHtml(id)}"><header><span>${icon("flashcards", 16)} Card <b data-flashcard-position>${position}</b></span><button class="icon-button" type="button" data-remove-flashcard aria-label="Remover card">${icon("trash", 16)}</button></header><label class="field"><span>Frente</span><textarea class="field__textarea" data-card-front maxlength="6000" rows="3" placeholder="Pergunta, termo ou conceito">${escapeHtml(card?.front || card?.frente || "")}</textarea></label><label class="field"><span>Verso</span><textarea class="field__textarea" data-card-back maxlength="6000" rows="3" placeholder="Resposta, explicação ou lembrete">${escapeHtml(card?.back || card?.verso || "")}</textarea></label></article>`;
}

function fixedContext(scope, references, disciplineId) {
  const discipline = findById(references.disciplines, disciplineId);
  const iconName = scope.type === "lesson" ? "book" : scope.type === "exam" ? "exam" : "presentation";
  return `<section class="flashcards-fixed-context"><span>${icon(iconName, 19)}</span><div><small>VINCULADO A</small><strong>${escapeHtml(discipline?.nome_disciplina || "Disciplina")}</strong><p>${escapeHtml(scope.record.tema || scope.record.titulo || "Atividade")}</p></div></section>`;
}

function editorModal({ collection = null, references, scope }) {
  const editing = Boolean(collection);
  const disciplineId = scope?.disciplineId || collection?.disciplina || "";
  const activity = scope?.type ? `${scope.type}:${scope.record.id}` : selectedActivity(collection);
  const cards = cardList(collection?.cards).length ? cardList(collection.cards) : [{ front: "", back: "" }];
  return `<div class="modal-backdrop" data-flashcards-editor-backdrop><section class="modal modal--flashcards-editor" role="dialog" aria-modal="true" aria-labelledby="flashcards-editor-title"><form data-flashcards-editor novalidate><header class="flashcards-modal__head"><div><span class="eyebrow">${editing ? "EDITAR CONJUNTO" : "NOVO CONJUNTO"}</span><h2 id="flashcards-editor-title">${editing ? escapeHtml(collection.tema_colecao) : "Adicionar flashcards"}</h2><p>Crie quantos cards quiser. Cada um deve ter uma frente e um verso.</p></div><button class="icon-button" type="button" data-close-flashcards-editor aria-label="Fechar">${icon("close", 19)}</button></header><div class="flashcards-editor__body"><section class="flashcards-editor__fields"><label class="field"><span>Tema do conjunto</span><span class="field__control">${icon("flashcards", 17)}<input name="theme" maxlength="180" value="${escapeHtml(collection?.tema_colecao || "")}" placeholder="Ex.: Fórmulas de probabilidade" required autofocus /></span></label><label class="field"><span>Descrição <em>opcional</em></span><textarea class="field__textarea" name="description" maxlength="3000" rows="3" placeholder="O que este conjunto ajuda você a revisar?">${escapeHtml(collection?.descricao || "")}</textarea></label>${scope ? `${fixedContext(scope, references, disciplineId)}<input name="disciplineId" type="hidden" value="${escapeHtml(disciplineId)}"/><input name="target" type="hidden" value="${escapeHtml(activity)}"/>` : `<label class="field"><span>Disciplina <em>opcional</em></span><span class="field__control">${icon("graduation", 17)}<select name="disciplineId" data-flashcards-discipline><option value="">Conjunto geral — sem disciplina</option>${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}" ${same(item.id, disciplineId) ? "selected" : ""}>${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label><label class="field"><span>Vincular a <em>opcional</em></span><span class="field__control">${icon("organize", 17)}<select name="target" data-flashcards-target ${disciplineId ? "" : "disabled"}>${targetOptions(disciplineId, references, activity)}</select></span></label>`}</section><section class="flashcards-editor__cards"><div class="flashcards-editor__cards-head"><div><small>CARDS DO CONJUNTO</small><strong data-flashcard-total>${cards.length} ${cards.length === 1 ? "card" : "cards"}</strong></div><button class="button button--secondary button--small" type="button" data-add-flashcard>${icon("plus", 16)} Adicionar card</button></div><div class="flashcards-editor__cards-list" data-flashcards-editor-list>${cards.map((card, index) => cardRow(card, index + 1)).join("")}</div></section></div><footer class="modal__actions"><button class="button button--ghost" type="button" data-close-flashcards-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} ${editing ? "Salvar alterações" : "Salvar conjunto"}</button></footer><div class="flashcards-confirm" data-flashcards-confirm hidden></div></form></section></div>`;
}

function inlineConfirm(host, { title, message, confirmLabel, tone = "button--primary", onConfirm, onCancel }) {
  const layer = host.querySelector("[data-flashcards-confirm]");
  layer.hidden = false;
  layer.innerHTML = `<div><span>${icon(tone === "button--danger" ? "trash" : "save", 20)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p><footer><button type="button" class="button button--ghost button--small" data-flashcards-confirm-cancel>Descartar</button><button type="button" class="button ${tone} button--small" data-flashcards-confirm-action>${escapeHtml(confirmLabel)}</button></footer></div>`;
  const clear = () => { layer.hidden = true; layer.innerHTML = ""; };
  layer.querySelector("[data-flashcards-confirm-cancel]").addEventListener("click", () => { clear(); onCancel?.(); });
  layer.querySelector("[data-flashcards-confirm-action]").addEventListener("click", () => { clear(); onConfirm?.(); });
}

export function openFlashcardsEditor({ collection = null, references, scope = null, onSave, onClosed }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = editorModal({ collection, references, scope });
  const form = modalRoot.querySelector("[data-flashcards-editor]");
  const dialog = modalRoot.querySelector(".modal--flashcards-editor");
  const list = form.querySelector("[data-flashcards-editor-list]");
  const total = form.querySelector("[data-flashcard-total]");
  let dirty = false;
  let saving = false;
  const updatePositions = () => {
    const rows = [...list.querySelectorAll("[data-flashcard-editor-card]")];
    rows.forEach((row, index) => { row.querySelector("[data-flashcard-position]").textContent = String(index + 1); row.querySelector("[data-remove-flashcard]").disabled = rows.length < 2; });
    total.textContent = `${rows.length} ${rows.length === 1 ? "card" : "cards"}`;
  };
  const values = () => {
    const data = new FormData(form);
    const [type, id] = String(data.get("target") || "").split(":");
    return {
      theme: data.get("theme"),
      description: data.get("description"),
      disciplineId: data.get("disciplineId"),
      lessonId: type === "lesson" ? id : "",
      examId: type === "exam" ? id : "",
      presentationId: type === "presentation" ? id : "",
      cards: [...list.querySelectorAll("[data-flashcard-editor-card]")].map((row) => ({
        id: row.dataset.cardId,
        front: row.querySelector("[data-card-front]").value,
        back: row.querySelector("[data-card-back]").value,
      })),
    };
  };
  const close = (meta = {}) => { document.removeEventListener("keydown", onKeydown); closeModal(); onClosed?.(meta); };
  const submit = async () => {
    if (saving || !form.reportValidity()) return null;
    const button = form.querySelector("[type=submit]");
    saving = true;
    try {
      setButtonLoading(button, true);
      const saved = await onSave(values());
      dirty = false;
      close({ saved, created: !collection });
      return saved;
    } catch (error) {
      showToast(error.message || "Não foi possível salvar o conjunto.", "error");
      return null;
    } finally {
      saving = false;
      if (document.body.contains(button)) setButtonLoading(button, false);
    }
  };
  const requestClose = () => {
    if (saving) return;
    if (!dirty) return close();
    inlineConfirm(dialog, {
      title: "Salvar alterações antes de sair?",
      message: "Este conjunto possui mudanças que ainda não foram salvas.",
      confirmLabel: "Salvar alterações",
      onCancel: () => close({ discarded: true }),
      onConfirm: submit,
    });
  };
  const onKeydown = (event) => { if (event.key === "Escape") requestClose(); };
  const addCard = (card = null) => {
    list.insertAdjacentHTML("beforeend", cardRow(card, list.children.length + 1));
    updatePositions();
    dirty = true;
    list.lastElementChild?.querySelector("[data-card-front]")?.focus();
  };
  document.addEventListener("keydown", onKeydown);
  form.addEventListener("input", () => { dirty = true; });
  form.addEventListener("change", () => { dirty = true; });
  form.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-flashcard]");
    if (!remove) return;
    const rows = list.querySelectorAll("[data-flashcard-editor-card]");
    if (rows.length < 2) return;
    remove.closest("[data-flashcard-editor-card]").remove();
    dirty = true;
    updatePositions();
  });
  form.querySelector("[data-add-flashcard]").addEventListener("click", () => addCard());
  const discipline = form.querySelector("[data-flashcards-discipline]");
  const target = form.querySelector("[data-flashcards-target]");
  discipline?.addEventListener("change", () => { target.disabled = !discipline.value; target.innerHTML = targetOptions(discipline.value, references); });
  form.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
  modalRoot.querySelectorAll("[data-close-flashcards-editor]").forEach((button) => button.addEventListener("click", requestClose));
  modalRoot.querySelector("[data-flashcards-editor-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) requestClose(); });
  updatePositions();
}

function collectionViewer(collection, references) {
  const activity = activityFor(collection, references);
  const cards = cardList(collection.cards);
  return `<div class="modal-backdrop" data-flashcards-viewer-backdrop><section class="modal modal--flashcards-viewer" role="dialog" aria-modal="true" aria-labelledby="flashcards-viewer-title"><header class="flashcards-modal__head"><div><span class="eyebrow">CONJUNTO DE FLASHCARDS</span><h2 id="flashcards-viewer-title">${escapeHtml(collection.tema_colecao)}</h2><p>${icon(activity.iconName, 14)} ${escapeHtml(contextLabel(activity))}</p></div><button class="icon-button" type="button" data-close-flashcards-viewer aria-label="Fechar">${icon("close", 19)}</button></header><main class="flashcards-viewer__body">${collection.descricao ? `<p class="flashcards-viewer__description">${escapeHtml(collection.descricao)}</p>` : ""}<div class="flashcards-viewer__meta"><span>${icon("flashcards", 19)}<strong>${cards.length}</strong> ${cards.length === 1 ? "flashcard" : "flashcards"}</span><span>${icon(activity.iconName, 17)} ${escapeHtml(activity.title)}</span></div><p>Os cards serão embaralhados e exibidos uma única vez em cada revisão.</p></main><footer class="modal__actions"><button class="button button--danger button--small" type="button" data-delete-flashcards>${icon("trash", 15)} Apagar</button><span></span><button class="button button--secondary" type="button" data-edit-flashcards>${icon("edit", 16)} Editar</button><button class="button button--primary" type="button" data-start-flashcards>${icon("sparkles", 16)} Iniciar</button></footer><div class="flashcards-confirm" data-flashcards-confirm hidden></div></section></div>`;
}

function shuffled(cards) {
  const result = cards.map((card) => ({ ...card }));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function cardSideText(value) {
  return escapeHtml(value || "").replace(/\n/g, "<br/>");
}

function studyModal(collection) {
  return `<div class="modal-backdrop flashcards-study-backdrop" data-flashcards-study-backdrop><section class="modal modal--flashcards-study" role="dialog" aria-modal="true" aria-labelledby="flashcards-study-title"><header><div><span class="eyebrow">REVISÃO EM ANDAMENTO</span><h2 id="flashcards-study-title">${escapeHtml(collection.tema_colecao)}</h2></div><button class="icon-button" type="button" data-close-flashcards-study aria-label="Encerrar revisão">${icon("close", 20)}</button></header><main><div class="flashcards-study__stage" data-flashcards-stage></div><div class="flashcards-study__controls"><button class="button button--ghost" type="button" data-flashcards-previous hidden>${icon("arrowLeft", 16)} Anterior</button><button class="button button--primary" type="button" data-flashcards-next hidden></button></div></main></section></div>`;
}

export function openFlashcardsStudy(collection, { onFinished } = {}) {
  const cards = shuffled(cardList(collection.cards));
  if (!cards.length) return showToast("Este conjunto ainda não possui cards para revisar.", "error");
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = studyModal(collection);
  let index = 0;
  let flipped = false;
  const seenReverse = new Set();
  const stage = modalRoot.querySelector("[data-flashcards-stage]");
  const previous = modalRoot.querySelector("[data-flashcards-previous]");
  const next = modalRoot.querySelector("[data-flashcards-next]");
  const close = (finished = false) => { document.removeEventListener("keydown", onKeydown); closeModal(); if (finished) onFinished?.(); };
  const render = () => {
    const card = cards[index];
    stage.innerHTML = `<article class="flashcards-study-card ${flipped ? "is-flipped" : ""}" data-flashcards-study-card><header><span>${flipped ? "VERSO" : "FRENTE"}</span><strong>${index + 1} de ${cards.length}</strong></header><div class="flashcards-study-card__inner"><section class="flashcards-study-card__face flashcards-study-card__face--front"><p>${cardSideText(card.front)}</p><button class="button button--secondary" type="button" data-flip-flashcard>${icon("sparkles", 16)} Virar card</button></section><section class="flashcards-study-card__face flashcards-study-card__face--back"><p>${cardSideText(card.back)}</p><button class="button button--secondary" type="button" data-flip-flashcard>${icon("sparkles", 16)} Ver frente</button></section></div></article>`;
    previous.hidden = index === 0;
    const canAdvance = seenReverse.has(index);
    next.hidden = !canAdvance;
    next.innerHTML = index === cards.length - 1 ? `${icon("check", 16)} Finalizar` : `Próximo ${icon("arrowRight", 16)}`;
    stage.querySelectorAll("[data-flip-flashcard]").forEach((button) => button.addEventListener("click", () => {
      flipped = !flipped;
      if (flipped) seenReverse.add(index);
      render();
    }));
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
    if (event.key === "ArrowRight" && !next.hidden) next.click();
    if (event.key === "ArrowLeft" && !previous.hidden) previous.click();
    if (event.key === " ") { event.preventDefault(); stage.querySelector("[data-flip-flashcard]")?.click(); }
  };
  document.addEventListener("keydown", onKeydown);
  previous.addEventListener("click", () => { index -= 1; flipped = false; render(); });
  next.addEventListener("click", () => { if (index === cards.length - 1) close(true); else { index += 1; flipped = false; render(); } });
  modalRoot.querySelector("[data-close-flashcards-study]").addEventListener("click", () => close());
  modalRoot.querySelector("[data-flashcards-study-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  render();
}

export function openFlashcardsViewer(collection, { references, onEdit, onDelete } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = collectionViewer(collection, references);
  const dialog = modalRoot.querySelector(".modal--flashcards-viewer");
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelector("[data-close-flashcards-viewer]").addEventListener("click", close);
  modalRoot.querySelector("[data-flashcards-viewer-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  modalRoot.querySelector("[data-edit-flashcards]").addEventListener("click", () => { close(); onEdit?.(); });
  modalRoot.querySelector("[data-start-flashcards]").addEventListener("click", () => { close(); window.setTimeout(() => openFlashcardsStudy(collection), 0); });
  modalRoot.querySelector("[data-delete-flashcards]").addEventListener("click", () => inlineConfirm(dialog, {
    title: "Apagar este conjunto?",
    message: "Todos os flashcards deste conjunto serão removidos.",
    confirmLabel: "Apagar conjunto",
    tone: "button--danger",
    onConfirm: async () => {
      try { await onDelete?.(); close(); } catch (error) { showToast(error.message || "Não foi possível apagar o conjunto.", "error"); }
    },
  }));
}

export function bindFlashcardsCatalog(root, { collections, references, scope, onBack, onCreate, onOpen }) {
  root.querySelector("[data-flashcards-back]")?.addEventListener("click", onBack);
  root.querySelectorAll("[data-create-flashcards]").forEach((button) => button.addEventListener("click", () => openFlashcardsEditor({ references, scope, onSave: onCreate })));
  root.querySelectorAll("[data-open-flashcards]").forEach((button) => button.addEventListener("click", () => {
    const collection = findById(collections, button.dataset.openFlashcards);
    if (collection) onOpen(collection);
  }));
  const search = root.querySelector("[data-flashcards-search-input]");
  const filter = root.querySelector("[data-flashcards-discipline-filter]");
  const count = root.querySelector("[data-flashcards-count]");
  const empty = root.querySelector("[data-flashcards-empty]");
  const initialEmpty = root.querySelector(".flashcards-empty");
  const apply = () => {
    const words = normalize(search?.value || "").split(/\s+/).filter(Boolean);
    const discipline = filter?.value || "";
    let visible = 0;
    root.querySelectorAll("[data-open-flashcards]").forEach((card) => {
      const matches = (!words.length || words.every((word) => (card.dataset.flashcardsSearch || "").includes(word))) && (!discipline || card.dataset.flashcardsDiscipline === discipline);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    if (count) count.textContent = `${visible} ${visible === 1 ? "conjunto" : "conjuntos"}`;
    if (initialEmpty) initialEmpty.hidden = words.length > 0 || Boolean(discipline);
    if (empty) empty.hidden = visible > 0 || (!words.length && !discipline);
  };
  search?.addEventListener("input", apply);
  filter?.addEventListener("change", apply);
}
