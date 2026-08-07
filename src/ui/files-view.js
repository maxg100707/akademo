import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, confirmModal, setButtonLoading, showToast } from "./components.js";
import { openContentUploadWizard } from "./content-upload-wizard.js";

function lessonOptions(lessons, disciplineId, selectedId = "") {
  const items = lessons.filter((lesson) => lesson.disciplina === disciplineId);
  return `<option value="">Sem aula vinculada</option>${items.map((lesson) => `<option value="${escapeHtml(lesson.id)}" ${lesson.id === selectedId ? "selected" : ""}>${escapeHtml(lesson.tema || "Aula registrada")}</option>`).join("")}`;
}

function fileExtension(content) {
  const name = String(content.path || "").split("/").pop() || "";
  const extension = name.split(".").pop();
  return extension && extension !== name ? extension.toUpperCase().slice(0, 7) : "ARQUIVO";
}

function createdLabel(value) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(value))
    .replace(".", "");
}

function normalized(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesSearch(content, query, disciplines, lessons) {
  if (!query.trim()) return true;
  const discipline = disciplines.find((item) => item.id === content.disciplina);
  const lesson = lessons.find((item) => item.id === content.aula);
  const date = new Date(content.created_at);
  const searchable = [
    content.titulo,
    content.path,
    fileExtension(content),
    `.${fileExtension(content)}`,
    discipline?.nome_disciplina,
    lesson?.tema,
    createdLabel(content.created_at),
    Number.isNaN(date.valueOf()) ? "" : date.toLocaleDateString("pt-BR"),
    Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10),
    content.disciplina ? "" : "sem disciplina arquivo do perfil",
    content.aula ? "" : "sem aula",
  ].map(normalized).join(" ");
  return normalized(query).split(/\s+/).filter(Boolean).every((term) => searchable.includes(term));
}

function fileCard(content, disciplines, lessons) {
  const discipline = disciplines.find((item) => item.id === content.disciplina);
  const lesson = lessons.find((item) => item.id === content.aula);
  const context = lesson
    ? lesson.tema || "Aula registrada"
    : discipline?.nome_disciplina || "Arquivo do perfil";
  return `<article class="files-card"><button class="files-card__open" type="button" data-open-profile-file="${escapeHtml(content.id)}" aria-label="Abrir ${escapeHtml(content.titulo)}"><span class="files-card__icon">${icon("file", 23)}<small>${escapeHtml(fileExtension(content))}</small></span><div><small>${escapeHtml(context)}</small><strong>${escapeHtml(content.titulo)}</strong><p>${escapeHtml(createdLabel(content.created_at))}</p></div></button><div class="files-card__actions"><button class="icon-button" type="button" data-download-profile-file="${escapeHtml(content.id)}" aria-label="Baixar ${escapeHtml(content.titulo)}">${icon("download", 21)}</button><button class="icon-button" type="button" data-edit-profile-file="${escapeHtml(content.id)}" aria-label="Editar ${escapeHtml(content.titulo)}">${icon("edit", 20)}</button></div></article>`;
}

function editModal(content, disciplines, lessons) {
  return `<div class="modal-backdrop" data-files-edit-backdrop><section class="modal modal--files-editor" role="dialog" aria-modal="true" aria-labelledby="files-edit-title"><form class="files-editor" data-files-edit-form novalidate><div class="files-editor__head"><div><span class="eyebrow">EDITAR ARQUIVO</span><h2 id="files-edit-title">${escapeHtml(content.titulo)}</h2><p>Atualize o título e o local de organização deste arquivo.</p></div><button class="icon-button" type="button" data-close-files-edit aria-label="Fechar">${icon("close", 19)}</button></div><div class="files-editor__fields"><label class="field"><span>Título do arquivo</span><span class="field__control">${icon("file", 17)}<input name="title" maxlength="160" value="${escapeHtml(content.titulo)}" required autofocus /></span></label><label class="field"><span>Disciplina <em>opcional</em></span><span class="field__control">${icon("book", 17)}<select name="disciplineId" data-files-discipline><option value="">Sem disciplina</option>${disciplines.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === content.disciplina ? "selected" : ""}>${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label><label class="field"><span>Aula <em>opcional</em></span><span class="field__control">${icon("calendar", 17)}<select name="lessonId" data-files-lesson ${content.disciplina ? "" : "disabled"}>${lessonOptions(lessons, content.disciplina, content.aula)}</select></span></label></div><div class="files-editor__actions"><button class="button button--danger" type="button" data-delete-files-edit>${icon("trash", 16)} Excluir</button><span></span><button class="button button--ghost" type="button" data-close-files-edit>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} Salvar alterações</button></div></form></section></div>`;
}

function openModal(markup, backdrop, closeSelector, bind) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = markup;
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll(closeSelector).forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector(backdrop).addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  bind(modalRoot, close);
}

function bindRelationshipFields(root, lessons) {
  const discipline = root.querySelector("[data-files-discipline]");
  const lesson = root.querySelector("[data-files-lesson]");
  discipline.addEventListener("change", () => {
    lesson.disabled = !discipline.value;
    lesson.innerHTML = lessonOptions(lessons, discipline.value);
  });
}

function openEdit(content, disciplines, lessons, { onEdit, onDelete }) {
  openModal(editModal(content, disciplines, lessons), "[data-files-edit-backdrop]", "[data-close-files-edit]", (modalRoot, close) => {
    bindRelationshipFields(modalRoot, lessons);
    modalRoot.querySelector("[data-delete-files-edit]").addEventListener("click", async () => {
      const confirmed = await confirmModal({ title: "Excluir este arquivo?", message: `“${content.titulo}” será removido permanentemente do seu espaço.`, confirmLabel: "Excluir arquivo", tone: "danger" });
      if (!confirmed) return;
      try {
        await onDelete(content);
        close();
      } catch (error) {
        showToast(error.message || "Não foi possível excluir o arquivo.", "error");
      }
    });
    modalRoot.querySelector("[data-files-edit-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const button = form.querySelector("[type=submit]");
      try {
        setButtonLoading(button, true);
        const values = new FormData(form);
        await onEdit(content, { title: values.get("title"), disciplineId: values.get("disciplineId"), lessonId: values.get("lessonId") });
        close();
      } catch (error) {
        setButtonLoading(button, false);
        showToast(error.message || "Não foi possível editar o arquivo.", "error");
      }
    });
  });
}

export function filesView({ contents, disciplines, lessons, filter, search }) {
  const filtered = filter === "__none__"
    ? contents.filter((content) => !content.disciplina)
    : filter
      ? contents.filter((content) => content.disciplina === filter)
      : contents;
  const visible = filtered.filter((content) => matchesSearch(content, search, disciplines, lessons));
  return `<section class="page files-page"><div class="page-heading page-heading--row"><div><span class="eyebrow">BIBLIOTECA DO PERFIL</span><h1>Arquivos</h1><p>Todos os materiais privados do perfil ativo, com ou sem disciplina vinculada.</p></div><button class="button button--primary" data-add-profile-file>${icon("upload", 17)} Adicionar arquivo</button></div><div class="files-toolbar"><div class="files-toolbar__fields"><label class="field files-search"><span>Pesquisar arquivos</span><span class="field__control">${icon("search", 17)}<input data-files-search value="${escapeHtml(search)}" placeholder="Nome, PDF, data, aula..." autocomplete="off" /></span></label><label class="field"><span>Filtrar por disciplina</span><span class="field__control">${icon("book", 17)}<select data-files-filter><option value="">Todas as disciplinas</option><option value="__none__" ${filter === "__none__" ? "selected" : ""}>Sem disciplina</option>${disciplines.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === filter ? "selected" : ""}>${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label></div><p>${visible.length} ${visible.length === 1 ? "arquivo" : "arquivos"}</p></div><section class="files-grid">${visible.length ? visible.map((content) => fileCard(content, disciplines, lessons)).join("") : `<div class="files-empty"><span>${icon("file", 28)}</span><h2>Nenhum arquivo encontrado</h2><p>Tente outro termo, filtro ou envie um novo arquivo.</p></div>`}</section></section>`;
}

export function bindFiles(root, { contents, disciplines, lessons, onFilter, onSearch, onUpload, onOpen, onDownload, onEdit, onDelete }) {
  root.querySelector("[data-files-filter]").addEventListener("change", (event) => onFilter(event.target.value));
  root.querySelector("[data-files-search]").addEventListener("input", (event) => onSearch(event.target.value));
  root
    .querySelector("[data-add-profile-file]")
    .addEventListener("click", () =>
      openContentUploadWizard({
        context: "profile",
        disciplines,
        lessons,
        onUpload,
      }),
    );
  root.querySelectorAll("[data-open-profile-file]").forEach((button) => button.addEventListener("click", () => {
    const content = contents.find((item) => item.id === button.dataset.openProfileFile);
    if (content) onOpen(content);
  }));
  root.querySelectorAll("[data-download-profile-file]").forEach((button) => button.addEventListener("click", () => {
    const content = contents.find((item) => item.id === button.dataset.downloadProfileFile);
    if (content) onDownload(content);
  }));
  root.querySelectorAll("[data-edit-profile-file]").forEach((button) => button.addEventListener("click", () => {
    const content = contents.find((item) => item.id === button.dataset.editProfileFile);
    if (content) openEdit(content, disciplines, lessons, { onEdit, onDelete });
  }));
}
