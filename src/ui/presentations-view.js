import { displayTime } from "../services/schedules.js";
import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";
import { openContentUploadWizard } from "./content-upload-wizard.js";

const asArray = (value) => (Array.isArray(value) ? value : []);

function formatDate(value, options = { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) {
  return new Intl.DateTimeFormat("pt-BR", options)
    .format(new Date(value))
    .replace(".", "");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function contentName(content) {
  return content?.titulo || "Arquivo sem título";
}

function occurrenceOptions(occurrences) {
  return `<option value="">Selecione a data e horário</option>${occurrences.map((item) => `<option value="${escapeHtml(item.startsAt.toISOString())}">${escapeHtml(new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(item.startsAt).replace(".", ""))} · ${displayTime(item.schedule.hora_inicio)}</option>`).join("")}`;
}

function presentationCard(presentation, disciplines) {
  const discipline = disciplines.find((item) => item.id === presentation.disciplina);
  const isPast = new Date(presentation.data) < new Date();
  const materials = asArray(presentation.conteudos).length;
  return `<button class="presentation-card ${isPast ? "is-past" : ""}" data-open-presentation="${escapeHtml(presentation.id)}"><span>${icon("presentation", 22)}</span><div><small>${escapeHtml(discipline?.nome_disciplina || "DISCIPLINA")}</small><strong>${escapeHtml(presentation.titulo)}</strong><p>${escapeHtml(formatDate(presentation.data))} · ${materials} ${materials === 1 ? "material" : "materiais"}</p></div>${icon("arrowRight", 18)}</button>`;
}

function presentationCreateModal(disciplines, occurrencesByDiscipline) {
  const initialDiscipline = disciplines[0]?.id || "";
  const initialOccurrences = occurrencesByDiscipline[initialDiscipline] || [];
  return `<div class="modal-backdrop" data-presentation-create-backdrop><section class="modal modal--presentation-editor" role="dialog" aria-modal="true" aria-labelledby="presentation-create-title"><form class="presentation-editor" data-presentation-create-form novalidate><div class="presentation-editor__head"><div><span class="eyebrow">NOVA APRESENTAÇÃO</span><h2 id="presentation-create-title">Planeje uma apresentação</h2><p>A data é limitada aos horários cadastrados da disciplina.</p></div><button class="icon-button" type="button" data-close-presentation-create aria-label="Fechar">${icon("close", 19)}</button></div><div class="presentation-editor__fields"><label class="field"><span>Disciplina</span><span class="field__control">${icon("book", 17)}<select name="disciplineId" data-presentation-discipline required><option value="">Selecione a disciplina</option>${disciplines.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === initialDiscipline ? "selected" : ""}>${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label><label class="field"><span>Data da apresentação</span><span class="field__control">${icon("calendar", 17)}<select name="dateTime" data-presentation-date required ${initialOccurrences.length ? "" : "disabled"}>${occurrenceOptions(initialOccurrences)}</select></span></label><label class="field"><span>Título da apresentação</span><span class="field__control">${icon("presentation", 17)}<input name="title" maxlength="180" placeholder="Ex.: Seminário sobre redes" required autofocus /></span></label></div><div class="presentation-editor__actions"><button class="button button--ghost" type="button" data-close-presentation-create>Cancelar</button><button class="button button--primary" type="submit">${icon("arrowRight", 17)} Criar e configurar</button></div></form></section></div>`;
}

function closeWithEscape(close) {
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };
  document.addEventListener("keydown", onKeydown);
  return () => document.removeEventListener("keydown", onKeydown);
}

function openPresentationCreate({ disciplines, occurrencesByDiscipline, onCreate, onCreated }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = presentationCreateModal(disciplines, occurrencesByDiscipline);
  let unbindKeydown = null;
  const close = () => {
    unbindKeydown?.();
    closeModal();
  };
  unbindKeydown = closeWithEscape(close);
  modalRoot.querySelectorAll("[data-close-presentation-create]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-presentation-create-backdrop]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  const discipline = modalRoot.querySelector("[data-presentation-discipline]");
  const date = modalRoot.querySelector("[data-presentation-date]");
  discipline.addEventListener("change", () => {
    const options = occurrencesByDiscipline[discipline.value] || [];
    date.disabled = !options.length;
    date.innerHTML = occurrenceOptions(options);
  });
  modalRoot.querySelector("[data-presentation-create-form]").addEventListener("submit", async (event) => {
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
      const presentation = await onCreate(Object.fromEntries(new FormData(form)));
      close();
      onCreated(presentation);
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível criar a apresentação.", "error");
    }
  });
}

function linkRow(link = {}) {
  return `<div class="presentation-link-row" data-presentation-link-row><span class="field__control"><input name="linkTitle" maxlength="120" value="${escapeHtml(link.titulo || "")}" placeholder="Título do link" /></span><span class="field__control"><input name="linkUrl" type="url" value="${escapeHtml(link.url || "")}" placeholder="https://..." /></span><button class="icon-button" type="button" data-remove-presentation-link aria-label="Remover link">${icon("trash", 16)}</button></div>`;
}

function contentChoices(contents, selected = []) {
  return contents.length
    ? `<div class="presentation-content-choices">${contents.map((content) => `<label><input type="checkbox" name="contentId" value="${escapeHtml(content.id)}" ${selected.includes(content.id) ? "checked" : ""}/><span>${icon("file", 15)}</span><strong>${escapeHtml(contentName(content))}</strong></label>`).join("")}</div>`
    : `<p class="presentation-form-note">Ainda não há arquivos nesta disciplina. Você poderá selecioná-los depois.</p>`;
}

function presentationValues(form) {
  const data = new FormData(form);
  const titles = data.getAll("linkTitle");
  const urls = data.getAll("linkUrl");
  const links = titles.map((title, index) => ({
    titulo: String(title).trim(),
    url: String(urls[index] || "").trim(),
  }));
  if (links.some((link) => Boolean(link.titulo) !== Boolean(link.url)))
    throw new Error("Preencha título e URL de cada link de apoio.");
  return {
    instructions: data.get("instructions"),
    links: links.filter((link) => link.titulo),
    contents: data.getAll("contentId"),
  };
}

function presentationEditorModal(presentation, contents) {
  const links = asArray(presentation.links);
  const selected = asArray(presentation.conteudos);
  return `<div class="modal-backdrop" data-presentation-editor-backdrop><section class="modal modal--presentation-setup" role="dialog" aria-modal="true" aria-labelledby="presentation-editor-title"><form class="presentation-setup" data-presentation-editor-form novalidate><div class="presentation-editor__head"><div><span class="eyebrow">CONFIGURAR APRESENTAÇÃO</span><h2 id="presentation-editor-title">${escapeHtml(presentation.titulo)}</h2><p>Registre instruções, links de apoio e materiais que serão usados.</p></div><button class="icon-button" type="button" data-close-presentation-editor aria-label="Fechar">${icon("close", 19)}</button></div><label class="field"><span>Instruções <em>opcional</em></span><textarea class="field__textarea" name="instructions" maxlength="5000" placeholder="Descreva orientações, critérios, divisão de assuntos e observações importantes.">${escapeHtml(presentation.instrucao || "")}</textarea></label><div class="presentation-setup__block"><div><strong>Links de apoio <em>opcional</em></strong><button class="text-button" type="button" data-add-presentation-link>${icon("plus", 14)} Adicionar link</button></div><div data-presentation-links>${(links.length ? links : [{}]).map(linkRow).join("")}</div></div><div class="presentation-setup__block"><div><strong>Conteúdos da disciplina <em>opcional</em></strong><small>Selecione os arquivos que ajudam nesta apresentação.</small></div>${contentChoices(contents, selected)}</div><div class="presentation-editor__actions"><button class="button button--ghost" type="button" data-close-presentation-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} Salvar apresentação</button></div></form></section></div>`;
}

function bindPresentationForm(root, onSave) {
  const linksRoot = root.querySelector("[data-presentation-links]");
  const bindRemove = () => linksRoot.querySelectorAll("[data-remove-presentation-link]").forEach((button) => button.addEventListener("click", () => {
    if (linksRoot.children.length > 1) button.closest("[data-presentation-link-row]").remove();
    else button.closest("[data-presentation-link-row]").querySelectorAll("input").forEach((input) => { input.value = ""; });
  }));
  bindRemove();
  root.querySelector("[data-add-presentation-link]").addEventListener("click", () => {
    linksRoot.insertAdjacentHTML("beforeend", linkRow());
    bindRemove();
  });
  root.querySelector("[data-presentation-editor-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      await onSave(presentationValues(form));
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar a apresentação.", "error");
    }
  });
}

export function openPresentationEditor({ presentation, contents, onSave, onClose }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = presentationEditorModal(presentation, contents);
  let unbindKeydown = null;
  const close = () => {
    unbindKeydown?.();
    closeModal();
    onClose?.();
  };
  unbindKeydown = closeWithEscape(close);
  modalRoot.querySelectorAll("[data-close-presentation-editor]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-presentation-editor-backdrop]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  bindPresentationForm(modalRoot, async (values) => {
    await onSave(values);
    close();
  });
}

export function presentationsView({ profile, disciplines, presentations, occurrencesByDiscipline }) {
  const upcoming = presentations
    .filter((item) => new Date(item.data) >= new Date())
    .sort((first, second) => new Date(first.data) - new Date(second.data));
  return `<section class="page presentations-page"><div class="page-heading page-heading--row"><div><span class="eyebrow">APRESENTAÇÕES</span><h1>Apresentações</h1><p>Organize orientações e materiais da sua apresentação no perfil <strong>${escapeHtml(profile?.curso || "de estudo")}</strong>.</p></div><button class="button button--primary" data-add-presentation ${disciplines.length ? "" : "disabled title=\"Cadastre uma disciplina e um horário primeiro\""}>${icon("plus", 18)} Adicionar apresentação</button></div><section class="presentations-list">${upcoming.length ? upcoming.map((presentation) => presentationCard(presentation, disciplines)).join("") : `<div class="presentations-empty"><span>${icon("presentation", 28)}</span><h3>Nenhuma apresentação futura</h3><p>Adicione uma apresentação escolhendo uma data disponível na grade semanal.</p></div>`}</section></section>`;
}

function contentCards(presentation, contents) {
  const linked = asArray(presentation.conteudos)
    .map((id) => contents.find((content) => content.id === id))
    .filter(Boolean);
  return linked.length
    ? `<div class="presentation-content-grid">${linked.map((content) => `<button class="presentation-content-card" data-open-presentation-content="${escapeHtml(content.id)}"><span>${icon("file", 18)}</span><strong>${escapeHtml(contentName(content))}</strong>${icon("arrowRight", 15)}</button>`).join("")}</div>`
    : `<p class="presentation-form-note">Nenhum arquivo foi associado a esta apresentação.</p>`;
}

function linkCards(presentation) {
  const links = asArray(presentation.links)
    .map((link) => ({ titulo: String(link?.titulo || ""), url: safeUrl(link?.url) }))
    .filter((link) => link.titulo && link.url);
  return links.length
    ? `<div class="presentation-links-grid">${links.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"><span>${icon("file", 17)}</span><strong>${escapeHtml(link.titulo)}</strong>${icon("arrowRight", 15)}</a>`).join("")}</div>`
    : `<p class="presentation-form-note">Nenhum link de apoio foi adicionado.</p>`;
}

export function presentationDetailView({ presentation, discipline, contents }) {
  const materialCount = asArray(presentation.conteudos).length;
  const linkCount = asArray(presentation.links).filter((link) => safeUrl(link?.url) && String(link?.titulo || "").trim()).length;
  return `<section class="page presentation-detail-page"><button class="back-link" data-presentation-back>${icon("arrowLeft", 18)} Apresentações</button><section class="presentation-detail-hero"><div><span class="eyebrow">APRESENTAÇÃO PROGRAMADA</span><h1>${escapeHtml(presentation.titulo)}</h1><p>${escapeHtml(discipline?.nome_disciplina || "Disciplina")} · ${escapeHtml(formatDate(presentation.data))}</p></div><span>${icon("presentation", 24)}</span></section><section class="presentation-instructions"><div><span>${icon("info", 18)}</span><div><small>INSTRUÇÕES</small><p>${presentation.instrucao ? escapeHtml(presentation.instrucao) : "Ainda não há instruções registradas para esta apresentação."}</p></div></div></section><section class="lesson-tools presentation-resources"><div class="lesson-tools__heading"><div><span class="eyebrow">RECURSOS</span><h2>Recursos desta apresentação</h2><p>Centralize materiais, orientações e conteúdos de apoio para a sua preparação.</p></div></div><div class="lesson-tools-grid"><button class="lesson-tool-card lesson-tool-card--presentation-materials" data-open-presentation-materials><span>${icon("file", 24)}</span><div><small>ARQUIVOS</small><strong>Materiais</strong><p>${materialCount} ${materialCount === 1 ? "conteúdo separado" : "conteúdos separados"} para a apresentação.</p></div><em>Abrir ${icon("arrowRight", 17)}</em></button><button class="lesson-tool-card lesson-tool-card--presentation-support" data-edit-presentation><span>${icon("info", 24)}</span><div><small>PREPARAÇÃO</small><strong>Instruções e links</strong><p>${linkCount} ${linkCount === 1 ? "link de apoio cadastrado" : "links de apoio cadastrados"}.</p></div><em>Configurar ${icon("arrowRight", 17)}</em></button><button class="lesson-tool-card lesson-tool-card--mindmaps" data-open-presentation-mindmaps><span>${icon("mindMap", 24)}</span><div><small>CONTEÚDO VISUAL</small><strong>Mapas mentais</strong><p>Estruture argumentos, tópicos e relações importantes.</p></div><em>Abrir ${icon("arrowRight", 17)}</em></button><button class="lesson-tool-card lesson-tool-card--videos" data-open-presentation-videos><span>${icon("video", 24)}</span><div><small>CONTEÚDO EM VÍDEO</small><strong>Vídeos</strong><p>Reúna referências e materiais audiovisuais.</p></div><em>Abrir ${icon("arrowRight", 17)}</em></button></div></section></section>`;
}

export function presentationMaterialsView({ presentation, discipline, contents }) {
  return `<section class="page lesson-materials-page presentation-materials-page"><button class="back-link" data-presentation-materials-back>${icon("arrowLeft", 18)} Recursos</button><header class="lesson-tool-context"><span>${icon("presentation", 15)}</span><div><small>RECURSO DA APRESENTAÇÃO</small><strong>${escapeHtml(discipline?.nome_disciplina || "Disciplina")}</strong></div><p>${escapeHtml(presentation.titulo)}</p></header><section class="lesson-contents"><div class="lesson-contents__heading"><div><span class="eyebrow">MATERIAIS</span><h1>Conteúdos da apresentação</h1><p>Arquivos selecionados ficam organizados neste espaço.</p></div><button class="button button--primary" data-upload-presentation-content>${icon("upload", 17)} Adicionar arquivo</button></div>${contentCards(presentation, contents)}</section></section>`;
}

export function bindPresentations(root, { disciplines, occurrencesByDiscipline, onCreate, onCreated, onOpen }) {
  root.querySelector("[data-add-presentation]")?.addEventListener("click", () =>
    openPresentationCreate({ disciplines, occurrencesByDiscipline, onCreate, onCreated }),
  );
  root.querySelectorAll("[data-open-presentation]").forEach((button) =>
    button.addEventListener("click", () => onOpen(button.dataset.openPresentation)),
  );
}

export function bindPresentationDetail(root, { presentation, contents, onBack, onEdit, onOpenMaterials, onOpenMindMaps, onOpenVideos, onOpenContent, onUpload }) {
  root.querySelector("[data-presentation-back]").addEventListener("click", onBack);
  root.querySelector("[data-edit-presentation]").addEventListener("click", onEdit);
  root.querySelector("[data-open-presentation-mindmaps]").addEventListener("click", onOpenMindMaps);
  root.querySelector("[data-open-presentation-videos]").addEventListener("click", onOpenVideos);
  root.querySelector("[data-open-presentation-materials]").addEventListener("click", onOpenMaterials);
  root
    .querySelector("[data-upload-presentation-content]")
    ?.addEventListener("click", () =>
      openContentUploadWizard({ context: "presentation", onUpload }),
    );
  root.querySelectorAll("[data-open-presentation-content]").forEach((button) => {
    button.addEventListener("click", () => {
      const content = contents.find((item) => item.id === button.dataset.openPresentationContent);
      if (content) onOpenContent(content);
    });
  });
}

export function bindPresentationMaterials(root, { presentation, contents, onBack, onOpenContent, onUpload }) {
  root.querySelector("[data-presentation-materials-back]").addEventListener("click", onBack);
  root
    .querySelector("[data-upload-presentation-content]")
    ?.addEventListener("click", () => openContentUploadWizard({ context: "presentation", onUpload }));
  root.querySelectorAll("[data-open-presentation-content]").forEach((button) => {
    button.addEventListener("click", () => {
      const content = contents.find((item) => item.id === button.dataset.openPresentationContent);
      if (content) onOpenContent(content);
    });
  });
}
