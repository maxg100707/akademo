import { icon } from "../utils/icons.js";
import { avatar, setButtonLoading, showToast, unsavedModal } from "./components.js";
import { escapeHtml, fileToDataUrl } from "../utils/formatters.js";

export function personalView({ record, photoUrl, onBack, onSave }) {
  const content = `<section class="page settings-page">
    <button class="back-link" data-back>${icon("arrowLeft", 18)} Voltar</button>
    <div class="page-heading"><span class="eyebrow">SUA CONTA</span><h1>Informações pessoais</h1><p>Deixe seu perfil com a sua cara.</p></div>
    <div class="settings-grid"><section class="settings-card settings-card--identity"><div class="settings-card__title"><span class="section-icon">${icon("user", 20)}</span><div><h2>Seu perfil</h2><p>Essas informações aparecem no seu espaço.</p></div></div><form id="personal-form" class="personal-form" novalidate>
      <div class="profile-photo-editor"><div class="profile-photo-editor__image" data-preview>${avatar(record, photoUrl, "profile-photo-editor__avatar")}</div><div><label class="button button--secondary button--small" for="new-photo">${icon("camera", 16)} Alterar foto</label><input id="new-photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp"/><p>PNG, JPG ou WEBP de até 5 MB.</p></div></div>
      <label class="field"><span>Nome</span><span class="field__control">${icon("user", 18)}<input name="name" value="${escapeHtml(record?.nome || "")}" maxlength="80" required /></span></label>
      <label class="field field--readonly"><span>E-mail</span><span class="field__control">${icon("userRound", 18)}<input value="${escapeHtml(record?.email || "")}" readonly /></span><small>O e-mail é gerenciado pela sua conta de acesso.</small></label>
      <div class="form-footer"><button class="button button--primary" type="submit">${icon("save", 17)} Salvar alterações</button></div>
    </form></section>
    </div>
  </section>`;
  const root = document.querySelector("#app");
  // A página é injetada pelo layout; este retorno mantém a construção do conteúdo independente.
  return content;
}

export function bindPersonal(root, { record, photoUrl, onBack, onSave }) {
  const form = root.querySelector("#personal-form");
  let selectedPhoto = null;
  let changed = false;
  form.name.addEventListener("input", () => { changed = form.name.value.trim() !== record.nome; });
  form.photo.addEventListener("change", async () => {
    const file = form.photo.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { form.photo.value = ""; showToast("Escolha uma imagem de até 5 MB.", "error"); return; }
    selectedPhoto = file; changed = true;
    const dataUrl = await fileToDataUrl(file);
    form.querySelector("[data-preview]").innerHTML = `<span class="avatar profile-photo-editor__avatar"><img src="${dataUrl}" alt="Nova foto de perfil"/></span>`;
  });
  async function save() {
    if (!form.reportValidity()) return false;
    const button = form.querySelector("[type=submit]");
    try { setButtonLoading(button, true); await onSave({ name: form.name.value, photoFile: selectedPhoto }); changed = false; return true; }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível salvar as informações.", "error"); return false; }
  }
  form.addEventListener("submit", async (event) => { event.preventDefault(); await save(); });
  root.querySelector("[data-back]").addEventListener("click", async () => {
    if (!changed) return onBack();
    const choice = await unsavedModal();
    if (choice === "save") { if (await save()) onBack(); }
    else onBack();
  });
}
