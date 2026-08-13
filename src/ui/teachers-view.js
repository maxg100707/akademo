import { icon } from "../utils/icons.js";
import { escapeHtml } from "../utils/formatters.js";
import { completePhone, COUNTRY_CODES, digitsOnly, formatPhoneNumber, splitPhone } from "../utils/phone.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const emptyTeacher = () => ({ name: "", email: "", countryCode: "55", phone: "" });
function teacherValues(teacher) {
  if (!teacher) return emptyTeacher();
  const phone = splitPhone(teacher.telefone_professor);
  return { name: teacher.nome_professor || "", email: teacher.email_professor || "", countryCode: phone.countryCode, phone: phone.number };
}

function teacherFields(values) {
  return `<div class="teacher-fields">
    <label class="field"><span>Nome do professor</span><span class="field__control">${icon("user", 17)}<input name="name" maxlength="120" value="${escapeHtml(values.name)}" placeholder="Ex.: Ana Martins" required autofocus /></span></label>
    <label class="field"><span>E-mail <em>opcional</em></span><span class="field__control">${icon("mail", 17)}<input name="email" type="email" maxlength="254" value="${escapeHtml(values.email)}" placeholder="ana@instituicao.edu" /></span></label>
    <div class="teacher-phone-fields"><label class="field"><span>Código do país</span><span class="field__control">${icon("phone", 17)}<select name="countryCode" aria-label="Código do país">${COUNTRY_CODES.map((country) => `<option value="${country.code}" ${country.code === values.countryCode ? "selected" : ""}>${escapeHtml(country.label)}</option>`).join("")}</select></span></label>
    <label class="field"><span>Telefone <em>opcional</em></span><span class="field__control">${icon("phone", 17)}<input name="phone" type="tel" inputmode="tel" maxlength="18" value="${escapeHtml(formatPhoneNumber(values.phone, values.countryCode))}" placeholder="Número sem o código" /></span></label></div>
  </div>`;
}

function teacherFormValues(form) {
  const values = Object.fromEntries(new FormData(form));
  values.phone = completePhone(values.countryCode, values.phone);
  delete values.countryCode;
  return values;
}

function bindPhoneFormatter(container) {
  const code = container.querySelector("[name=countryCode]");
  const phone = container.querySelector("[name=phone]");
  if (!code || !phone) return;
  const format = () => { phone.value = formatPhoneNumber(phone.value, code.value); };
  phone.addEventListener("input", format);
  code.addEventListener("change", format);
}

function contactAction({ href, label, iconName, available, external = false }) {
  if (!available) return `<span class="teacher-card__contact-button is-disabled" title="${label} não informado" aria-label="${label} não informado">${icon(iconName, 19)}</span>`;
  return `<a class="teacher-card__contact-button" data-teacher-contact href="${href}" aria-label="Enviar ${label}" title="Enviar ${label}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>${icon(iconName, 19)}</a>`;
}

function teacherDisciplines(teacherId, disciplines) {
  const names = disciplines.filter((discipline) => discipline.professor_id === teacherId).map((discipline) => escapeHtml(discipline.nome_disciplina));
  return names.length ? `<small class="teacher-card__disciplines">${icon("book", 13)} ${names.join(" · ")}</small>` : "";
}

function teachersList(teachers, disciplines = []) {
  if (!teachers.length) return `<div class="teachers-empty"><span>${icon("users", 26)}</span><h3>Nenhum professor cadastrado</h3><p>Adicione os professores deste perfil para encontrá-los rapidamente.</p></div>`;
  return `<div class="teachers-list">${teachers.map((teacher) => {
    const phone = digitsOnly(teacher.telefone_professor);
    return `<article class="teacher-card" data-edit-teacher="${escapeHtml(teacher.id)}" role="button" tabindex="0" aria-label="Editar ${escapeHtml(teacher.nome_professor)}">
      <span class="teacher-card__badge">${icon("userRound", 20)}</span>
      <div class="teacher-card__main"><h2>${escapeHtml(teacher.nome_professor)}</h2>${teacherDisciplines(teacher.id, disciplines)}</div>
      <div class="teacher-card__contact-actions teacher-card__contact-actions--side">${contactAction({ href: `mailto:${encodeURIComponent(teacher.email_professor || "")}`, label: "e-mail", iconName: "mail", available: Boolean(teacher.email_professor) })}${contactAction({ href: `https://wa.me/${phone}`, label: "WhatsApp", iconName: "messageSquare", available: Boolean(phone), external: true })}</div>
    </article>`;
  }).join("")}</div>`;
}

function teacherEditorModal(teacher) {
  const editing = Boolean(teacher);
  return `<div class="modal-backdrop" data-teacher-editor-backdrop><section class="modal modal--teacher-editor" role="dialog" aria-modal="true" aria-labelledby="teacher-editor-title">
    <form class="teacher-editor" data-teacher-editor novalidate>
      <div class="teacher-editor__head"><div><span class="eyebrow">${editing ? "EDITAR PROFESSOR" : "NOVO PROFESSOR"}</span><h2 id="teacher-editor-title">${editing ? "Atualize os dados" : "Adicionar professor"}</h2><p>O telefone é salvo com o código do país, somente em números.</p></div><button class="icon-button" type="button" data-close-teacher-editor aria-label="Fechar">${icon("close", 19)}</button></div>
      ${teacherFields(teacherValues(teacher))}
      <div class="teacher-editor__actions">${editing ? `<button class="button button--danger" type="button" data-delete-teacher-editor>${icon("trash", 16)} Excluir</button>` : ""}<span class="teacher-editor__actions-spacer"></span><button class="button button--ghost" type="button" data-close-teacher-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} ${editing ? "Salvar professor" : "Adicionar professor"}</button></div>
    </form>
  </section></div>`;
}

export function openTeacherEditor(teacher, onSave, onDelete, { onSaved } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = teacherEditorModal(teacher);
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-teacher-editor]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-teacher-editor-backdrop]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  modalRoot.querySelector("[data-delete-teacher-editor]")?.addEventListener("click", async (event) => {
    if (!teacher || !onDelete || !window.confirm(`Excluir ${teacher.nome_professor}? Esta ação não pode ser desfeita.`)) return;
    const button = event.currentTarget;
    try {
      setButtonLoading(button, true);
      await onDelete(teacher);
      close();
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível excluir o professor.", "error");
    }
  });
  modalRoot.querySelector("[data-teacher-editor]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      const savedTeacher = await onSave(teacherFormValues(form));
      close();
      onSaved?.(savedTeacher);
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar o professor.", "error");
    }
  });
  bindPhoneFormatter(modalRoot);
  modalRoot.querySelector("input")?.focus();
}

function bindTeacherCards(container, onEdit) {
  container.querySelectorAll("[data-teacher-contact]").forEach((action) => action.addEventListener("click", (event) => event.stopPropagation()));
  container.querySelectorAll("[data-edit-teacher]").forEach((card) => {
    const open = () => onEdit(card.dataset.editTeacher);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

export function teachersView({ profile, teachers, disciplines = [] }) {
  const course = escapeHtml(profile?.curso || "Perfil de estudo");
  return `<section class="page teachers-page">
    <button class="back-link" data-back>${icon("arrowLeft", 18)} Voltar</button>
    <div class="page-heading page-heading--row"><div><span class="eyebrow">CORPO DOCENTE</span><h1>Professores</h1><p>Organize os contatos do perfil <strong>${course}</strong>.</p></div><button class="button button--primary" data-add-teacher>${icon("plus", 18)} Adicionar professor</button></div>
    <div class="teachers-layout"><section class="teachers-panel">${teachersList(teachers, disciplines)}</section></div>
  </section>`;
}

export function bindTeachers(root, { teachers, onBack, onCreate, onUpdate, onDelete }) {
  root.querySelector("[data-back]").addEventListener("click", onBack);
  root.querySelector("[data-add-teacher]").addEventListener("click", () => openTeacherEditor(null, onCreate));
  bindTeacherCards(root, (id) => {
    const teacher = teachers.find((item) => item.id === id);
    if (teacher) openTeacherEditor(teacher, (values) => onUpdate(teacher.id, values), onDelete);
  });
}

export function openTeacherSetup({ profile, onCreate, onUpdate, onDelete, onFinish }) {
  const modalRoot = document.querySelector("#modal-root");
  let teachers = [];
  let editing = null;
  let pendingDelete = null;

  const finish = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
    onFinish(teachers.length);
  };
  const onKeydown = (event) => { if (event.key === "Escape") finish(); };

  const render = () => {
    const values = teacherValues(editing);
    modalRoot.innerHTML = `<div class="modal-backdrop modal-backdrop--teacher-setup" data-teacher-setup-backdrop><section class="modal modal--teacher-setup" role="dialog" aria-modal="true" aria-labelledby="teacher-setup-title">
      <div class="teacher-setup__head"><div><span class="eyebrow">PRÓXIMO PASSO</span><h2 id="teacher-setup-title">Cadastre seus professores</h2><p>Adicione os contatos do perfil <strong>${escapeHtml(profile.curso)}</strong>, ou faça isso depois.</p></div><button class="icon-button" type="button" data-finish-teacher-setup aria-label="Registrar mais tarde">${icon("close", 19)}</button></div>
      <div class="teacher-setup__profile">${icon("graduation", 18)}<span>${escapeHtml(profile.instituicao)} · ${escapeHtml(profile.curso)}</span></div>
      <form class="teacher-setup__form" data-teacher-setup-form novalidate><div class="teacher-setup__form-title"><span>${icon(editing ? "edit" : "plus", 16)}</span><strong>${editing ? `Editando ${escapeHtml(editing.nome_professor)}` : "Adicionar professor"}</strong>${editing ? '<button type="button" class="text-button" data-cancel-teacher-edit>Cancelar edição</button>' : ""}</div>${teacherFields(values)}<div class="teacher-setup__form-actions">${editing ? `<button class="button button--danger button--small" type="button" data-request-teacher-delete>${icon("trash", 15)} Excluir</button>` : ""}<span></span><button class="button button--secondary" type="submit">${icon(editing ? "save" : "plus", 16)} ${editing ? "Salvar alterações" : "Adicionar à lista"}</button></div></form>
      <div class="teacher-setup__list"><div><h3>Professores adicionados</h3><span>${teachers.length}</span></div>${teachersList(teachers)}</div>
      <div class="teacher-setup__actions"><button class="text-button" type="button" data-finish-teacher-setup>${teachers.length ? "Concluir cadastro" : "Pular por agora"}</button><button class="button button--primary" type="button" data-finish-teacher-setup>${teachers.length ? "Concluir" : "Registrar mais tarde"} ${icon("arrowRight", 16)}</button></div>
      ${pendingDelete ? `<div class="teacher-setup__confirm"><div><span class="teacher-setup__confirm-icon">${icon("trash", 19)}</span><h3>Excluir ${escapeHtml(pendingDelete.nome_professor)}?</h3><p>Essa ação removerá o professor deste perfil.</p><div><button class="button button--ghost button--small" type="button" data-cancel-teacher-delete>Cancelar</button><button class="button button--danger button--small" type="button" data-confirm-teacher-delete>Excluir</button></div></div></div>` : ""}
    </section></div>`;

    modalRoot.querySelectorAll("[data-finish-teacher-setup]").forEach((button) => button.addEventListener("click", finish));
    modalRoot.querySelector("[data-teacher-setup-backdrop]").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) finish();
    });
    modalRoot.querySelector("[data-cancel-teacher-edit]")?.addEventListener("click", () => { editing = null; render(); });
    bindTeacherCards(modalRoot, (id) => {
      editing = teachers.find((item) => item.id === id) || null;
      pendingDelete = null;
      render();
    });
    modalRoot.querySelector("[data-request-teacher-delete]")?.addEventListener("click", () => { pendingDelete = editing; render(); });
    modalRoot.querySelector("[data-cancel-teacher-delete]")?.addEventListener("click", () => { pendingDelete = null; render(); });
    modalRoot.querySelector("[data-confirm-teacher-delete]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      try {
        setButtonLoading(button, true);
        const deletedId = pendingDelete.id;
        await onDelete(deletedId);
        teachers = teachers.filter((item) => item.id !== deletedId);
        pendingDelete = null;
        if (editing?.id === deletedId) editing = null;
        render();
        showToast("Professor removido.");
      } catch (error) {
        setButtonLoading(button, false);
        showToast(error.message || "Não foi possível excluir o professor.", "error");
      }
    });
    modalRoot.querySelector("[data-teacher-setup-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const button = form.querySelector("[type=submit]");
      try {
        setButtonLoading(button, true);
        const saved = editing ? await onUpdate(editing.id, teacherFormValues(form)) : await onCreate(teacherFormValues(form));
        teachers = editing ? teachers.map((item) => item.id === saved.id ? saved : item) : [...teachers, saved];
        editing = null;
        render();
        showToast("Professor salvo com sucesso.");
      } catch (error) {
        setButtonLoading(button, false);
        showToast(error.message || "Não foi possível salvar o professor.", "error");
      }
    });
    bindPhoneFormatter(modalRoot);
    modalRoot.querySelector("input")?.focus();
  };

  document.addEventListener("keydown", onKeydown);
  render();
}
