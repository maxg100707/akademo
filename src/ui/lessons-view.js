import { displayTime } from "../services/schedules.js";
import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import {
  closeModal,
  confirmModal,
  setButtonLoading,
  showToast,
} from "./components.js";
import { openContentUploadWizard } from "./content-upload-wizard.js";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S\u00e1b"];
const TYPE_META = {
  normal: { label: "Aula normal", icon: "book" },
  holiday: { label: "Feriado", icon: "calendar" },
  exam: { label: "Prova", icon: "check" },
  presentation: { label: "Apresenta\u00e7\u00e3o", icon: "graduation" },
};

function dateLabel(
  date,
  options = { weekday: "long", day: "2-digit", month: "long" },
) {
  return new Intl.DateTimeFormat("pt-BR", options)
    .format(date)
    .replace(".", "");
}

function occurrenceLabel(occurrence) {
  return `${dateLabel(occurrence.startsAt)} \u00b7 ${displayTime(occurrence.schedule.hora_inicio)} - ${displayTime(occurrence.schedule.hora_fim)}`;
}

function typeSwitches(selected = "normal") {
  return `<div class="lesson-type-switches" role="radiogroup" aria-label="Tipo de aula">${Object.entries(
    TYPE_META,
  )
    .map(
      ([type, meta]) =>
        `<label class="lesson-type-switch lesson-type-switch--${type}"><input type="radio" name="kind" value="${type}" ${selected === type ? "checked" : ""}/><span>${icon(meta.icon, 16)}</span><strong>${meta.label}</strong></label>`,
    )
    .join("")}</div>`;
}

function weekDay(date, occurrences, chronograms, lessons) {
  const isToday = date.toDateString() === new Date().toDateString();
  const items = occurrences.filter(
    (item) => item.startsAt.toDateString() === date.toDateString(),
  );
  return `<section class="lessons-day ${isToday ? "is-today" : ""}"><header><span>${WEEKDAYS[date.getDay()]}</span><strong>${date.getDate()}</strong><small>${new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "")}</small></header><div>${items
    .map((occurrence) => {
      const chronogram = chronograms.find(
        (item) =>
          item.disciplina === occurrence.discipline.id &&
          Math.abs(new Date(item.data_hora) - occurrence.startsAt) < 60000,
      );
      const lesson = chronogram
        ? lessons.find((item) => item.cronograma === chronogram.id)
        : null;
      const isHoliday = Boolean(chronogram?.feriado) && !lesson;
      const status = lesson
        ? "is-complete"
        : isHoliday
          ? "is-holiday"
          : chronogram
            ? "is-planned"
            : "is-pending";
      const hint = lesson
        ? "Aula registrada"
        : isHoliday
          ? "Feriado - sem aula"
          : chronogram
            ? "Continuar aula"
            : "Registrar aula";
      const action = isHoliday
        ? 'disabled aria-label="Feriado - n\u00e3o \u00e9 poss\u00edvel registrar aula"'
        : `data-open-week-lesson="${escapeHtml(occurrence.key)}"`;
      const actionIcon = lesson
        ? "check"
        : isHoliday
          ? "calendar"
          : "arrowRight";
      return `<button class="week-lesson ${status}" ${action}><span>${displayTime(occurrence.schedule.hora_inicio)}</span><div><strong>${escapeHtml(occurrence.discipline.nome_disciplina)}</strong><small>${chronogram && !isHoliday ? escapeHtml(chronogram.tema) : hint}</small></div>${icon(actionIcon, 16)}</button>`;
    })
    .join("")}</div></section>`;
}

export function lessonsWeekView({
  weekStart,
  occurrences,
  chronograms,
  lessons,
}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const activeDays = days.filter((date) =>
    occurrences.some(
      (item) => item.startsAt.toDateString() === date.toDateString(),
    ),
  );
  const weekEnd = days[6];
  const currentWeek = new Date();
  currentWeek.setHours(0, 0, 0, 0);
  currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay());
  const weekGrid = activeDays.length
    ? `<section class="lessons-week" style="--lesson-day-count: ${activeDays.length}">${activeDays.map((date) => weekDay(date, occurrences, chronograms, lessons)).join("")}</section>`
    : "";
  return `<section class="page lessons-page"><div class="page-heading page-heading--row lessons-page__heading"><div><span class="eyebrow">ROTINA DE ESTUDOS</span><h1>Aulas</h1><p>Selecione uma aula para registrar o que foi estudado e guardar seus conte\u00fados.</p></div><div class="lessons-week-navigation"><button class="icon-button" data-week-previous aria-label="Semana anterior">${icon("arrowLeft", 18)}</button><div><strong>${dateLabel(weekStart, { day: "2-digit", month: "short" })} - ${dateLabel(weekEnd, { day: "2-digit", month: "short", year: "numeric" })}</strong><small>${weekStart.toDateString() === currentWeek.toDateString() ? "Semana atual" : "Navegue pela sua agenda"}</small></div><button class="icon-button" data-week-next aria-label="Pr\u00f3xima semana">${icon("arrowRight", 18)}</button></div></div>${weekGrid}${occurrences.length ? "" : `<div class="lessons-empty"><span>${icon("calendar", 28)}</span><h3>Nenhuma aula nesta semana</h3><p>Confira os hor\u00e1rios cadastrados ou navegue para outra semana dentro do per\u00edodo do perfil.</p></div>`}</section>`;
}

export function lessonChronogramView(occurrence) {
  return `<section class="page lesson-setup-page"><button class="back-link" data-lesson-back>${icon("arrowLeft", 18)} Aulas</button><div class="lesson-setup-card"><div class="lesson-setup-card__intro"><span>${icon("calendar", 22)}</span><div><small>PRIMEIRO PASSO</small><h1>${escapeHtml(occurrence.discipline.nome_disciplina)}</h1><p>${escapeHtml(occurrenceLabel(occurrence))}</p></div></div><form class="lesson-form" data-lesson-chronogram-form novalidate><input type="hidden" name="disciplineId" value="${escapeHtml(occurrence.discipline.id)}"/><input type="hidden" name="dateTime" value="${occurrence.startsAt.toISOString()}"/><div class="form-grid"><label class="field"><span>Tema da aula</span><span class="field__control">${icon("book", 17)}<input name="topic" maxlength="180" placeholder="Ex.: Revis\u00e3o para a prova" required autofocus /></span></label><div class="field"><span>Tipo desta aula</span>${typeSwitches()}</div></div><div class="lesson-form__actions"><button class="button button--ghost" type="button" data-lesson-back>Cancelar</button><button class="button button--primary" type="submit">${icon("arrowRight", 17)} Continuar</button></div></form></div></section>`;
}

export function lessonFormView(occurrence, chronogram) {
  return `<section class="page lesson-setup-page"><button class="back-link" data-lesson-back>${icon("arrowLeft", 18)} Aulas</button><div class="lesson-setup-card"><div class="lesson-setup-card__intro"><span>${icon("book", 22)}</span><div><small>REGISTRAR AULA</small><h1>${escapeHtml(occurrence.discipline.nome_disciplina)}</h1><p>${escapeHtml(chronogram.tema)} \u00b7 ${escapeHtml(occurrenceLabel(occurrence))}</p></div></div><form class="lesson-form" data-lesson-form novalidate><label class="field"><span>Resumo da aula <em>opcional</em></span><textarea class="field__textarea lesson-summary-input" name="summary" maxlength="5000" placeholder="Anote os conceitos, d\u00favidas e pontos importantes desta aula."></textarea></label><p class="lesson-form__tip">Depois de salvar, voc\u00ea poder\u00e1 guardar arquivos, slides, listas e outros conte\u00fados desta aula.</p><div class="lesson-form__actions"><button class="button button--ghost" type="button" data-lesson-back>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 17)} Salvar aula</button></div></form></div></section>`;
}

function toolContext(lesson, occurrence) {
  const discipline = occurrence?.discipline?.nome_disciplina || "Disciplina";
  return `<header class="lesson-tool-context"><span>${icon("book", 15)}</span><div><small>FERRAMENTA DA AULA</small><strong>${escapeHtml(discipline)}</strong></div><p>${escapeHtml(lesson.tema || "Tema da aula")}</p></header>`;
}

function lessonTopicCard(lesson) {
  return `<section class="lesson-topic-card"><div><span>${icon("book", 18)}</span><div><small>TEMA DA AULA</small><strong>${escapeHtml(lesson.tema)}</strong></div></div><button class="button button--secondary" data-edit-lesson-topic>${icon("edit", 16)} Editar tema</button></section>`;
}

export function lessonDetailView({ lesson, occurrence }) {
  const date = occurrence?.startsAt || new Date(lesson.created_at);
  return `<section class="page lesson-detail-page"><button class="back-link" data-lesson-back>${icon("arrowLeft", 18)} Aulas</button><section class="lesson-detail-hero"><div><span class="eyebrow">AULA REGISTRADA</span><h1>${escapeHtml(lesson.tema)}</h1><p>${escapeHtml(occurrence?.discipline?.nome_disciplina || "Disciplina")} \u00b7 ${escapeHtml(dateLabel(date))}</p></div><span>${icon("check", 23)}</span></section>${lessonTopicCard(lesson)}<section class="lesson-summary-card"><div><span>${icon("book", 18)}</span><div><small>RESUMO DA AULA</small><p>${lesson.resumo ? escapeHtml(lesson.resumo).replace(/\n/g, "<br/>") : "Nenhum resumo foi adicionado para esta aula."}</p></div></div></section><section class="lesson-tools"><div class="lesson-tools__heading"><div><span class="eyebrow">FERRAMENTAS</span><h2>Recursos desta aula</h2><p>Centralize materiais e seus pr\u00f3ximos passos no mesmo lugar.</p></div></div><div class="lesson-tools-grid"><button class="lesson-tool-card" data-open-lesson-materials><span>${icon("file", 24)}</span><div><small>ARQUIVOS</small><strong>Materiais</strong><p>Slides, listas, documentos e outros conte\u00fados.</p></div><em>Abrir ${icon("arrowRight", 17)}</em></button><button class="lesson-tool-card lesson-tool-card--tasks" data-open-lesson-tasks><span>${icon("check", 24)}</span><div><small>ORGANIZA\u00c7\u00c3O</small><strong>Tarefas</strong><p>Entregas e pend\u00eancias que nasceram nesta aula.</p></div><em>Abrir ${icon("arrowRight", 17)}</em></button></div></section></section>`;
}

function lessonTopicEditorModal(lesson) {
  return `<div class="modal-backdrop" data-lesson-topic-backdrop><section class="modal modal--lesson-topic" role="dialog" aria-modal="true" aria-labelledby="lesson-topic-title"><form class="lesson-topic-editor" data-lesson-topic-form novalidate><div class="lesson-topic-editor__head"><div><span class="eyebrow">TEMA DA AULA</span><h2 id="lesson-topic-title">Editar tema</h2><p>A atualiza\u00e7\u00e3o tamb\u00e9m ser\u00e1 aplicada ao cronograma desta aula.</p></div><button class="icon-button" type="button" data-close-lesson-topic aria-label="Fechar">${icon("close", 19)}</button></div><label class="field"><span>Tema</span><span class="field__control">${icon("book", 17)}<input name="topic" maxlength="180" value="${escapeHtml(lesson.tema)}" required autofocus /></span></label><div class="lesson-topic-editor__actions"><button class="button button--ghost" type="button" data-close-lesson-topic>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 17)} Salvar tema</button></div></form></section></div>`;
}

export function openLessonTopicEditor({ lesson, onSave }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = lessonTopicEditorModal(lesson);
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };
  document.addEventListener("keydown", onKeydown);
  modalRoot
    .querySelectorAll("[data-close-lesson-topic]")
    .forEach((button) => button.addEventListener("click", close));
  modalRoot
    .querySelector("[data-lesson-topic-backdrop]")
    .addEventListener("click", (event) => {
      if (event.target === event.currentTarget) close();
    });
  modalRoot
    .querySelector("[data-lesson-topic-form]")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const button = form.querySelector("[type=submit]");
      try {
        setButtonLoading(button, true);
        await onSave(String(new FormData(form).get("topic") || "").trim());
        close();
      } catch (error) {
        setButtonLoading(button, false);
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel atualizar o tema.",
          "error",
        );
      }
    });
}

function contentCard(content) {
  return `<article class="lesson-content-card" data-open-content="${escapeHtml(content.id)}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(content.titulo)}"><span class="lesson-content-card__icon">${icon("file", 20)}</span><div><strong>${escapeHtml(content.titulo)}</strong><small>Arquivo privado desta aula</small></div><div class="lesson-content-card__actions"><button class="icon-button" data-download-content="${escapeHtml(content.id)}" aria-label="Baixar ${escapeHtml(content.titulo)}">${icon("download", 17)}</button><button class="icon-button icon-button--danger" data-delete-content="${escapeHtml(content.id)}" aria-label="Excluir ${escapeHtml(content.titulo)}">${icon("trash", 17)}</button></div></article>`;
}

export function lessonMaterialsView({ lesson, occurrence, contents }) {
  return `<section class="page lesson-materials-page"><button class="back-link" data-lesson-tools-back>${icon("arrowLeft", 18)} Ferramentas</button>${toolContext(lesson, occurrence)}<section class="lesson-contents"><div class="lesson-contents__heading"><div><span class="eyebrow">MATERIAIS</span><h1>Conte\u00fados da aula</h1><p>Arquivos ficam privados no seu espa\u00e7o AKADEMO.</p></div><button class="button button--primary" data-upload-content>${icon("upload", 17)} Adicionar arquivo</button></div><div class="lesson-content-list">${contents.length ? contents.map(contentCard).join("") : `<div class="lesson-contents-empty"><span>${icon("file", 26)}</span><h3>Nenhum arquivo ainda</h3><p>Adicione materiais para manter tudo organizado nesta aula.</p></div>`}</div></section></section>`;
}

export function bindLessonsWeek(
  root,
  { occurrences, onPrevious, onNext, onOpen },
) {
  root
    .querySelector("[data-week-previous]")
    .addEventListener("click", onPrevious);
  root.querySelector("[data-week-next]").addEventListener("click", onNext);
  root.querySelectorAll("[data-open-week-lesson]").forEach((button) =>
    button.addEventListener("click", () => {
      const occurrence = occurrences.find(
        (item) => item.key === button.dataset.openWeekLesson,
      );
      if (occurrence) onOpen(occurrence);
    }),
  );
}

export function bindLessonChronogram(root, { onBack, onSave }) {
  root
    .querySelectorAll("[data-lesson-back]")
    .forEach((button) => button.addEventListener("click", onBack));
  root
    .querySelector("[data-lesson-chronogram-form]")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const button = form.querySelector("[type=submit]");
      try {
        setButtonLoading(button, true);
        await onSave(Object.fromEntries(new FormData(form)));
      } catch (error) {
        setButtonLoading(button, false);
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel registrar o cronograma.",
          "error",
        );
      }
    });
}

export function bindLessonForm(root, { onBack, onSave }) {
  root
    .querySelectorAll("[data-lesson-back]")
    .forEach((button) => button.addEventListener("click", onBack));
  root
    .querySelector("[data-lesson-form]")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("[type=submit]");
      try {
        setButtonLoading(button, true);
        await onSave(new FormData(form).get("summary"));
      } catch (error) {
        setButtonLoading(button, false);
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel salvar a aula.",
          "error",
        );
      }
    });
}

export function bindLessonDetail(
  root,
  { onBack, onOpenMaterials, onOpenTasks, onEditTopic },
) {
  root
    .querySelectorAll("[data-lesson-back]")
    .forEach((button) => button.addEventListener("click", onBack));
  root
    .querySelector("[data-open-lesson-materials]")
    .addEventListener("click", onOpenMaterials);
  root
    .querySelector("[data-open-lesson-tasks]")
    .addEventListener("click", onOpenTasks);
  root
    .querySelector("[data-edit-lesson-topic]")
    .addEventListener("click", onEditTopic);
}

export function bindLessonMaterials(
  root,
  {
    contents,
    onBack,
    onUpload,
    onOpenContent,
    onDownloadContent,
    onDeleteContent,
  },
) {
  root
    .querySelector("[data-lesson-tools-back]")
    .addEventListener("click", onBack);
  root
    .querySelector("[data-upload-content]")
    .addEventListener("click", () =>
      openContentUploadWizard({ context: "lesson", onUpload }),
    );
  root.querySelectorAll("[data-open-content]").forEach((card) => {
    const open = (event) => {
      if (
        event?.target?.closest("[data-download-content], [data-delete-content]")
      )
        return;
      const content = contents.find(
        (item) => item.id === card.dataset.openContent,
      );
      if (content) onOpenContent(content);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(event);
      }
    });
  });
  root.querySelectorAll("[data-download-content]").forEach((button) =>
    button.addEventListener("click", () => {
      const content = contents.find(
        (item) => item.id === button.dataset.downloadContent,
      );
      if (content) onDownloadContent(content);
    }),
  );
  root.querySelectorAll("[data-delete-content]").forEach((button) =>
    button.addEventListener("click", async () => {
      const content = contents.find(
        (item) => item.id === button.dataset.deleteContent,
      );
      if (!content) return;
      if (
        await confirmModal({
          title: "Excluir este arquivo?",
          message: `\u201c${content.titulo}\u201d ser\u00e1 removido do armazenamento privado.`,
          confirmLabel: "Excluir arquivo",
          tone: "danger",
        })
      )
        await onDeleteContent(content);
    }),
  );
}
