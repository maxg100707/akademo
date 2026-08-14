import { CONTACT_TYPES } from "../services/contacts.js";
import { escapeHtml } from "../utils/formatters.js";
import {
  completePhone,
  COUNTRY_CODES,
  digitsOnly,
  formatPhoneNumber,
  splitPhone,
} from "../utils/phone.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";
import { icon } from "../utils/icons.js";

const typeLabel = (type) => CONTACT_TYPES.find((item) => item.value === Number(type))?.label || "Outro";
const normalized = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

function recordKey(record) {
  return `${record.source}:${record.id}`;
}

function disciplineNames(record, disciplines) {
  if (record.source !== "teacher") return [];
  return disciplines
    .filter((discipline) => discipline.professor_id === record.id)
    .map((discipline) => discipline.nome_disciplina)
    .filter(Boolean);
}

export function contactRecords(contacts = [], teachers = [], disciplines = []) {
  const general = contacts.map((contact) => ({
    source: "contact",
    id: contact.id,
    name: contact.nome || "",
    type: Number(contact.tipo),
    email: contact.email || "",
    phone: contact.telefone || "",
    observations: contact.obs || "",
    raw: contact,
  }));
  const faculty = teachers.map((teacher) => ({
    source: "teacher",
    id: teacher.id,
    name: teacher.nome_professor || "",
    type: "teacher",
    email: teacher.email_professor || "",
    phone: teacher.telefone_professor || "",
    observations: teacher.obs || "",
    disciplines: disciplineNames({ source: "teacher", id: teacher.id }, disciplines),
    raw: teacher,
  }));
  return [...faculty, ...general].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function labelFor(record) {
  return record.source === "teacher" ? "Professor" : typeLabel(record.type);
}

function contactSearchText(record) {
  return normalized([
    record.name,
    labelFor(record),
    record.email,
    record.phone,
    record.observations,
    ...(record.disciplines || []),
  ].join(" "));
}

function contactAction({ href, label, iconName, external = false }) {
  if (!href) return "";
  return `<a class="contact-card__action" data-contact-action href="${escapeHtml(href)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>${icon(iconName, 20)}</a>`;
}

function contactsList(records, disciplines = []) {
  if (!records.length) {
    return `<div class="contacts-empty" data-contacts-empty><span>${icon("users", 28)}</span><h2>Nenhum contato cadastrado</h2><p>Adicione professores e pessoas importantes para a sua jornada acadêmica.</p></div>`;
  }
  return `<div class="contacts-list" data-contacts-list>${records.map((record) => {
    const phone = digitsOnly(record.phone);
    const linkedDisciplines = record.disciplines || disciplineNames(record, disciplines);
    return `<article class="contact-card" data-contact-card="${escapeHtml(recordKey(record))}" data-contact-search="${escapeHtml(contactSearchText({ ...record, disciplines: linkedDisciplines }))}" role="button" tabindex="0" aria-label="Abrir contato ${escapeHtml(record.name)}">
      <span class="contact-card__badge">${icon(record.source === "teacher" ? "graduation" : "userRound", 20)}</span>
      <div class="contact-card__main"><div><h2>${escapeHtml(record.name)}</h2><span class="contact-card__type">${escapeHtml(labelFor(record))}</span></div>${linkedDisciplines.length ? `<small>${icon("book", 13)} ${escapeHtml(linkedDisciplines.join(" · "))}</small>` : ""}</div>
      <div class="contact-card__actions">${contactAction({ href: record.email ? `mailto:${encodeURIComponent(record.email)}` : "", label: "Enviar e-mail", iconName: "mail" })}${contactAction({ href: phone ? `https://wa.me/${phone}` : "", label: "Abrir conversa no WhatsApp", iconName: "messageSquare", external: true })}</div>
    </article>`;
  }).join("")}</div>`;
}

export function contactsView({ records, disciplines = [] }) {
  return `<section class="page contacts-page">
    <button class="back-link" data-back>${icon("arrowLeft", 18)} Voltar</button>
    <div class="contacts-toolbar"><label class="field contacts-toolbar__search"><span class="visually-hidden">Buscar contatos</span><span class="field__control">${icon("search", 19)}<input data-contacts-search type="search" placeholder="Buscar por nome, tipo, matéria, e-mail ou observação" autocomplete="off" /></span></label><button class="button button--primary" data-add-contact>${icon("plus", 18)} Adicionar contato</button></div>
    <p class="contacts-toolbar__count" data-contacts-count>${records.length} ${records.length === 1 ? "contato cadastrado" : "contatos cadastrados"}</p>
    <section class="contacts-catalog" data-contacts-catalog>${contactsList(records, disciplines)}${records.length ? `<div class="contacts-no-results" data-contacts-no-results hidden>${icon("search", 20)}<span>Nenhum contato corresponde à sua busca.</span></div>` : ""}</section>
  </section>`;
}

function emptyValues() {
  return { name: "", type: "", email: "", countryCode: "55", phone: "", observations: "", disciplineId: "" };
}

function valuesFor(record, disciplines) {
  if (!record) return emptyValues();
  const phone = splitPhone(record.phone);
  const linked = disciplines.find((discipline) => discipline.professor_id === record.id);
  return {
    name: record.name || "",
    type: record.source === "teacher" ? "teacher" : String(record.type),
    email: record.email || "",
    countryCode: phone.countryCode,
    phone: phone.number,
    observations: record.observations || "",
    disciplineId: linked?.id || "",
  };
}

function typeOptions(selected) {
  return `<option value="" disabled ${selected === "" ? "selected" : ""}>Selecione o tipo</option><option value="teacher" ${selected === "teacher" ? "selected" : ""}>Professor</option>${CONTACT_TYPES.map((item) => `<option value="${item.value}" ${String(item.value) === String(selected) ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}`;
}

function disciplineOptions(disciplines, selected) {
  return `<option value="">Nenhuma matéria selecionada</option>${disciplines.map((discipline) => `<option value="${discipline.id}" ${discipline.id === selected ? "selected" : ""}>${escapeHtml(discipline.nome_disciplina)}</option>`).join("")}`;
}

function editorMarkup(record, disciplines) {
  const editing = Boolean(record);
  const values = valuesFor(record, disciplines);
  const teacherLocked = record?.source === "teacher";
  const isTeacher = values.type === "teacher";
  return `<div class="modal-backdrop" data-contact-editor-backdrop><section class="modal modal--contact-editor" role="dialog" aria-modal="true" aria-labelledby="contact-editor-title">
    <form class="contact-editor" data-contact-editor novalidate>
      <div class="contact-editor__head"><div><span class="eyebrow">${editing ? "EDITAR CONTATO" : "NOVO CONTATO"}</span><h2 id="contact-editor-title">${editing ? "Informações do contato" : "Adicionar contato"}</h2><p>Telefone e DDI são mantidos juntos, somente com números.</p></div><button class="icon-button" type="button" data-close-contact-editor aria-label="Fechar">${icon("close", 19)}</button></div>
      <div class="contact-fields">
        <label class="field"><span>Nome</span><span class="field__control">${icon("user", 17)}<input name="name" maxlength="120" value="${escapeHtml(values.name)}" placeholder="Ex.: Ana Martins" required autofocus /></span></label>
        <label class="field"><span>Tipo</span><span class="field__control">${icon("idCard", 17)}<select name="type" required ${teacherLocked ? "disabled" : ""}>${typeOptions(values.type)}</select></span>${teacherLocked ? '<small class="contact-editor__hint">Este professor permanece vinculado às disciplinas existentes.</small>' : ""}</label>
        <label class="field contact-editor__discipline ${isTeacher ? "" : "is-hidden"}" data-contact-discipline><span>Matéria <em>opcional</em></span><span class="field__control">${icon("book", 17)}<select name="disciplineId" ${isTeacher ? "" : "disabled"}>${disciplineOptions(disciplines, values.disciplineId)}</select></span><small class="contact-editor__hint">Ao selecionar, este professor será associado à matéria.</small></label>
        <label class="field"><span>E-mail <em>opcional</em></span><span class="field__control">${icon("mail", 17)}<input name="email" type="email" maxlength="254" value="${escapeHtml(values.email)}" placeholder="contato@instituicao.edu" /></span></label>
        <div class="contact-phone-fields"><label class="field"><span>Código do país</span><span class="field__control">${icon("phone", 17)}<select name="countryCode" aria-label="Código do país">${COUNTRY_CODES.map((country) => `<option value="${country.code}" ${country.code === values.countryCode ? "selected" : ""}>${escapeHtml(country.label)}</option>`).join("")}</select></span></label><label class="field"><span>Telefone <em>opcional</em></span><span class="field__control">${icon("phone", 17)}<input name="phone" type="tel" inputmode="tel" maxlength="18" value="${escapeHtml(formatPhoneNumber(values.phone, values.countryCode))}" placeholder="Número sem o código" /></span></label></div>
        <label class="field"><span>Observações <em>opcional</em></span><span class="field__control field__control--textarea">${icon("file", 17)}<textarea name="observations" maxlength="1200" placeholder="Informações que ajudam a lembrar deste contato">${escapeHtml(values.observations)}</textarea></span></label>
      </div>
      <div class="contact-editor__actions">${editing ? `<button class="button button--danger" type="button" data-request-contact-delete>${icon("trash", 16)} Apagar</button>` : ""}<span></span><button class="button button--ghost" type="button" data-close-contact-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} ${editing ? "Salvar alterações" : "Adicionar contato"}</button></div>
      <div class="contact-editor__confirm" data-contact-confirm hidden></div>
    </form>
  </section></div>`;
}

function formValues(form) {
  const type = form.querySelector("[name=type]")?.value || "";
  const values = Object.fromEntries(new FormData(form));
  values.type = type;
  values.phone = completePhone(values.countryCode, values.phone);
  delete values.countryCode;
  if (type !== "teacher") values.disciplineId = "";
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

function openConfirm(form, kind, record, { onDiscard, onSave, onDelete }) {
  const panel = form.querySelector("[data-contact-confirm]");
  const details = kind === "delete"
    ? { iconName: "trash", title: `Apagar ${record?.name || "este contato"}?`, text: "Esta ação não poderá ser desfeita.", cancel: "Cancelar", confirm: "Apagar", tone: "button--danger" }
    : { iconName: "save", title: "Salvar alterações antes de sair?", text: "Você fez mudanças neste contato que ainda não foram aplicadas.", cancel: "Descartar", confirm: "Salvar alterações", tone: "button--primary" };
  panel.hidden = false;
  panel.innerHTML = `<div><span>${icon(details.iconName, 20)}</span><h3>${escapeHtml(details.title)}</h3><p>${escapeHtml(details.text)}</p><div><button class="button button--ghost button--small" type="button" data-contact-confirm-cancel>${escapeHtml(details.cancel)}</button><button class="button ${details.tone} button--small" type="button" data-contact-confirm-action>${escapeHtml(details.confirm)}</button></div></div>`;
  panel.querySelector("[data-contact-confirm-cancel]").addEventListener("click", () => { panel.hidden = true; panel.innerHTML = ""; });
  panel.querySelector("[data-contact-confirm-action]").addEventListener("click", () => {
    panel.hidden = true;
    panel.innerHTML = "";
    if (kind === "delete") onDelete?.();
    else if (kind === "unsaved") onSave?.();
    else onDiscard?.();
  });
  if (kind === "unsaved") {
    panel.querySelector("[data-contact-confirm-cancel]").onclick = () => onDiscard?.();
  }
}

export function openContactEditor(record, { disciplines = [] } = {}, { onSave, onDelete, onSaved, onDismiss } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = editorMarkup(record, disciplines);
  const form = modalRoot.querySelector("[data-contact-editor]");
  let dirty = false;
  let submitting = false;
  const teardown = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };
  const dismiss = () => {
    teardown();
    onDismiss?.();
  };
  const submit = async () => {
    if (submitting || !form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    try {
      submitting = true;
      setButtonLoading(button, true);
      const saved = await onSave?.(formValues(form));
      teardown();
      onSaved?.(saved);
    } catch (error) {
      submitting = false;
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar o contato.", "error");
    }
  };
  const requestClose = () => {
    if (submitting) return;
    if (!dirty) return dismiss();
    openConfirm(form, "unsaved", record, { onDiscard: dismiss, onSave: submit });
  };
  const onKeydown = (event) => { if (event.key === "Escape") requestClose(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-contact-editor]").forEach((button) => button.addEventListener("click", requestClose));
  modalRoot.querySelector("[data-contact-editor-backdrop]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) requestClose();
  });
  form.addEventListener("input", () => { dirty = true; });
  form.addEventListener("change", (event) => {
    dirty = true;
    if (event.target.name !== "type") return;
    const isTeacher = event.target.value === "teacher";
    const discipline = form.querySelector("[data-contact-discipline]");
    discipline.classList.toggle("is-hidden", !isTeacher);
    discipline.querySelector("select").disabled = !isTeacher;
  });
  form.addEventListener("submit", (event) => { event.preventDefault(); submit(); });
  modalRoot.querySelector("[data-request-contact-delete]")?.addEventListener("click", () => {
    openConfirm(form, "delete", record, {
      onDelete: async () => {
        const button = form.querySelector("[data-request-contact-delete]");
        try {
          setButtonLoading(button, true);
          await onDelete?.(record);
          teardown();
          onSaved?.(null, { deleted: true });
        } catch (error) {
          setButtonLoading(button, false);
          showToast(error.message || "Não foi possível apagar o contato.", "error");
        }
      },
    });
  });
  bindPhoneFormatter(modalRoot);
  form.querySelector("input")?.focus();
}

function bindContactCards(container, records, openRecord) {
  container.querySelectorAll("[data-contact-action]").forEach((action) => action.addEventListener("click", (event) => event.stopPropagation()));
  container.querySelectorAll("[data-contact-card]").forEach((card) => {
    const open = () => openRecord(records.find((record) => recordKey(record) === card.dataset.contactCard));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

export function bindContacts(root, { records, disciplines = [], onBack, onSave, onDelete }) {
  root.querySelector("[data-back]")?.addEventListener("click", onBack);
  const openRecord = (record) => {
    if (!record) return;
    openContactEditor(record, { disciplines }, {
      onSave: (values) => onSave(record, values),
      onDelete,
      onSaved: () => onSave(null, null, { refresh: true }),
    });
  };
  root.querySelector("[data-add-contact]")?.addEventListener("click", () => openContactEditor(null, { disciplines }, {
    onSave: (values) => onSave(null, values),
    onSaved: () => onSave(null, null, { refresh: true }),
  }));
  bindContactCards(root, records, openRecord);
  const search = root.querySelector("[data-contacts-search]");
  const count = root.querySelector("[data-contacts-count]");
  const noResults = root.querySelector("[data-contacts-no-results]");
  search?.addEventListener("input", () => {
    const term = normalized(search.value.trim());
    let visible = 0;
    root.querySelectorAll("[data-contact-card]").forEach((card) => {
      const show = !term || card.dataset.contactSearch.includes(term);
      card.hidden = !show;
      card.classList.toggle("is-search-hidden", !show);
      if (show) visible += 1;
    });
    if (noResults) noResults.hidden = !term || visible > 0;
    if (count) count.textContent = term
      ? `${visible} ${visible === 1 ? "resultado encontrado" : "resultados encontrados"}`
      : `${records.length} ${records.length === 1 ? "contato cadastrado" : "contatos cadastrados"}`;
  });
}

export function openContactsSetup({ profile, disciplines = [], onCreate, onUpdate, onDelete, onFinish }) {
  const modalRoot = document.querySelector("#modal-root");
  let records = [];
  const finish = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
    onFinish?.(records.length);
  };
  const openEditor = (record = null) => openContactEditor(record, { disciplines }, {
    onSave: (values) => record ? onUpdate(record, values) : onCreate(values),
    onDelete,
    onSaved: (saved, meta = {}) => {
      if (meta.deleted) records = records.filter((item) => recordKey(item) !== recordKey(record));
      else records = record ? records.map((item) => recordKey(item) === recordKey(record) ? saved : item) : [...records, saved];
      render();
      showToast(meta.deleted ? "Contato removido." : "Contato salvo com sucesso.");
    },
    onDismiss: render,
  });
  const onKeydown = (event) => {
    if (event.key === "Escape" && modalRoot.querySelector("[data-contact-setup-backdrop]")) finish();
  };
  const render = () => {
    modalRoot.innerHTML = `<div class="modal-backdrop modal-backdrop--contact-setup" data-contact-setup-backdrop><section class="modal modal--contact-setup" role="dialog" aria-modal="true" aria-labelledby="contact-setup-title">
      <div class="contact-setup__head"><div><span class="eyebrow">PRÓXIMO PASSO</span><h2 id="contact-setup-title">Cadastre seus contatos</h2><p>Inclua professores e pessoas importantes do perfil <strong>${escapeHtml(profile.curso)}</strong>, ou faça isso depois.</p></div><button class="icon-button" type="button" data-finish-contact-setup aria-label="Registrar mais tarde">${icon("close", 19)}</button></div>
      <div class="contact-setup__profile">${icon("graduation", 18)}<span>${escapeHtml(profile.instituicao)} · ${escapeHtml(profile.curso)}</span></div>
      <div class="contact-setup__body"><div><h3>Contatos adicionados</h3><p>Você poderá editar tudo mais tarde na Central de contatos.</p></div><button class="button button--secondary" type="button" data-add-setup-contact>${icon("plus", 16)} Adicionar contato</button></div>
      <div class="contact-setup__list">${contactsList(records, disciplines)}</div>
      <div class="contact-setup__actions"><button class="text-button" type="button" data-finish-contact-setup>${records.length ? "Concluir cadastro" : "Pular por agora"}</button><button class="button button--primary" type="button" data-finish-contact-setup>${records.length ? "Concluir" : "Registrar mais tarde"} ${icon("arrowRight", 16)}</button></div>
    </section></div>`;
    modalRoot.querySelectorAll("[data-finish-contact-setup]").forEach((button) => button.addEventListener("click", finish));
    modalRoot.querySelector("[data-contact-setup-backdrop]").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) finish();
    });
    modalRoot.querySelector("[data-add-setup-contact]").addEventListener("click", () => openEditor());
    bindContactCards(modalRoot, records, openEditor);
  };
  document.addEventListener("keydown", onKeydown);
  render();
}
