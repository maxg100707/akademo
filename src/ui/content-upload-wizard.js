import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const CONTEXTS = {
  lesson: {
    eyebrow: "NOVO CONTEÚDO",
    selectTitle: "Escolha um arquivo",
    selectDescription: "Arraste um arquivo ou selecione-o no seu dispositivo.",
    detailsTitle: "Nomeie o arquivo",
    detailsDescription: "Use um nome claro para encontrá-lo com facilidade.",
    submitLabel: "Enviar arquivo",
  },
  profile: {
    eyebrow: "NOVO ARQUIVO",
    selectTitle: "Escolha um arquivo",
    selectDescription: "Arraste um arquivo ou selecione-o no seu dispositivo.",
    detailsTitle: "Organize o arquivo",
    detailsDescription: "Você pode vinculá-lo a uma disciplina e a uma aula ou mantê-lo apenas no perfil.",
    submitLabel: "Adicionar arquivo",
  },
  exam: {
    eyebrow: "NOVO MATERIAL",
    selectTitle: "Escolha um arquivo",
    selectDescription: "Arraste um arquivo ou selecione-o no seu dispositivo.",
    detailsTitle: "Organize o material",
    detailsDescription: "Escolha o tema da prova que receberá este arquivo.",
    submitLabel: "Enviar e vincular",
  },
  presentation: {
    eyebrow: "NOVO MATERIAL",
    selectTitle: "Escolha um arquivo",
    selectDescription: "Arraste um arquivo ou selecione-o no seu dispositivo.",
    detailsTitle: "Nomeie o material",
    detailsDescription: "O arquivo será salvo na disciplina e associado a esta apresentação.",
    submitLabel: "Enviar arquivo",
  },
};

function fileBaseName(file) {
  const name = String(file?.name || "Arquivo").trim();
  const extensionIndex = name.lastIndexOf(".");
  return extensionIndex > 0 ? name.slice(0, extensionIndex) : name;
}

function fileLabel(file) {
  if (!file) return "Até 20 MB";
  return `${file.name} · ${Math.max(1, Math.ceil(file.size / 1024))} KB`;
}

function lessonOptions(lessons, disciplineId) {
  const relevant = lessons.filter((lesson) => lesson.disciplina === disciplineId);
  return `<option value="">Sem aula vinculada</option>${relevant
    .map(
      (lesson) =>
        `<option value="${escapeHtml(lesson.id)}">${escapeHtml(lesson.tema || "Aula registrada")}</option>`,
    )
    .join("")}`;
}

function selectionModal(context, file) {
  return `<div class="modal-backdrop" data-upload-wizard-backdrop><section class="modal modal--upload-wizard" role="dialog" aria-modal="true" aria-labelledby="upload-wizard-title"><div class="upload-wizard"><div class="upload-wizard__head"><div><span class="eyebrow">${context.eyebrow}</span><h2 id="upload-wizard-title">${context.selectTitle}</h2><p>${context.selectDescription}</p></div><button class="icon-button" type="button" data-upload-wizard-close aria-label="Fechar">${icon("close", 19)}</button></div><input type="file" data-upload-wizard-file hidden /><button class="upload-wizard__dropzone ${file ? "has-file" : ""}" type="button" data-upload-wizard-dropzone><span>${icon(file ? "file" : "upload", 27)}</span><strong>${file ? "Arquivo selecionado" : "Arraste um arquivo ou clique para selecionar"}</strong><small data-upload-wizard-file-name>${escapeHtml(fileLabel(file))}</small></button><div class="upload-wizard__actions"><button class="button button--ghost" type="button" data-upload-wizard-close>Cancelar</button><button class="button button--primary" type="button" data-upload-wizard-next ${file ? "" : "disabled"}>Continuar ${icon("arrowRight", 17)}</button></div></div></section></div>`;
}

function profileFields(disciplines) {
  return `<label class="field"><span>Disciplina <em>opcional</em></span><span class="field__control">${icon("book", 17)}<select name="disciplineId" data-upload-wizard-discipline><option value="">Sem disciplina</option>${disciplines
    .map(
      (discipline) =>
        `<option value="${escapeHtml(discipline.id)}">${escapeHtml(discipline.nome_disciplina)}</option>`,
    )
    .join("")}</select></span></label><label class="field"><span>Aula <em>opcional</em></span><span class="field__control">${icon("calendar", 17)}<select name="lessonId" data-upload-wizard-lesson disabled><option value="">Sem aula vinculada</option></select></span></label>`;
}

function examFields(topics) {
  return `<label class="field"><span>Tema da prova</span><span class="field__control">${icon("book", 17)}<select name="topicId" required><option value="">Selecione o tema</option>${topics
    .map(
      (topic) =>
        `<option value="${escapeHtml(topic.id)}">${escapeHtml(topic.tema)}</option>`,
    )
    .join("")}</select></span></label>`;
}

function detailsModal(context, file, disciplines, topics) {
  const contextualFields =
    context === CONTEXTS.profile
      ? profileFields(disciplines)
      : context === CONTEXTS.exam
        ? examFields(topics)
        : "";
  return `<div class="modal-backdrop" data-upload-wizard-backdrop><section class="modal modal--upload-wizard" role="dialog" aria-modal="true" aria-labelledby="upload-wizard-details-title"><form class="upload-wizard" data-upload-wizard-details-form novalidate><div class="upload-wizard__head"><div><span class="eyebrow">${context.eyebrow}</span><h2 id="upload-wizard-details-title">${context.detailsTitle}</h2><p>${context.detailsDescription}</p></div><button class="icon-button" type="button" data-upload-wizard-close aria-label="Fechar">${icon("close", 19)}</button></div><div class="upload-wizard__file"><span>${icon("file", 19)}</span><div><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(fileLabel(file))}</small></div></div><div class="upload-wizard__fields"><label class="field"><span>Nome do arquivo</span><span class="field__control">${icon("file", 17)}<input name="title" maxlength="160" value="${escapeHtml(fileBaseName(file))}" required autofocus /></span></label>${contextualFields}</div><div class="upload-wizard__actions"><button class="button button--ghost" type="button" data-upload-wizard-back>${icon("arrowLeft", 17)} Voltar</button><button class="button button--primary" type="submit">${icon("upload", 17)} ${context.submitLabel}</button></div></form></section></div>`;
}

export function openContentUploadWizard({
  context: contextName = "lesson",
  disciplines = [],
  lessons = [],
  topics = [],
  onUpload,
}) {
  const context = CONTEXTS[contextName] || CONTEXTS.lesson;
  const modalRoot = document.querySelector("#modal-root");
  let selectedFile = null;
  let closed = false;

  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };
  const bindClose = () => {
    modalRoot
      .querySelectorAll("[data-upload-wizard-close]")
      .forEach((button) => button.addEventListener("click", close));
    modalRoot
      .querySelector("[data-upload-wizard-backdrop]")
      .addEventListener("click", (event) => {
        if (event.target === event.currentTarget) close();
      });
  };
  const renderSelection = () => {
    modalRoot.innerHTML = selectionModal(context, selectedFile);
    bindClose();
    const input = modalRoot.querySelector("[data-upload-wizard-file]");
    const dropzone = modalRoot.querySelector("[data-upload-wizard-dropzone]");
    const setFile = (file) => {
      if (!file) return;
      selectedFile = file;
      renderSelection();
    };
    dropzone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => setFile(input.files?.[0]));
    ["dragenter", "dragover"].forEach((eventName) =>
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragging");
      }),
    );
    ["dragleave", "drop"].forEach((eventName) =>
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragging");
      }),
    );
    dropzone.addEventListener("drop", (event) =>
      setFile(event.dataTransfer?.files?.[0]),
    );
    modalRoot
      .querySelector("[data-upload-wizard-next]")
      .addEventListener("click", renderDetails);
  };
  const renderDetails = () => {
    if (!selectedFile) return;
    modalRoot.innerHTML = detailsModal(context, selectedFile, disciplines, topics);
    bindClose();
    const discipline = modalRoot.querySelector("[data-upload-wizard-discipline]");
    const lesson = modalRoot.querySelector("[data-upload-wizard-lesson]");
    if (discipline && lesson) {
      discipline.addEventListener("change", () => {
        lesson.disabled = !discipline.value;
        lesson.innerHTML = lessonOptions(lessons, discipline.value);
      });
    }
    modalRoot
      .querySelector("[data-upload-wizard-back]")
      .addEventListener("click", renderSelection);
    modalRoot
      .querySelector("[data-upload-wizard-details-form]")
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        const button = form.querySelector("[type=submit]");
        const values = new FormData(form);
        try {
          setButtonLoading(button, true);
          await onUpload({
            file: selectedFile,
            title: String(values.get("title") || "").trim(),
            disciplineId: values.get("disciplineId") || "",
            lessonId: values.get("lessonId") || "",
            topicId: values.get("topicId") || "",
          });
          close();
        } catch (error) {
          setButtonLoading(button, false);
          showToast(
            error.message || "Não foi possível enviar o arquivo.",
            "error",
          );
        }
      });
  };

  document.addEventListener("keydown", onKeydown);
  renderSelection();
}
