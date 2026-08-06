import { icon } from "../utils/icons.js";
import { closeModal, confirmModal, setButtonLoading, showToast } from "./components.js";
import { escapeHtml } from "../utils/formatters.js";

const emptyForm = () => ({ institution: "", course: "", semester: "", startDate: "", endDate: "" });

function dateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function editorForm(values, editing) {
  return `<form class="study-editor" id="study-editor" novalidate>
    <div class="study-editor__head"><div><span class="eyebrow">${editing ? "EDITAR PERFIL" : "NOVO PERFIL"}</span><h2 id="study-editor-title">${editing ? "Ajuste este perfil" : "Onde você está estudando?"}</h2></div><button type="button" class="icon-button" data-cancel-editor aria-label="Cancelar">${icon("close", 19)}</button></div>
    <div class="form-grid form-grid--compact"><label class="field"><span>Instituição</span><span class="field__control">${icon("book", 17)}<input name="institution" maxlength="120" value="${escapeHtml(values.institution)}" placeholder="Sua instituição" required /></span></label><label class="field"><span>Curso</span><span class="field__control">${icon("graduation", 17)}<input name="course" maxlength="120" value="${escapeHtml(values.course)}" placeholder="Seu curso" required /></span></label><label class="field"><span>Semestre</span><span class="field__control">${icon("calendar", 17)}<select name="semester" required><option value="" disabled ${!values.semester ? "selected" : ""}>Selecione</option>${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}" ${Number(values.semester) === i + 1 ? "selected" : ""}>${i + 1}º semestre</option>`).join("")}</select></span></label><div class="profile-date-fields"><label class="field"><span>Data de início</span><span class="field__control">${icon("calendar", 17)}<input name="startDate" type="date" value="${escapeHtml(values.startDate)}" required /></span></label><label class="field"><span>Data de fim</span><span class="field__control">${icon("calendar", 17)}<input name="endDate" type="date" value="${escapeHtml(values.endDate)}" required /></span></label></div></div>
    <div class="study-editor__actions"><button class="button button--ghost" type="button" data-cancel-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} ${editing ? "Salvar perfil" : "Criar perfil"}</button></div></form>`;
}

function editorModal(values, editing) {
  return `<div class="modal-backdrop modal-backdrop--editor" data-editor-backdrop>
    <section class="modal modal--editor" role="dialog" aria-modal="true" aria-labelledby="study-editor-title">
      ${editorForm(values, editing)}
    </section>
  </div>`;
}

export function profilesView({ profiles, currentProfile }) {
  return `<section class="page profiles-page">
    <button class="back-link" data-back>${icon("arrowLeft", 18)} Voltar</button>
    <div class="page-heading page-heading--row"><div><span class="eyebrow">JORNADA ACADÊMICA</span><h1>Perfis de estudo</h1><p>Separe cada curso ou momento da sua vida acadêmica.</p></div><button class="button button--primary" data-add-profile>${icon("plus", 18)} Novo perfil</button></div>
    <div class="profiles-layout"><div class="profiles-list">${profiles.map((profile) => `<article class="study-profile-card ${profile.id === currentProfile?.id ? "is-current" : ""}"><div class="study-profile-card__badge">${icon("graduation", 23)}</div><div class="study-profile-card__main"><div class="study-profile-card__title"><h2>${escapeHtml(profile.curso)}</h2>${profile.id === currentProfile?.id ? '<span>ATIVO</span>' : ""}</div><p>${escapeHtml(profile.instituicao)}</p><small>${icon("calendar", 14)} ${profile.semestre}º semestre</small></div><div class="study-profile-card__actions"><button class="icon-button" data-edit-profile="${profile.id}" aria-label="Editar ${escapeHtml(profile.curso)}">${icon("edit", 18)}</button><button class="icon-button icon-button--danger" data-delete-profile="${profile.id}" aria-label="Excluir ${escapeHtml(profile.curso)}">${icon("trash", 18)}</button></div></article>`).join("")}</div><aside class="profiles-aside"><div class="profiles-aside__illustration">${icon("book", 38)}<span>✦</span></div><h3>Um espaço para cada fase.</h3><p>Você pode criar perfis diferentes e alternar entre eles quando precisar.</p></aside></div>
  </section>`;
}

export function bindProfiles(root, { profiles, onBack, onCreate, onCreated, onUpdate, onDelete }) {
  const showEditor = (profile = null) => {
    const values = profile ? { institution: profile.instituicao, course: profile.curso, semester: profile.semestre, startDate: dateInputValue(profile.data_inicio), endDate: dateInputValue(profile.data_fim) } : emptyForm();
    const modalRoot = document.querySelector("#modal-root");
    modalRoot.innerHTML = editorModal(values, Boolean(profile));
    const close = () => {
      document.removeEventListener("keydown", onKeydown);
      closeModal();
    };
    const onKeydown = (event) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKeydown);
    modalRoot.querySelectorAll("[data-cancel-editor]").forEach((button) => button.addEventListener("click", close));
    modalRoot.querySelector("[data-editor-backdrop]").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });
    modalRoot.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
      const button = form.querySelector("[type=submit]");
      try {
        setButtonLoading(button, true);
        const savedProfile = await (profile ? onUpdate(profile.id, Object.fromEntries(new FormData(form))) : onCreate(Object.fromEntries(new FormData(form))));
        close();
        if (!profile) onCreated?.(savedProfile);
      }
      catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível salvar o perfil.", "error"); }
    });
    modalRoot.querySelector("input")?.focus();
  };
  root.querySelector("[data-back]").addEventListener("click", onBack);
  root.querySelector("[data-add-profile]").addEventListener("click", () => showEditor());
  root.querySelectorAll("[data-edit-profile]").forEach((button) => button.addEventListener("click", async () => {
    const profile = profiles.find((item) => item.id === button.dataset.editProfile);
    if (await confirmModal({ title: "Editar este perfil?", message: `Você vai alterar as informações de ${profile.curso}.`, confirmLabel: "Editar perfil" })) showEditor(profile);
  }));
  root.querySelectorAll("[data-delete-profile]").forEach((button) => button.addEventListener("click", async () => {
    const profile = profiles.find((item) => item.id === button.dataset.deleteProfile);
    if (await confirmModal({ title: "Excluir perfil de estudo?", message: `O perfil “${profile.curso}” e suas configurações serão removidos.`, confirmLabel: "Excluir perfil", tone: "danger" })) await onDelete(profile);
  }));
}
