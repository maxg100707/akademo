import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const normalize = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .trim();

const same = (first, second) => String(first || "") === String(second || "");
const findById = (items, id) => items.find((item) => same(item.id, id));

function scopeCopy(scope) {
  if (scope?.type === "lesson") return { back: "Aula", title: "Termos desta aula" };
  if (scope?.type === "exam") return { back: "Prova", title: "Termos desta prova" };
  if (scope?.type === "presentation") return { back: "Apresentação", title: "Termos desta apresentação" };
  return { back: "", title: "Glossário" };
}

function activityFor(term, references) {
  const discipline = findById(references.disciplines, term.disciplina);
  const lesson = findById(references.lessons, term.aula);
  const exam = findById(references.exams, term.prova);
  const presentation = findById(references.presentations, term.apresentacao);
  if (lesson) return { kind: "Aula", title: lesson.tema || "Aula", iconName: "book", discipline };
  if (exam) return { kind: "Prova", title: exam.titulo || "Prova", iconName: "exam", discipline };
  if (presentation) return { kind: "Apresentação", title: presentation.titulo || "Apresentação", iconName: "presentation", discipline };
  if (discipline) return { kind: "Disciplina", title: discipline.nome_disciplina, iconName: "graduation", discipline };
  return { kind: "Geral", title: "Sem vínculo acadêmico", iconName: "glossary", discipline: null };
}

function contextLabel(activity) {
  if (!activity.discipline) return "SEM DISCIPLINA";
  return activity.kind === "Disciplina" ? activity.discipline.nome_disciplina : `${activity.discipline.nome_disciplina} · ${activity.kind}`;
}

function termCard(term, references) {
  const activity = activityFor(term, references);
  const searchable = normalize([
    term.termo,
    term.definicao,
    term.exemplo,
    activity.kind,
    activity.title,
    activity.discipline?.nome_disciplina,
  ].join(" "));
  return `<button class="glossary-card" type="button" data-open-glossary-term="${escapeHtml(term.id)}" data-glossary-search="${escapeHtml(searchable)}" data-glossary-discipline="${escapeHtml(term.disciplina || "__none__")}"><span class="glossary-card__icon">${icon("glossary", 22)}</span><div><small>${escapeHtml(contextLabel(activity))}</small><strong>${escapeHtml(term.termo)}</strong><p>${escapeHtml(term.definicao)}</p><span class="glossary-card__context">${icon(activity.iconName, 13)} ${escapeHtml(activity.title)}</span></div>${icon("arrowRight", 16)}</button>`;
}

export function glossaryView({ terms, references, scope }) {
  const copy = scopeCopy(scope);
  const scoped = scope ? terms.filter((term) => same(term[scope.field], scope.record.id)) : terms;
  const grid = scoped.length
    ? scoped.map((term) => termCard(term, references)).join("")
    : `<section class="glossary-empty"><span>${icon("glossary", 29)}</span><h2>Seu glossário começa aqui</h2><p>Guarde definições, exemplos e conceitos importantes para consultar quando precisar.</p><button class="button button--secondary" type="button" data-create-glossary-term>${icon("plus", 16)} Adicionar termo</button></section>`;
  return `<section class="page glossary-page">${scope ? `<button class="back-link" type="button" data-glossary-back>${icon("arrowLeft", 18)} ${copy.back}</button>` : ""}<div class="glossary-toolbar"><label class="field glossary-toolbar__search"><span class="visually-hidden">Buscar no glossário</span><span class="field__control">${icon("search", 17)}<input data-glossary-search-input autocomplete="off" placeholder="Buscar por termo, definição, exemplo ou vínculo" /></span></label>${!scope ? `<label class="field glossary-toolbar__filter"><span class="visually-hidden">Filtrar por disciplina</span><span class="field__control">${icon("graduation", 17)}<select data-glossary-discipline-filter><option value="">Todas as disciplinas</option><option value="__none__">Sem disciplina</option>${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label>` : ""}<button class="button button--primary" type="button" data-create-glossary-term>${icon("plus", 17)} Adicionar termo</button></div><div class="glossary-toolbar__meta"><p>${scope ? escapeHtml(copy.title) : "Conceitos organizados para você estudar com mais clareza."}</p><strong data-glossary-count>${scoped.length} ${scoped.length === 1 ? "termo salvo" : "termos salvos"}</strong></div><section class="glossary-grid" data-glossary-grid>${grid}</section><p class="glossary-search-empty" data-glossary-empty hidden>Nenhum termo corresponde à sua busca ou filtro.</p></section>`;
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

function selectedActivity(term) {
  if (term?.aula) return `lesson:${term.aula}`;
  if (term?.prova) return `exam:${term.prova}`;
  if (term?.apresentacao) return `presentation:${term.apresentacao}`;
  return "";
}

function formModal({ term = null, references, scope }) {
  const editing = Boolean(term);
  const disciplineId = scope?.disciplineId || term?.disciplina || "";
  const target = scope?.type ? `${scope.type}:${scope.record.id}` : selectedActivity(term);
  const discipline = findById(references.disciplines, disciplineId);
  return `<div class="modal-backdrop" data-glossary-form-backdrop><section class="modal modal--glossary-form" role="dialog" aria-modal="true" aria-labelledby="glossary-form-title"><form data-glossary-form novalidate><header class="glossary-modal__head"><div><span class="eyebrow">${editing ? "EDITAR TERMO" : "NOVO TERMO"}</span><h2 id="glossary-form-title">${editing ? escapeHtml(term.termo) : "Adicionar ao glossário"}</h2><p>Associe o conceito a uma disciplina ou atividade somente quando isso ajudar sua organização.</p></div><button class="icon-button" type="button" data-close-glossary-form aria-label="Fechar">${icon("close", 19)}</button></header><div class="glossary-form__fields"><label class="field"><span>Termo</span><span class="field__control">${icon("glossary", 17)}<input name="term" maxlength="180" value="${escapeHtml(term?.termo || "")}" placeholder="Ex.: Distribuição normal" required autofocus /></span></label><label class="field"><span>Definição</span><textarea class="field__textarea" name="definition" maxlength="5000" rows="4" placeholder="Explique o conceito de forma clara" required>${escapeHtml(term?.definicao || "")}</textarea></label><label class="field"><span>Exemplo <em>opcional</em></span><textarea class="field__textarea" name="example" maxlength="4000" rows="3" placeholder="Mostre uma aplicação, situação ou fórmula relacionada">${escapeHtml(term?.exemplo || "")}</textarea></label>${scope ? `<section class="glossary-fixed-context"><span>${icon(scope.type === "lesson" ? "book" : scope.type === "exam" ? "exam" : "presentation", 19)}</span><div><small>VINCULADO A</small><strong>${escapeHtml(discipline?.nome_disciplina || "Disciplina")}</strong><p>${escapeHtml(scope.record.tema || scope.record.titulo || "Atividade")}</p></div></section><input name="disciplineId" type="hidden" value="${escapeHtml(disciplineId)}"/><input name="target" type="hidden" value="${escapeHtml(target)}"/>` : `<label class="field"><span>Disciplina <em>opcional</em></span><span class="field__control">${icon("graduation", 17)}<select name="disciplineId" data-glossary-discipline><option value="">Termo geral — sem disciplina</option>${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}" ${same(item.id, disciplineId) ? "selected" : ""}>${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label><label class="field"><span>Vincular a <em>opcional</em></span><span class="field__control">${icon("organize", 17)}<select name="target" data-glossary-target ${disciplineId ? "" : "disabled"}>${targetOptions(disciplineId, references, target)}</select></span></label>`}</div><footer class="modal__actions"><button class="button button--ghost" type="button" data-close-glossary-form>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} ${editing ? "Salvar alterações" : "Salvar termo"}</button></footer><div class="glossary-confirm" data-glossary-confirm hidden></div></form></section></div>`;
}

function inlineConfirm(host, { title, message, confirmLabel, tone = "button--primary", onConfirm, onCancel }) {
  const layer = host.querySelector("[data-glossary-confirm]");
  layer.hidden = false;
  layer.innerHTML = `<div><span>${icon(tone === "button--danger" ? "trash" : "save", 20)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p><footer><button type="button" class="button button--ghost button--small" data-glossary-confirm-cancel>Descartar</button><button type="button" class="button ${tone} button--small" data-glossary-confirm-action>${escapeHtml(confirmLabel)}</button></footer></div>`;
  const clear = () => { layer.hidden = true; layer.innerHTML = ""; };
  layer.querySelector("[data-glossary-confirm-cancel]").addEventListener("click", () => { clear(); onCancel?.(); });
  layer.querySelector("[data-glossary-confirm-action]").addEventListener("click", () => { clear(); onConfirm?.(); });
}

export function openGlossaryForm({ term = null, references, scope = null, onSave, onClosed }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = formModal({ term, references, scope });
  const form = modalRoot.querySelector("[data-glossary-form]");
  const dialog = modalRoot.querySelector(".modal--glossary-form");
  let dirty = false;
  let saving = false;
  const close = (meta = {}) => { document.removeEventListener("keydown", onKeydown); closeModal(); onClosed?.(meta); };
  const submit = async () => {
    if (saving || !form.reportValidity()) return null;
    const data = new FormData(form);
    const [type, id] = String(data.get("target") || "").split(":");
    const values = {
      term: data.get("term"),
      definition: data.get("definition"),
      example: data.get("example"),
      disciplineId: data.get("disciplineId"),
      lessonId: type === "lesson" ? id : "",
      examId: type === "exam" ? id : "",
      presentationId: type === "presentation" ? id : "",
    };
    const button = form.querySelector("[type=submit]");
    saving = true;
    try {
      setButtonLoading(button, true);
      const saved = await onSave(values);
      dirty = false;
      close({ saved, created: !term });
      return saved;
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar o termo.", "error");
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
      message: "Este termo possui mudanças que ainda não foram salvas.",
      confirmLabel: "Salvar alterações",
      onCancel: () => close({ discarded: true }),
      onConfirm: () => { submit(); },
    });
  };
  const onKeydown = (event) => { if (event.key === "Escape") requestClose(); };
  document.addEventListener("keydown", onKeydown);
  form.addEventListener("input", () => { dirty = true; });
  form.addEventListener("change", () => { dirty = true; });
  const discipline = form.querySelector("[data-glossary-discipline]");
  const target = form.querySelector("[data-glossary-target]");
  discipline?.addEventListener("change", () => {
    target.disabled = !discipline.value;
    target.innerHTML = targetOptions(discipline.value, references);
  });
  form.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
  modalRoot.querySelectorAll("[data-close-glossary-form]").forEach((button) => button.addEventListener("click", requestClose));
  modalRoot.querySelector("[data-glossary-form-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) requestClose(); });
}

function viewerModal(term, references) {
  const activity = activityFor(term, references);
  const detail = activity.discipline ? activity.kind === "Disciplina" ? "Somente disciplina" : `${activity.kind} · ${activity.title}` : "Sem vínculo acadêmico";
  return `<div class="modal-backdrop" data-glossary-viewer-backdrop><section class="modal modal--glossary-viewer" role="dialog" aria-modal="true" aria-labelledby="glossary-viewer-title"><header class="glossary-modal__head"><div><span class="eyebrow">GLOSSÁRIO</span><h2 id="glossary-viewer-title">${escapeHtml(term.termo)}</h2><p>${icon(activity.iconName, 14)} ${escapeHtml(detail)}</p></div><div><button class="button button--danger button--small" type="button" data-delete-glossary-term>${icon("trash", 15)} Apagar</button><button class="button button--secondary button--small" type="button" data-edit-glossary-term>${icon("edit", 15)} Editar</button><button class="icon-button" type="button" data-close-glossary-viewer aria-label="Fechar">${icon("close", 19)}</button></div></header><main class="glossary-viewer__body"><section><small>DEFINIÇÃO</small><p>${escapeHtml(term.definicao)}</p></section>${term.exemplo ? `<section><small>EXEMPLO</small><p>${escapeHtml(term.exemplo)}</p></section>` : ""}<aside><span>${icon("graduation", 17)}</span><div><small>DISCIPLINA</small><strong>${escapeHtml(activity.discipline?.nome_disciplina || "Sem disciplina")}</strong></div><span>${icon(activity.iconName, 17)}</span><div><small>VÍNCULO</small><strong>${escapeHtml(activity.title)}</strong></div></aside></main><div class="glossary-confirm" data-glossary-confirm hidden></div></section></div>`;
}

export function openGlossaryViewer(term, { references, onEdit, onDelete } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = viewerModal(term, references);
  const dialog = modalRoot.querySelector(".modal--glossary-viewer");
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-glossary-viewer]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-glossary-viewer-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  modalRoot.querySelector("[data-edit-glossary-term]").addEventListener("click", () => { close(); onEdit?.(); });
  modalRoot.querySelector("[data-delete-glossary-term]").addEventListener("click", () => inlineConfirm(dialog, {
    title: "Apagar este termo?",
    message: "A definição e o exemplo não poderão ser recuperados.",
    confirmLabel: "Apagar termo",
    tone: "button--danger",
    onCancel: () => {},
    onConfirm: async () => {
      try { await onDelete?.(); close(); } catch (error) { showToast(error.message || "Não foi possível apagar o termo.", "error"); }
    },
  }));
}

export function bindGlossaryCatalog(root, { terms, references, scope, onBack, onCreate, onOpen }) {
  root.querySelector("[data-glossary-back]")?.addEventListener("click", onBack);
  const create = () => openGlossaryForm({ references, scope, onSave: onCreate });
  root.querySelectorAll("[data-create-glossary-term]").forEach((button) => button.addEventListener("click", create));
  root.querySelectorAll("[data-open-glossary-term]").forEach((button) => button.addEventListener("click", () => {
    const term = findById(terms, button.dataset.openGlossaryTerm);
    if (term) onOpen(term);
  }));

  const search = root.querySelector("[data-glossary-search-input]");
  const filter = root.querySelector("[data-glossary-discipline-filter]");
  const count = root.querySelector("[data-glossary-count]");
  const empty = root.querySelector("[data-glossary-empty]");
  const initialEmpty = root.querySelector(".glossary-empty");
  const apply = () => {
    const words = normalize(search?.value || "").split(/\s+/).filter(Boolean);
    const discipline = filter?.value || "";
    const searching = words.length > 0;
    let visible = 0;
    root.querySelectorAll("[data-open-glossary-term]").forEach((card) => {
      const haystack = card.dataset.glossarySearch || "";
      const matches = (!words.length || words.every((word) => haystack.includes(word))) && (!discipline || card.dataset.glossaryDiscipline === discipline);
      card.hidden = !matches;
      card.classList.toggle("is-search-hidden", !matches);
      if (matches) visible += 1;
    });
    if (count) count.textContent = `${visible} ${visible === 1 ? "termo salvo" : "termos salvos"}`;
    root.classList.toggle("is-glossary-searching", searching);
    if (initialEmpty) initialEmpty.hidden = searching || Boolean(discipline);
    if (empty) empty.hidden = visible > 0 || (!words.length && !discipline);
  };
  search?.addEventListener("input", apply);
  filter?.addEventListener("change", apply);
}
