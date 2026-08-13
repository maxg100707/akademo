import { displayTime } from "../services/schedules.js";
import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, confirmModal, setButtonLoading, showToast } from "./components.js";
import { openContentUploadWizard } from "./content-upload-wizard.js";

const asArray = (value) => Array.isArray(value) ? value : [];

function formatDate(value, options = { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) {
  return new Intl.DateTimeFormat("pt-BR", options).format(new Date(value)).replace(".", "");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function contentName(content) {
  return content?.titulo || "Arquivo sem t\u00edtulo";
}

function occurrenceOptions(occurrences, selected) {
  return `<option value="">Selecione a data e hor\u00e1rio</option>${occurrences.map((item) => `<option value="${escapeHtml(item.startsAt.toISOString())}" ${item.startsAt.toISOString() === selected ? "selected" : ""}>${escapeHtml(new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(item.startsAt).replace(".", ""))} \u00b7 ${displayTime(item.schedule.hora_inicio)}</option>`).join("")}`;
}

function examCard(exam, disciplines, topics = []) {
  const discipline = disciplines.find((item) => item.id === exam.disciplina);
  const isPast = new Date(exam.data) < new Date();
  const count = topics.filter((item) => item.prova === exam.id).length;
  return `<button class="exam-card ${isPast ? "is-past" : ""}" data-open-exam="${escapeHtml(exam.id)}"><span>${icon("check", 22)}</span><div><small>${escapeHtml(discipline?.nome_disciplina || "DISCIPLINA")}</small><strong>${escapeHtml(exam.titulo)}</strong><p>${formatDate(exam.data)} \u00b7 ${count} ${count === 1 ? "tema" : "temas"}</p></div>${icon("arrowRight", 18)}</button>`;
}

function examCreateModal(disciplines, occurrencesByDiscipline) {
  const initialDiscipline = disciplines[0]?.id || "";
  const initialOccurrences = occurrencesByDiscipline[initialDiscipline] || [];
  return `<div class="modal-backdrop" data-exam-create-backdrop><section class="modal modal--exam-editor" role="dialog" aria-modal="true" aria-labelledby="exam-create-title"><form class="exam-editor" data-exam-create-form novalidate><div class="exam-editor__head"><div><span class="eyebrow">NOVA PROVA</span><h2 id="exam-create-title">Planeje uma prova</h2><p>A data fica limitada aos hor\u00e1rios cadastrados da disciplina.</p></div><button class="icon-button" type="button" data-close-exam-create aria-label="Fechar">${icon("close", 19)}</button></div><div class="exam-editor__fields"><label class="field"><span>Disciplina</span><span class="field__control">${icon("book", 17)}<select name="disciplineId" data-exam-discipline required><option value="">Selecione a disciplina</option>${disciplines.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === initialDiscipline ? "selected" : ""}>${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label><label class="field"><span>Data da prova</span><span class="field__control">${icon("calendar", 17)}<select name="dateTime" data-exam-date required ${initialOccurrences.length ? "" : "disabled"}>${occurrenceOptions(initialOccurrences)}</select></span></label><label class="field"><span>T\u00edtulo da prova</span><span class="field__control">${icon("check", 17)}<input name="title" maxlength="180" placeholder="Ex.: Prova 1 - Estruturas de dados" required autofocus /></span></label></div><div class="exam-editor__actions"><button class="button button--ghost" type="button" data-close-exam-create>Cancelar</button><button class="button button--primary" type="submit">${icon("arrowRight", 17)} Criar e definir temas</button></div></form></section></div>`;
}

function closeWithEscape(close) {
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  return () => document.removeEventListener("keydown", onKeydown);
}

function openExamCreate({ disciplines, occurrencesByDiscipline, onCreate, onCreated }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = examCreateModal(disciplines, occurrencesByDiscipline);
  let unbindKeydown = null;
  const close = () => { unbindKeydown?.(); closeModal(); };
  unbindKeydown = closeWithEscape(close);
  modalRoot.querySelectorAll("[data-close-exam-create]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-exam-create-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  const discipline = modalRoot.querySelector("[data-exam-discipline]");
  const date = modalRoot.querySelector("[data-exam-date]");
  discipline.addEventListener("change", () => {
    const options = occurrencesByDiscipline[discipline.value] || [];
    date.disabled = !options.length;
    date.innerHTML = occurrenceOptions(options);
  });
  modalRoot.querySelector("[data-exam-create-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!date.value) {
      showToast("Escolha uma data livre na grade desta disciplina.", "error");
      return;
    }
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      const exam = await onCreate(Object.fromEntries(new FormData(form)));
      close();
      onCreated(exam);
    } catch (error) { setButtonLoading(button, false); showToast(error.message || "N\u00e3o foi poss\u00edvel criar a prova.", "error"); }
  });
}

function linkRow(link = {}) {
  return `<div class="exam-link-row" data-exam-link-row><span class="field__control"><input name="linkTitle" maxlength="120" value="${escapeHtml(link.titulo || "")}" placeholder="T\u00edtulo do link" /></span><span class="field__control"><input name="linkUrl" type="url" value="${escapeHtml(link.url || "")}" placeholder="https://..." /></span><button class="icon-button" type="button" data-remove-exam-link aria-label="Remover link">${icon("trash", 16)}</button></div>`;
}

function topicValues(form) {
  const data = new FormData(form);
  const titles = data.getAll("linkTitle");
  const urls = data.getAll("linkUrl");
  const links = titles.map((title, index) => ({ titulo: String(title).trim(), url: String(urls[index] || "").trim() }));
  if (links.some((link) => Boolean(link.titulo) !== Boolean(link.url))) throw new Error("Preencha t\u00edtulo e URL de cada link de apoio.");
  return {
    theme: data.get("theme"), summary: data.get("summary"), links: links.filter((link) => link.titulo),
    contents: data.getAll("contentId"),
  };
}

function contentChoices(contents, selected = []) {
  return contents.length ? `<div class="exam-content-choices">${contents.map((content) => `<label><input type="checkbox" name="contentId" value="${escapeHtml(content.id)}" ${selected.includes(content.id) ? "checked" : ""}/><span>${icon("file", 15)}</span><strong>${escapeHtml(contentName(content))}</strong></label>`).join("")}</div>` : `<p class="exam-form-note">Ainda n\u00e3o h\u00e1 arquivos nesta disciplina. Voc\u00ea poder\u00e1 adicion\u00e1-los depois.</p>`;
}

function topicForm(topic, contents, label) {
  const links = asArray(topic?.links);
  const selected = asArray(topic?.conteudos);
  return `<form class="exam-topic-form" data-exam-topic-form novalidate><label class="field"><span>Tema</span><span class="field__control">${icon("book", 17)}<input name="theme" maxlength="180" value="${escapeHtml(topic?.tema || "")}" placeholder="Ex.: \u00c1rvores bin\u00e1rias" required autofocus /></span></label><label class="field"><span>Resumo <em>opcional</em></span><textarea class="field__textarea" name="summary" maxlength="4000" placeholder="O que voc\u00ea precisa dominar neste tema?">${escapeHtml(topic?.resumo || "")}</textarea></label><div class="exam-topic-form__block"><div><strong>Links de apoio <em>opcional</em></strong><button class="text-button" type="button" data-add-exam-link>${icon("plus", 14)} Adicionar link</button></div><div data-exam-links>${(links.length ? links : [{}]).map(linkRow).join("")}</div></div><div class="exam-topic-form__block"><div><strong>Conte\u00fados da disciplina <em>opcional</em></strong><small>Selecione arquivos que ajudam neste tema.</small></div>${contentChoices(contents, selected)}</div><div class="exam-topic-form__actions"><button class="button button--secondary" type="submit">${icon("save", 16)} ${label}</button></div></form>`;
}

function attachTopicForm(root, onSave) {
  const linksRoot = root.querySelector("[data-exam-links]");
  const bindRemove = () => linksRoot.querySelectorAll("[data-remove-exam-link]").forEach((button) => button.addEventListener("click", () => {
    if (linksRoot.children.length > 1) button.closest("[data-exam-link-row]").remove();
    else button.closest("[data-exam-link-row]").querySelectorAll("input").forEach((input) => { input.value = ""; });
  }));
  bindRemove();
  root.querySelector("[data-add-exam-link]").addEventListener("click", () => {
    linksRoot.insertAdjacentHTML("beforeend", linkRow());
    bindRemove();
  });
  root.querySelector("[data-exam-topic-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    try { setButtonLoading(button, true); await onSave(topicValues(form)); }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "N\u00e3o foi poss\u00edvel salvar o tema.", "error"); }
  });
}

function examThemeSetupModal(exam, contents, topics) {
  return `<div class="modal-backdrop" data-exam-theme-setup-backdrop><section class="modal modal--exam-theme-setup" role="dialog" aria-modal="true" aria-labelledby="exam-theme-setup-title"><div class="exam-editor__head"><div><span class="eyebrow">PREPARA\u00c7\u00c3O DA PROVA</span><h2 id="exam-theme-setup-title">Defina os temas de estudo</h2><p>${escapeHtml(exam.titulo)} \u00b7 adicione quantos temas precisar.</p></div><button class="icon-button" type="button" data-finish-exam-themes aria-label="Concluir depois">${icon("close", 19)}</button></div>${topicForm(null, contents, "Adicionar tema")}<section class="exam-setup-topics"><div><strong>Temas cadastrados</strong><span>${topics.length}</span></div>${topics.length ? topics.map((topic) => `<article><span>${icon("book", 16)}</span><strong>${escapeHtml(topic.tema)}</strong><button class="icon-button icon-button--danger" type="button" data-delete-setup-topic="${escapeHtml(topic.id)}" aria-label="Excluir tema">${icon("trash", 15)}</button></article>`).join("") : `<p>Adicione ao menos um tema ou conclua para organizar depois.</p>`}</section><div class="exam-theme-setup__actions"><button class="button button--primary" type="button" data-finish-exam-themes>${topics.length ? "Abrir prova" : "Concluir depois"} ${icon("arrowRight", 16)}</button></div></section></div>`;
}

export function openExamThemeSetup({ exam, contents, initialTopics = [], onCreate, onDelete, onFinish }) {
  const modalRoot = document.querySelector("#modal-root");
  let topics = initialTopics;
  let unbindKeydown = null;
  const close = () => { unbindKeydown?.(); closeModal(); };
  const render = () => {
    modalRoot.innerHTML = examThemeSetupModal(exam, contents, topics);
    modalRoot.querySelectorAll("[data-finish-exam-themes]").forEach((button) => button.addEventListener("click", () => { close(); onFinish(); }));
    modalRoot.querySelector("[data-exam-theme-setup-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) { close(); onFinish(); } });
    attachTopicForm(modalRoot, async (values) => {
      const topic = await onCreate(values);
      topics = [...topics, topic];
      render();
      showToast("Tema adicionado \u00e0 prova.");
    });
    modalRoot.querySelectorAll("[data-delete-setup-topic]").forEach((button) => button.addEventListener("click", async () => {
      const topic = topics.find((item) => item.id === button.dataset.deleteSetupTopic);
      if (!topic || !await confirmModal({ title: "Excluir este tema?", message: `\u201c${topic.tema}\u201d ser\u00e1 removido da prova.`, confirmLabel: "Excluir tema", tone: "danger" })) return;
      try { await onDelete(topic); topics = topics.filter((item) => item.id !== topic.id); render(); }
      catch (error) { showToast(error.message || "N\u00e3o foi poss\u00edvel excluir o tema.", "error"); }
    }));
  };
  unbindKeydown = closeWithEscape(() => { close(); onFinish(); });
  render();
}

function topicEditorModal(topic, contents) {
  return `<div class="modal-backdrop" data-exam-topic-editor-backdrop><section class="modal modal--exam-theme-setup" role="dialog" aria-modal="true" aria-labelledby="exam-topic-editor-title"><div class="exam-editor__head"><div><span class="eyebrow">EDITAR TEMA</span><h2 id="exam-topic-editor-title">${escapeHtml(topic.tema)}</h2><p>Atualize explica\u00e7\u00f5es, links e arquivos deste tema.</p></div><button class="icon-button" type="button" data-close-exam-topic-editor aria-label="Fechar">${icon("close", 19)}</button></div>${topicForm(topic, contents, "Salvar tema")}</section></div>`;
}

export function openExamTopicEditor({ topic, contents, onUpdate }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = topicEditorModal(topic, contents);
  let unbindKeydown = null;
  const close = () => { unbindKeydown?.(); closeModal(); };
  unbindKeydown = closeWithEscape(close);
  modalRoot.querySelectorAll("[data-close-exam-topic-editor]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-exam-topic-editor-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  attachTopicForm(modalRoot, async (values) => { await onUpdate(topic, values); close(); });
}

export function examsView({ profile, disciplines, exams, topics, occurrencesByDiscipline }) {
  const upcoming = exams.filter((item) => new Date(item.data) >= new Date()).sort((a, b) => new Date(a.data) - new Date(b.data));
  return `<section class="page exams-page"><div class="page-heading page-heading--row"><div><span class="eyebrow">AVALIA\u00c7\u00d5ES</span><h1>Provas</h1><p>Planeje revis\u00f5es a partir da grade de hor\u00e1rios do perfil <strong>${escapeHtml(profile?.curso || "de estudo")}</strong>.</p></div><button class="button button--primary" data-add-exam ${disciplines.length ? "" : "disabled title=\"Cadastre uma disciplina e um hor\u00e1rio primeiro\""}>${icon("plus", 18)} Adicionar prova</button></div><section class="exams-list">${upcoming.length ? upcoming.map((exam) => examCard(exam, disciplines, topics)).join("") : `<div class="exams-empty"><span>${icon("check", 28)}</span><h3>Nenhuma prova futura</h3><p>Adicione uma prova escolhendo uma data dispon\u00edvel na grade semanal.</p></div>`}</section></section>`;
}

function proofSummary(topics) {
  if (!topics.length) return "Adicione temas para transformar esta prova em um plano de revis\u00e3o.";
  return `${topics.length} ${topics.length === 1 ? "tema organizado" : "temas organizados"} para sua revis\u00e3o.`;
}

function examTopicCard(topic, contents) {
  const linked = asArray(topic.conteudos).filter((id) => contents.some((content) => content.id === id)).length;
  return `<button class="exam-topic-card" data-open-exam-topic="${escapeHtml(topic.id)}"><span>${icon("book", 22)}</span><div><small>TEMA DE ESTUDO</small><strong>${escapeHtml(topic.tema)}</strong><p>${topic.resumo ? escapeHtml(topic.resumo) : "Sem resumo adicionado."}</p></div><em>${linked} ${linked === 1 ? "arquivo" : "arquivos"} ${icon("arrowRight", 16)}</em></button>`;
}

export function examDetailView({ exam, discipline, topics, contents }) {
  return `<section class="page exam-detail-page"><button class="back-link" data-exam-back>${icon("arrowLeft", 18)} Provas</button><section class="exam-detail-hero"><div><span class="eyebrow">PROVA PROGRAMADA</span><h1>${escapeHtml(exam.titulo)}</h1><p>${escapeHtml(discipline?.nome_disciplina || "Disciplina")} \u00b7 ${formatDate(exam.data)}</p></div><span>${icon("check", 24)}</span></section><section class="exam-detail-summary"><span>${icon("book", 18)}</span><div><small>RESUMO DA REVIS\u00c3O</small><p>${proofSummary(topics)}</p></div></section><section class="exam-topics"><div class="lesson-contents__heading"><div><span class="eyebrow">TEMAS</span><h2>Plano de estudos</h2><p>Acesse um tema para revisar materiais e links de apoio.</p></div><div class="exam-detail-actions"><button class="button button--secondary" data-open-exam-mindmaps>${icon("mindMap", 17)} Mapas</button><button class="button button--secondary" data-open-exam-materials>${icon("file", 17)} Materiais</button><button class="button button--primary" data-add-exam-topic>${icon("plus", 17)} Adicionar tema</button></div></div><div class="exam-topic-grid">${topics.length ? topics.map((topic) => examTopicCard(topic, contents)).join("") : `<div class="exams-empty"><span>${icon("book", 27)}</span><h3>Comece pelos temas</h3><p>Adicione assuntos para montar sua revis\u00e3o.</p></div>`}</div></section></section>`;
}

function topicContentCards(topic, contents) {
  const linked = asArray(topic.conteudos).map((id) => contents.find((content) => content.id === id)).filter(Boolean);
  return linked.length ? `<div class="exam-topic-content-grid">${linked.map((content) => `<button class="exam-topic-content" data-open-exam-content="${escapeHtml(content.id)}"><span>${icon("file", 18)}</span><strong>${escapeHtml(contentName(content))}</strong>${icon("arrowRight", 15)}</button>`).join("")}</div>` : `<p class="exam-form-note">Nenhum arquivo foi associado a este tema.</p>`;
}

export function examTopicView({ exam, topic, contents }) {
  const links = asArray(topic.links).map((link) => ({ titulo: String(link?.titulo || ""), url: safeUrl(link?.url) })).filter((link) => link.titulo && link.url);
  return `<section class="page exam-topic-page"><button class="back-link" data-exam-topic-back>${icon("arrowLeft", 18)} ${escapeHtml(exam.titulo)}</button><header class="exam-topic-header"><span>${icon("book", 22)}</span><div><small>${escapeHtml(exam.titulo)}</small><h1>${escapeHtml(topic.tema)}</h1><p>${topic.resumo ? escapeHtml(topic.resumo) : "Sem resumo adicionado para este tema."}</p></div><button class="icon-button" data-edit-exam-topic aria-label="Editar tema">${icon("edit", 18)}</button></header><section class="exam-topic-section"><div><span class="eyebrow">MATERIAIS</span><h2>Arquivos do tema</h2></div>${topicContentCards(topic, contents)}</section><section class="exam-topic-section"><div><span class="eyebrow">APOIO</span><h2>Links de estudo</h2></div>${links.length ? `<div class="exam-links-grid">${links.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><span>${icon("file", 17)}</span><strong>${escapeHtml(link.titulo)}</strong>${icon("arrowRight", 15)}</a>`).join("")}</div>` : `<p class="exam-form-note">Nenhum link de apoio foi adicionado.</p>`}</section><div class="exam-topic-page__actions"><button class="button button--danger" data-delete-exam-topic>${icon("trash", 16)} Excluir tema</button><button class="button button--secondary" data-open-exam-materials>${icon("file", 16)} Gerenciar materiais</button></div></section>`;
}

function examMaterialGrid(topics, contents) {
  const linked = topics.flatMap((topic) => asArray(topic.conteudos).map((id) => ({ topic, content: contents.find((item) => item.id === id) })).filter((item) => item.content));
  return linked.length ? `<div class="exam-material-grid">${linked.map(({ topic, content }) => `<article><button data-open-exam-content="${escapeHtml(content.id)}"><span>${icon("file", 20)}</span><strong>${escapeHtml(contentName(content))}</strong><small>${escapeHtml(topic.tema)}</small></button><button class="icon-button icon-button--danger" data-unlink-exam-content="${escapeHtml(topic.id)}:${escapeHtml(content.id)}" aria-label="Desvincular ${escapeHtml(contentName(content))}">${icon("close", 16)}</button></article>`).join("")}</div>` : `<div class="exams-empty"><span>${icon("file", 27)}</span><h3>Nenhum material vinculado</h3><p>Selecione arquivos da disciplina ou envie novos materiais para esta prova.</p></div>`;
}

function linkContentsModal(topics, contents) {
  return `<div class="modal-backdrop" data-link-exam-content-backdrop><section class="modal modal--exam-content-picker" role="dialog" aria-modal="true" aria-labelledby="link-exam-content-title"><form data-link-exam-content-form novalidate><div class="exam-editor__head"><div><span class="eyebrow">MATERIAIS DA PROVA</span><h2 id="link-exam-content-title">Vincular arquivos</h2><p>Escolha um tema e os conte\u00fados da disciplina.</p></div><button class="icon-button" type="button" data-close-link-exam-content aria-label="Fechar">${icon("close", 19)}</button></div><label class="field"><span>Tema</span><span class="field__control">${icon("book", 17)}<select name="topicId" required><option value="">Selecione o tema</option>${topics.map((topic) => `<option value="${escapeHtml(topic.id)}">${escapeHtml(topic.tema)}</option>`).join("")}</select></span></label><div class="exam-content-picker__list">${contentChoices(contents)}</div><div class="exam-editor__actions"><button class="button button--ghost" type="button" data-close-link-exam-content>Cancelar</button><button class="button button--primary" type="submit">${icon("plus", 16)} Vincular selecionados</button></div></form></section></div>`;
}

function openSimpleModal(markup, backdrop, closeSelector, onBind) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = markup;
  let unbindKeydown = null;
  const close = () => { unbindKeydown?.(); closeModal(); };
  unbindKeydown = closeWithEscape(close);
  modalRoot.querySelectorAll(closeSelector).forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector(backdrop).addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  onBind(modalRoot, close);
}

export function examMaterialsView({ exam, discipline, topics, contents }) {
  return `<section class="page exam-materials-page"><button class="back-link" data-exam-materials-back>${icon("arrowLeft", 18)} ${escapeHtml(exam.titulo)}</button><header class="exam-materials-header"><div><span class="eyebrow">MATERIAIS DA PROVA</span><h1>${escapeHtml(exam.titulo)}</h1><p>${escapeHtml(discipline?.nome_disciplina || "Disciplina")} \u00b7 arquivos organizados por tema.</p></div><div><button class="button button--secondary" data-link-exam-content ${topics.length ? "" : "disabled"}>${icon("plus", 16)} Vincular existentes</button><button class="button button--primary" data-upload-exam-content ${topics.length ? "" : "disabled"}>${icon("upload", 16)} Enviar arquivo</button></div></header>${examMaterialGrid(topics, contents)}</section>`;
}

export function bindExams(root, { disciplines, occurrencesByDiscipline, onCreate, onCreated, onOpen }) {
  root.querySelector("[data-add-exam]")?.addEventListener("click", () => openExamCreate({ disciplines, occurrencesByDiscipline, onCreate, onCreated }));
  root.querySelectorAll("[data-open-exam]").forEach((button) => button.addEventListener("click", () => onOpen(button.dataset.openExam)));
}

export function bindExamDetail(root, { exam, topics, contents, onBack, onOpenTopic, onOpenMaterials, onOpenMindMaps, onCreateTopic }) {
  root.querySelector("[data-exam-back]").addEventListener("click", onBack);
  root.querySelector("[data-open-exam-materials]").addEventListener("click", onOpenMaterials);
  root.querySelector("[data-open-exam-mindmaps]").addEventListener("click", onOpenMindMaps);
  root.querySelector("[data-add-exam-topic]").addEventListener("click", () => openExamTopicEditor({ topic: { tema: "", resumo: "", links: [], conteudos: [] }, contents, onUpdate: async (_topic, values) => onCreateTopic(values) }));
  root.querySelectorAll("[data-open-exam-topic]").forEach((button) => button.addEventListener("click", () => onOpenTopic(button.dataset.openExamTopic)));
}

export function bindExamTopic(root, { exam, topic, contents, onBack, onOpenMaterials, onOpenContent, onUpdate, onDelete }) {
  root.querySelector("[data-exam-topic-back]").addEventListener("click", onBack);
  root.querySelector("[data-open-exam-materials]").addEventListener("click", onOpenMaterials);
  root.querySelector("[data-edit-exam-topic]").addEventListener("click", () => openExamTopicEditor({ topic, contents, onUpdate }));
  root.querySelector("[data-delete-exam-topic]").addEventListener("click", async () => {
    if (!await confirmModal({ title: "Excluir este tema?", message: `\u201c${topic.tema}\u201d ser\u00e1 removido da prova.`, confirmLabel: "Excluir tema", tone: "danger" })) return;
    await onDelete(topic);
  });
  root.querySelectorAll("[data-open-exam-content]").forEach((button) => button.addEventListener("click", () => {
    const content = contents.find((item) => item.id === button.dataset.openExamContent);
    if (content) onOpenContent(content);
  }));
}

export function bindExamMaterials(root, { topics, contents, onBack, onOpenContent, onLink, onUpload, onUnlink }) {
  root.querySelector("[data-exam-materials-back]").addEventListener("click", onBack);
  root.querySelector("[data-link-exam-content]")?.addEventListener("click", () => openSimpleModal(linkContentsModal(topics, contents), "[data-link-exam-content-backdrop]", "[data-close-link-exam-content]", (modalRoot, close) => {
    modalRoot.querySelector("[data-link-exam-content-form]").addEventListener("submit", async (event) => {
      event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
      const ids = new FormData(form).getAll("contentId"); if (!ids.length) return showToast("Selecione ao menos um arquivo.", "error");
      const button = form.querySelector("[type=submit]"); try { setButtonLoading(button, true); await onLink(new FormData(form).get("topicId"), ids); close(); } catch (error) { setButtonLoading(button, false); showToast(error.message || "N\u00e3o foi poss\u00edvel vincular os arquivos.", "error"); }
    });
  }));
  root
    .querySelector("[data-upload-exam-content]")
    ?.addEventListener("click", () =>
      openContentUploadWizard({ context: "exam", topics, onUpload }),
    );
  root.querySelectorAll("[data-unlink-exam-content]").forEach((button) => button.addEventListener("click", async () => {
    const [topicId, contentId] = button.dataset.unlinkExamContent.split(":");
    try {
      setButtonLoading(button, true);
      await onUnlink(topicId, contentId);
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível desvincular o arquivo.", "error");
    }
  }));
  root.querySelectorAll("[data-open-exam-content]").forEach((button) => button.addEventListener("click", () => {
    const content = contents.find((item) => item.id === button.dataset.openExamContent);
    if (content) onOpenContent(content);
  }));
}
