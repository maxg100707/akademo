import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, confirmModal, setButtonLoading, showToast } from "./components.js";

function orderedTasks(tasks) {
  return [...tasks].sort((first, second) => {
    if (Boolean(first.completa) !== Boolean(second.completa)) return Number(first.completa) - Number(second.completa);
    return new Date(first.prazo) - new Date(second.prazo);
  });
}

function deadlineLabel(value, withYear = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit",
  }).format(new Date(value)).replace(".", "");
}

function deadlineState(task) {
  if (task.completa) return { label: "Conclu\u00edda", tone: "completed" };
  const due = new Date(task.prazo);
  const now = new Date();
  if (due < now) return { label: "Atrasada", tone: "overdue" };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (due < today) return { label: "Vence hoje", tone: "today" };
  return { label: "Pendente", tone: "upcoming" };
}

function lessonLabel(lesson) {
  if (!lesson) return "Sem aula espec\u00edfica";
  return lesson.tema || "Aula registrada";
}

function taskCard(task, disciplines, lessons, compact = false) {
  const discipline = disciplines.find((item) => item.id === task.disciplina);
  const lesson = lessons.find((item) => item.id === task.aula);
  const state = deadlineState(task);
  return `<article class="task-card task-card--${state.tone} ${compact ? "task-card--compact" : ""}" data-open-task="${escapeHtml(task.id)}" role="button" tabindex="0" aria-label="Abrir tarefa ${escapeHtml(task.titulo)}"><button class="task-card__mark ${task.completa ? "is-complete" : ""}" type="button" data-toggle-task="${escapeHtml(task.id)}" aria-pressed="${Boolean(task.completa)}" aria-label="${task.completa ? "Marcar como pendente" : "Marcar como conclu\u00edda"}">${icon("check", 17)}</button><div class="task-card__main"><span>${escapeHtml(discipline?.nome_disciplina || "Disciplina")}</span><strong>${escapeHtml(task.titulo)}</strong>${lesson ? `<small>${icon("book", 12)} ${escapeHtml(lessonLabel(lesson))}</small>` : ""}</div><div class="task-card__deadline"><span class="task-card__state task-card__state--${state.tone}">${state.label}</span><strong>${deadlineLabel(task.prazo)}</strong></div></article>`;
}

function taskList(tasks, disciplines, lessons, { compact = false, emptyMessage = "Nenhuma tarefa foi cadastrada ainda." } = {}) {
  const ordered = orderedTasks(tasks);
  return `<div class="tasks-list ${compact ? "tasks-list--compact" : ""}">${ordered.length ? ordered.map((task) => taskCard(task, disciplines, lessons, compact)).join("") : `<div class="tasks-empty"><span>${icon("check", 25)}</span><h3>Sem tarefas por aqui</h3><p>${escapeHtml(emptyMessage)}</p></div>`}</div>`;
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 16);
}

function lessonOptions(lessons, disciplineId, selectedId) {
  const filtered = lessons.filter((lesson) => lesson.disciplina === disciplineId);
  return `<option value="">Sem aula espec\u00edfica</option>${filtered.map((lesson) => `<option value="${escapeHtml(lesson.id)}" ${lesson.id === selectedId ? "selected" : ""}>${escapeHtml(lessonLabel(lesson))}</option>`).join("")}`;
}

function taskEditorModal(task, disciplines, lessons, { prefillDisciplineId, prefillLessonId, lockLesson = false } = {}) {
  const disciplineId = task?.disciplina || prefillDisciplineId || "";
  const lessonId = task?.aula || prefillLessonId || "";
  const editing = Boolean(task);
  const lockedFields = lockLesson ? `<input type="hidden" name="disciplineId" value="${escapeHtml(disciplineId)}"/><input type="hidden" name="lessonId" value="${escapeHtml(lessonId)}"/>` : "";
  const disciplineField = lockLesson
    ? `<label class="field"><span>Disciplina</span><span class="field__control">${icon("book", 17)}<input value="${escapeHtml(disciplines.find((item) => item.id === disciplineId)?.nome_disciplina || "Disciplina")}" readonly /></span></label>`
    : `<label class="field"><span>Disciplina</span><span class="field__control">${icon("book", 17)}<select name="disciplineId" data-task-discipline required><option value="">Selecione a disciplina</option>${disciplines.map((discipline) => `<option value="${escapeHtml(discipline.id)}" ${discipline.id === disciplineId ? "selected" : ""}>${escapeHtml(discipline.nome_disciplina)}</option>`).join("")}</select></span></label>`;
  const lessonField = lockLesson
    ? `<label class="field"><span>Aula vinculada</span><span class="field__control">${icon("calendar", 17)}<input value="${escapeHtml(lessonLabel(lessons.find((item) => item.id === lessonId)))}" readonly /></span></label>`
    : `<label class="field"><span>Aula <em>opcional</em></span><span class="field__control">${icon("calendar", 17)}<select name="lessonId" data-task-lesson ${disciplineId ? "" : "disabled"}>${lessonOptions(lessons, disciplineId, lessonId)}</select></span></label>`;
  return `<div class="modal-backdrop" data-task-editor-backdrop><section class="modal modal--task-editor" role="dialog" aria-modal="true" aria-labelledby="task-editor-title"><form class="task-editor" data-task-editor novalidate><input type="hidden" name="completed" value="${task?.completa ? "true" : "false"}"/><div class="task-editor__head"><div><span class="eyebrow">${editing ? "EDITAR TAREFA" : "NOVA TAREFA"}</span><h2 id="task-editor-title">${editing ? "Atualize sua tarefa" : "Organize uma tarefa"}</h2><p>Defina o prazo e mantenha suas prioridades em dia.</p></div><button class="icon-button" type="button" data-close-task-editor aria-label="Fechar">${icon("close", 19)}</button></div>${lockedFields}<div class="task-editor__fields">${disciplineField}${lessonField}<label class="field"><span>T\u00edtulo</span><span class="field__control">${icon("check", 17)}<input name="title" maxlength="180" value="${escapeHtml(task?.titulo || "")}" placeholder="Ex.: Resolver lista de exerc\u00edcios" required autofocus /></span></label><label class="field"><span>Descri\u00e7\u00e3o <em>opcional</em></span><textarea class="field__textarea" name="description" maxlength="4000" placeholder="Inclua instru\u00e7\u00f5es, links ou anota\u00e7\u00f5es importantes.">${escapeHtml(task?.descricao || "")}</textarea></label><label class="field"><span>Data limite</span><span class="field__control">${icon("calendar", 17)}<input name="deadline" type="datetime-local" value="${toDateTimeLocal(task?.prazo)}" required /></span></label></div><div class="task-editor__actions">${editing ? `<button class="button button--danger" type="button" data-delete-task-editor>${icon("trash", 16)} Excluir</button>` : ""}<span></span><button class="button button--ghost" type="button" data-close-task-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} ${editing ? "Salvar tarefa" : "Adicionar tarefa"}</button></div></form></section></div>`;
}

export function openTaskEditor({ task = null, disciplines, lessons, prefillDisciplineId, prefillLessonId, lockLesson = false, onCreate, onUpdate, onDelete }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = taskEditorModal(task, disciplines, lessons, { prefillDisciplineId, prefillLessonId, lockLesson });
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  const form = modalRoot.querySelector("[data-task-editor]");
  const disciplineSelect = modalRoot.querySelector("[data-task-discipline]");
  const lessonSelect = modalRoot.querySelector("[data-task-lesson]");
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-task-editor]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-task-editor-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  disciplineSelect?.addEventListener("change", () => {
    const current = lessonSelect.value;
    lessonSelect.disabled = !disciplineSelect.value;
    lessonSelect.innerHTML = lessonOptions(lessons, disciplineSelect.value, current);
  });
  modalRoot.querySelector("[data-delete-task-editor]")?.addEventListener("click", async () => {
    if (!await confirmModal({ title: "Excluir esta tarefa?", message: `\u201c${task.titulo}\u201d ser\u00e1 removida da sua organiza\u00e7\u00e3o.`, confirmLabel: "Excluir tarefa", tone: "danger" })) return;
    try {
      await onDelete(task);
      document.removeEventListener("keydown", onKeydown);
    } catch (error) {
      showToast(error.message || "N\u00e3o foi poss\u00edvel excluir a tarefa.", "error");
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      const values = Object.fromEntries(new FormData(form));
      if (lockLesson) {
        values.disciplineId = prefillDisciplineId;
        values.lessonId = prefillLessonId;
      }
      if (task) await onUpdate(task.id, values);
      else await onCreate(values);
      close();
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "N\u00e3o foi poss\u00edvel salvar a tarefa.", "error");
    }
  });
  form.querySelector("input[name=title]")?.focus();
}

export function openTaskDetail({ task, disciplines, lessons, onCreate, onUpdate, onDelete }) {
  const discipline = disciplines.find((item) => item.id === task.disciplina);
  const lesson = lessons.find((item) => item.id === task.aula);
  const state = deadlineState(task);
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = `<div class="modal-backdrop" data-task-detail-backdrop><section class="modal modal--task-detail" role="dialog" aria-modal="true" aria-labelledby="task-detail-title"><button class="modal__close" type="button" data-close-task-detail aria-label="Fechar">${icon("close", 19)}</button><div class="task-detail__head"><span class="task-detail__mark ${task.completa ? "is-complete" : ""}">${icon("check", 20)}</span><div><span class="eyebrow">${escapeHtml(discipline?.nome_disciplina || "DISCIPLINA")}</span><h2 id="task-detail-title">${escapeHtml(task.titulo)}</h2></div></div><div class="task-detail__meta"><span class="task-card__state task-card__state--${state.tone}">${state.label}</span><strong>${icon("calendar", 15)} Prazo: ${deadlineLabel(task.prazo, true)}</strong>${lesson ? `<small>${icon("book", 14)} ${escapeHtml(lessonLabel(lesson))}</small>` : ""}</div><section class="task-detail__description"><span>DESCRI\u00c7\u00c3O</span><p>${task.descricao ? escapeHtml(task.descricao).replace(/\n/g, "<br/>") : "Nenhuma descri\u00e7\u00e3o foi adicionada."}</p></section><div class="task-detail__actions"><button class="button button--danger" type="button" data-delete-task-detail>${icon("trash", 16)} Excluir</button><span></span><button class="button button--secondary" type="button" data-edit-task-detail>${icon("edit", 16)} Editar</button></div></section></div>`;
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-task-detail]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-task-detail-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  modalRoot.querySelector("[data-edit-task-detail]").addEventListener("click", () => {
    close();
    openTaskEditor({ task, disciplines, lessons, onCreate, onUpdate, onDelete });
  });
  modalRoot.querySelector("[data-delete-task-detail]").addEventListener("click", async () => {
    if (!await confirmModal({ title: "Excluir esta tarefa?", message: `\u201c${task.titulo}\u201d ser\u00e1 removida da sua organiza\u00e7\u00e3o.`, confirmLabel: "Excluir tarefa", tone: "danger" })) return;
    try {
      await onDelete(task);
      document.removeEventListener("keydown", onKeydown);
    } catch (error) {
      showToast(error.message || "N\u00e3o foi poss\u00edvel excluir a tarefa.", "error");
    }
  });
}

function bindTaskCards(root, tasks, { onOpen, onToggle }) {
  root.querySelectorAll("[data-open-task]").forEach((card) => {
    const open = (event) => {
      if (event?.target?.closest("[data-toggle-task]")) return;
      const task = tasks.find((item) => item.id === card.dataset.openTask);
      if (task) onOpen(task);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(event); }
    });
  });
  root.querySelectorAll("[data-toggle-task]").forEach((button) => button.addEventListener("click", async (event) => {
    event.stopPropagation();
    const task = tasks.find((item) => item.id === button.dataset.toggleTask);
    if (!task) return;
    try { setButtonLoading(button, true, icon("check", 17)); await onToggle(task); }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "N\u00e3o foi poss\u00edvel atualizar a tarefa.", "error"); }
  }));
}

export function tasksView({ profile, disciplines, lessons, tasks, filterDisciplineId }) {
  const filtered = filterDisciplineId ? tasks.filter((task) => task.disciplina === filterDisciplineId) : tasks;
  return `<section class="page tasks-page"><div class="page-heading page-heading--row"><div><span class="eyebrow">PLANEJAMENTO</span><h1>Tarefas</h1><p>Priorize entregas e acompanhe tudo do perfil <strong>${escapeHtml(profile?.curso || "de estudo")}</strong>.</p></div><button class="button button--primary" data-add-task ${disciplines.length ? "" : "disabled title=\"Cadastre uma disciplina primeiro\""}>${icon("plus", 18)} Adicionar tarefa</button></div><div class="tasks-toolbar"><label class="field"><span>Filtrar por disciplina</span><span class="field__control">${icon("book", 17)}<select data-task-filter><option value="">Todas as disciplinas</option>${disciplines.map((discipline) => `<option value="${escapeHtml(discipline.id)}" ${discipline.id === filterDisciplineId ? "selected" : ""}>${escapeHtml(discipline.nome_disciplina)}</option>`).join("")}</select></span></label><p>${filtered.length} ${filtered.length === 1 ? "tarefa encontrada" : "tarefas encontradas"}</p></div>${taskList(filtered, disciplines, lessons, { emptyMessage: filterDisciplineId ? "Nenhuma tarefa nesta disciplina." : "Adicione uma tarefa para organizar seus prazos." })}</section>`;
}

export function lessonTasksView({ lesson, occurrence, tasks }) {
  const discipline = occurrence?.discipline?.nome_disciplina || "Disciplina";
  return `<section class="page lesson-tasks-page"><button class="back-link" data-lesson-tasks-back>${icon("arrowLeft", 18)} Ferramentas</button><header class="lesson-tool-context"><span>${icon("book", 15)}</span><div><small>TAREFAS DA AULA</small><strong>${escapeHtml(discipline)}</strong></div><p>${escapeHtml(lesson.tema || "Tema da aula")}</p></header><section class="lesson-tasks"><div class="lesson-contents__heading"><div><span class="eyebrow">TAREFAS</span><h1>Entregas desta aula</h1><p>Registre o que precisa ser feito a partir desta aula.</p></div><button class="button button--primary" data-add-lesson-task>${icon("plus", 17)} Adicionar tarefa</button></div>${taskList(tasks, [occurrence?.discipline].filter(Boolean), [lesson], { emptyMessage: "Ainda n\u00e3o h\u00e1 tarefas vinculadas a esta aula." })}</section></section>`;
}

export function bindTasks(root, { tasks, disciplines, lessons, onFilter, onCreate, onUpdate, onDelete, onToggle }) {
  root.querySelector("[data-task-filter]")?.addEventListener("change", (event) => onFilter(event.target.value));
  root.querySelector("[data-add-task]")?.addEventListener("click", () => openTaskEditor({ disciplines, lessons, onCreate, onUpdate, onDelete }));
  bindTaskCards(root, tasks, {
    onOpen: (task) => openTaskDetail({ task, disciplines, lessons, onCreate, onUpdate, onDelete }),
    onToggle,
  });
}

export function bindLessonTasks(root, { lesson, occurrence, tasks, onBack, onCreate, onUpdate, onDelete, onToggle }) {
  root.querySelector("[data-lesson-tasks-back]").addEventListener("click", onBack);
  root.querySelector("[data-add-lesson-task]").addEventListener("click", () => openTaskEditor({ disciplines: [occurrence.discipline], lessons: [lesson], prefillDisciplineId: lesson.disciplina, prefillLessonId: lesson.id, lockLesson: true, onCreate, onUpdate, onDelete }));
  bindTaskCards(root, tasks, {
    onOpen: (task) => openTaskDetail({ task, disciplines: [occurrence.discipline], lessons: [lesson], onCreate, onUpdate, onDelete }),
    onToggle,
  });
}

export function taskListMarkup(tasks, disciplines, lessons, options) {
  return taskList(tasks, disciplines, lessons, options);
}
