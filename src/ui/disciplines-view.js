import { icon } from "../utils/icons.js";
import { escapeHtml } from "../utils/formatters.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const emptyDiscipline = () => ({ name: "", summary: "", teacherId: "" });
const disciplineValues = (discipline) => discipline
  ? { name: discipline.nome_disciplina || "", summary: discipline.resumo_disciplina || "", teacherId: discipline.professor_id || "" }
  : emptyDiscipline();

function disciplineFields(values, teachers) {
  return `<div class="discipline-fields">
    <label class="field"><span>Nome da disciplina</span><span class="field__control">${icon("book", 17)}<input name="name" maxlength="120" value="${escapeHtml(values.name)}" placeholder="Ex.: Cálculo I" required autofocus /></span></label>
    <label class="field"><span>Resumo <em>opcional</em></span><textarea class="field__textarea" name="summary" maxlength="500" placeholder="Um breve lembrete sobre a disciplina">${escapeHtml(values.summary)}</textarea></label>
    <label class="field"><span>Professor</span><span class="field__control">${icon("users", 17)}<select name="teacherId" required><option value="" disabled ${!values.teacherId ? "selected" : ""}>Selecione o professor</option>${teachers.map((teacher) => `<option value="${escapeHtml(teacher.id)}" ${teacher.id === values.teacherId ? "selected" : ""}>${escapeHtml(teacher.nome_professor)}</option>`).join("")}</select></span></label>
  </div>`;
}

function teacherName(teachers, id) {
  return teachers.find((teacher) => teacher.id === id)?.nome_professor || "Professor não encontrado";
}

function disciplinesList(disciplines, teachers) {
  if (!disciplines.length) return `<div class="disciplines-empty"><span>${icon("book", 26)}</span><h3>Nenhuma disciplina cadastrada</h3><p>Crie a primeira disciplina deste perfil para manter tudo organizado.</p></div>`;
  return `<div class="disciplines-list">${disciplines.map((discipline) => `<article class="discipline-card" data-edit-discipline="${escapeHtml(discipline.id)}" role="button" tabindex="0" aria-label="Editar ${escapeHtml(discipline.nome_disciplina)}">
    <span class="discipline-card__badge">${icon("book", 20)}</span><div class="discipline-card__main"><h2>${escapeHtml(discipline.nome_disciplina)}</h2>${discipline.resumo_disciplina ? `<p>${escapeHtml(discipline.resumo_disciplina)}</p>` : ""}<small>${icon("userRound", 14)} ${escapeHtml(teacherName(teachers, discipline.professor_id))}</small></div>
    <button class="icon-button discipline-card__edit" type="button" data-discipline-edit-button="${escapeHtml(discipline.id)}" aria-label="Editar ${escapeHtml(discipline.nome_disciplina)}">${icon("edit", 17)}</button>
  </article>`).join("")}</div>`;
}

function disciplineEditorModal(discipline, teachers) {
  const editing = Boolean(discipline);
  return `<div class="modal-backdrop" data-discipline-editor-backdrop><section class="modal modal--discipline-editor" role="dialog" aria-modal="true" aria-labelledby="discipline-editor-title"><form class="discipline-editor" data-discipline-editor novalidate>
    <div class="discipline-editor__head"><div><span class="eyebrow">${editing ? "EDITAR DISCIPLINA" : "NOVA DISCIPLINA"}</span><h2 id="discipline-editor-title">${editing ? "Atualize a disciplina" : "Adicionar disciplina"}</h2><p>Vincule a disciplina a um professor deste perfil.</p></div><button class="icon-button" type="button" data-close-discipline-editor aria-label="Fechar">${icon("close", 19)}</button></div>
    ${disciplineFields(disciplineValues(discipline), teachers)}
    <div class="discipline-editor__actions">${editing ? `<button class="button button--danger" type="button" data-delete-discipline-editor>${icon("trash", 16)} Excluir</button>` : ""}<span></span><button class="button button--ghost" type="button" data-close-discipline-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} ${editing ? "Salvar disciplina" : "Adicionar disciplina"}</button></div>
  </form></section></div>`;
}

function openDisciplineEditor(discipline, teachers, onSave, onDelete) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = disciplineEditorModal(discipline, teachers);
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-discipline-editor]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-discipline-editor-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  modalRoot.querySelector("[data-delete-discipline-editor]")?.addEventListener("click", async (event) => {
    if (!discipline || !onDelete || !window.confirm(`Excluir ${discipline.nome_disciplina}? Esta ação não pode ser desfeita.`)) return;
    const button = event.currentTarget;
    try { setButtonLoading(button, true); await onDelete(discipline); close(); }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível excluir a disciplina.", "error"); }
  });
  modalRoot.querySelector("[data-discipline-editor]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    try { setButtonLoading(button, true); await onSave(Object.fromEntries(new FormData(form))); close(); }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível salvar a disciplina.", "error"); }
  });
  modalRoot.querySelector("input")?.focus();
}

function bindDisciplineCards(container, onEdit) {
  container.querySelectorAll("[data-discipline-edit-button]").forEach((button) => button.addEventListener("click", (event) => {
    event.stopPropagation();
    onEdit(button.dataset.disciplineEditButton);
  }));
  container.querySelectorAll("[data-edit-discipline]").forEach((card) => {
    const open = () => onEdit(card.dataset.editDiscipline);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

export function disciplinesView({ profile, teachers, disciplines }) {
  const course = escapeHtml(profile?.curso || "Perfil de estudo");
  const hasTeachers = teachers.length > 0;
  return `<section class="page disciplines-page"><button class="back-link" data-back>${icon("arrowLeft", 18)} Voltar</button>
    <div class="page-heading page-heading--row"><div><span class="eyebrow">GRADE ACADÊMICA</span><h1>Disciplinas</h1><p>Organize as disciplinas do perfil <strong>${course}</strong>.</p></div><button class="button button--primary" data-add-discipline ${hasTeachers ? "" : "disabled title=\"Cadastre um professor antes\""}>${icon("plus", 18)} Adicionar disciplina</button></div>
    <div class="disciplines-layout"><section class="disciplines-panel">${hasTeachers ? disciplinesList(disciplines, teachers) : `<div class="disciplines-empty"><span>${icon("users", 26)}</span><h3>Cadastre um professor primeiro</h3><p>As disciplinas precisam ser vinculadas a um professor deste perfil.</p></div>`}</section><aside class="disciplines-aside"><span class="disciplines-aside__icon">${icon("graduation", 23)}</span><h3>Uma grade mais clara.</h3><p>Associe cada disciplina ao professor responsável e mantenha seus estudos organizados.</p></aside></div>
  </section>`;
}

export function bindDisciplines(root, { teachers, disciplines, onBack, onCreate, onUpdate, onDelete }) {
  root.querySelector("[data-back]").addEventListener("click", onBack);
  root.querySelector("[data-add-discipline]")?.addEventListener("click", () => {
    if (teachers.length) openDisciplineEditor(null, teachers, onCreate);
  });
  bindDisciplineCards(root, (id) => {
    const discipline = disciplines.find((item) => item.id === id);
    if (discipline) openDisciplineEditor(discipline, teachers, (values) => onUpdate(discipline.id, values), onDelete);
  });
}

export function openDisciplineSetup({ profile, teachers, onCreate, onUpdate, onDelete, onFinish }) {
  const modalRoot = document.querySelector("#modal-root");
  let disciplines = [];
  let editing = null;
  let pendingDelete = null;
  const finish = () => { document.removeEventListener("keydown", onKeydown); closeModal(); onFinish(disciplines.length); };
  const onKeydown = (event) => { if (event.key === "Escape") finish(); };

  const render = () => {
    const values = disciplineValues(editing);
    const hasTeachers = teachers.length > 0;
    modalRoot.innerHTML = `<div class="modal-backdrop modal-backdrop--discipline-setup" data-discipline-setup-backdrop><section class="modal modal--discipline-setup" role="dialog" aria-modal="true" aria-labelledby="discipline-setup-title">
      <div class="discipline-setup__head"><div><span class="eyebrow">ÚLTIMO PASSO</span><h2 id="discipline-setup-title">Registre suas disciplinas</h2><p>Associe cada disciplina a um professor do perfil <strong>${escapeHtml(profile.curso)}</strong>.</p></div><button class="icon-button" type="button" data-finish-discipline-setup aria-label="Registrar mais tarde">${icon("close", 19)}</button></div>
      ${hasTeachers ? `<form class="discipline-setup__form" data-discipline-setup-form novalidate><div class="discipline-setup__form-title"><span>${icon(editing ? "edit" : "plus", 16)}</span><strong>${editing ? `Editando ${escapeHtml(editing.nome_disciplina)}` : "Adicionar disciplina"}</strong>${editing ? '<button type="button" class="text-button" data-cancel-discipline-edit>Cancelar edição</button>' : ""}</div>${disciplineFields(values, teachers)}<div class="discipline-setup__form-actions">${editing ? `<button class="button button--danger button--small" type="button" data-request-discipline-delete>${icon("trash", 15)} Excluir</button>` : ""}<span></span><button class="button button--secondary" type="submit">${icon(editing ? "save" : "plus", 16)} ${editing ? "Salvar alterações" : "Adicionar à lista"}</button></div></form><div class="discipline-setup__list"><div><h3>Disciplinas adicionadas</h3><span>${disciplines.length}</span></div>${disciplinesList(disciplines, teachers)}</div>` : `<div class="discipline-setup__empty"><span>${icon("users", 27)}</span><h3>Você ainda não cadastrou professores</h3><p>Registre professores primeiro para poder vinculá-los às suas disciplinas.</p></div>`}
      <div class="discipline-setup__actions"><button class="text-button" type="button" data-finish-discipline-setup>${disciplines.length ? "Concluir cadastro" : "Pular por agora"}</button><button class="button button--primary" type="button" data-finish-discipline-setup>${disciplines.length ? "Concluir" : "Registrar mais tarde"} ${icon("arrowRight", 16)}</button></div>
      ${pendingDelete ? `<div class="discipline-setup__confirm"><div><span>${icon("trash", 19)}</span><h3>Excluir ${escapeHtml(pendingDelete.nome_disciplina)}?</h3><p>Essa ação removerá a disciplina deste perfil.</p><div><button class="button button--ghost button--small" type="button" data-cancel-discipline-delete>Cancelar</button><button class="button button--danger button--small" type="button" data-confirm-discipline-delete>Excluir</button></div></div></div>` : ""}
    </section></div>`;
    modalRoot.querySelectorAll("[data-finish-discipline-setup]").forEach((button) => button.addEventListener("click", finish));
    modalRoot.querySelector("[data-discipline-setup-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) finish(); });
    modalRoot.querySelector("[data-cancel-discipline-edit]")?.addEventListener("click", () => { editing = null; render(); });
    bindDisciplineCards(modalRoot, (id) => { editing = disciplines.find((item) => item.id === id) || null; pendingDelete = null; render(); });
    modalRoot.querySelector("[data-request-discipline-delete]")?.addEventListener("click", () => { pendingDelete = editing; render(); });
    modalRoot.querySelector("[data-cancel-discipline-delete]")?.addEventListener("click", () => { pendingDelete = null; render(); });
    modalRoot.querySelector("[data-confirm-discipline-delete]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      try {
        setButtonLoading(button, true);
        const deletedId = pendingDelete.id;
        await onDelete(deletedId);
        disciplines = disciplines.filter((item) => item.id !== deletedId);
        pendingDelete = null;
        if (editing?.id === deletedId) editing = null;
        render(); showToast("Disciplina removida.");
      } catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível excluir a disciplina.", "error"); }
    });
    modalRoot.querySelector("[data-discipline-setup-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const button = form.querySelector("[type=submit]");
      try {
        setButtonLoading(button, true);
        const saved = editing ? await onUpdate(editing.id, Object.fromEntries(new FormData(form))) : await onCreate(Object.fromEntries(new FormData(form)));
        disciplines = editing ? disciplines.map((item) => item.id === saved.id ? saved : item) : [...disciplines, saved];
        editing = null;
        render(); showToast("Disciplina salva com sucesso.");
      } catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível salvar a disciplina.", "error"); }
    });
    modalRoot.querySelector("input")?.focus();
  };
  document.addEventListener("keydown", onKeydown);
  render();
}
