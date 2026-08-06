import { icon } from "../utils/icons.js";
import { escapeHtml } from "../utils/formatters.js";
import { displayTime, timeParts, timeToMinutes, WEEKDAY_NAMES } from "../services/schedules.js";
import { closeModal, confirmModal, setButtonLoading, showToast } from "./components.js";

const HOURS = Array.from({ length: 24 }, (_, value) => value);
const MINUTES = Array.from({ length: 12 }, (_, value) => value * 5);
const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function scheduleValues(schedule) {
  return schedule ? {
    disciplineId: schedule.disciplina || "",
    weekday: String(schedule.dia_semana),
    startTime: displayTime(schedule.hora_inicio),
    endTime: displayTime(schedule.hora_fim),
  } : { disciplineId: "", weekday: "1", startTime: "08:00", endTime: "09:00" };
}

function wheelColumn(unit, values, selected) {
  return `<div class="time-wheel__column" data-wheel-column data-wheel-unit="${unit}" aria-label="${unit === "hour" ? "Hora" : "Minuto"}">
    <span class="time-wheel__fade time-wheel__fade--top"></span>
    ${values.map((value) => `<button type="button" class="time-wheel__option ${value === selected ? "is-selected" : ""}" data-wheel-value="${value}" aria-pressed="${value === selected}">${String(value).padStart(2, "0")}</button>`).join("")}
    <span class="time-wheel__fade time-wheel__fade--bottom"></span>
  </div>`;
}

function timeWheel(name, value) {
  const { hour, minute } = timeParts(value);
  return `<div class="time-wheel" data-time-wheel data-time-name="${name}">
    <input type="hidden" name="${name}" value="${displayTime(value)}" />
    ${wheelColumn("hour", HOURS, hour)}<span class="time-wheel__divider">:</span>${wheelColumn("minute", MINUTES, minute)}
  </div>`;
}

function scheduleFields(values, disciplines) {
  return `<div class="schedule-fields">
    <label class="field"><span>Disciplina</span><span class="field__control">${icon("book", 17)}<select name="disciplineId" required><option value="" disabled ${!values.disciplineId ? "selected" : ""}>Selecione uma disciplina</option>${disciplines.map((discipline) => `<option value="${escapeHtml(discipline.id)}" ${discipline.id === values.disciplineId ? "selected" : ""}>${escapeHtml(discipline.nome_disciplina)}</option>`).join("")}</select></span></label>
    <label class="field"><span>Dia da semana</span><span class="field__control">${icon("calendar", 17)}<select name="weekday" required>${WEEKDAY_NAMES.map((day, index) => `<option value="${index}" ${String(index) === values.weekday ? "selected" : ""}>${day}</option>`).join("")}</select></span></label>
    <div class="schedule-time-fields"><label class="field"><span>Início</span>${timeWheel("startTime", values.startTime)}</label><label class="field"><span>Fim</span>${timeWheel("endTime", values.endTime)}</label></div>
  </div>`;
}

function scheduleEditorModal(schedule, disciplines) {
  const editing = Boolean(schedule);
  return `<div class="modal-backdrop" data-schedule-editor-backdrop><section class="modal modal--schedule-editor" role="dialog" aria-modal="true" aria-labelledby="schedule-editor-title"><form class="schedule-editor" data-schedule-editor novalidate>
    <div class="schedule-editor__head"><div><span class="eyebrow">${editing ? "EDITAR HORÁRIO" : "NOVO HORÁRIO"}</span><h2 id="schedule-editor-title">${editing ? "Ajuste sua aula" : "Adicionar aula à grade"}</h2><p>Use as roletas para selecionar os horários em intervalos de cinco minutos.</p></div><button class="icon-button" type="button" data-close-schedule-editor aria-label="Fechar">${icon("close", 19)}</button></div>
    ${scheduleFields(scheduleValues(schedule), disciplines)}
    <div class="schedule-editor__actions">${editing ? `<button class="button button--danger" type="button" data-delete-schedule>${icon("trash", 16)} Excluir</button>` : ""}<span></span><button class="button button--ghost" type="button" data-close-schedule-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} ${editing ? "Salvar horário" : "Adicionar à grade"}</button></div>
  </form></section></div>`;
}

function setWheelValue(column, button, scroll = false) {
  column.querySelectorAll("[data-wheel-value]").forEach((option) => {
    const selected = option === button;
    option.classList.toggle("is-selected", selected);
    option.setAttribute("aria-pressed", String(selected));
  });
  const wheel = column.closest("[data-time-wheel]");
  const hour = wheel.querySelector('[data-wheel-unit="hour"] .is-selected')?.dataset.wheelValue || "0";
  const minute = wheel.querySelector('[data-wheel-unit="minute"] .is-selected')?.dataset.wheelValue || "0";
  wheel.querySelector("input").value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  if (scroll) button.scrollIntoView({ block: "center", behavior: "smooth" });
}

function bindTimeWheels(root) {
  root.querySelectorAll("[data-wheel-column]").forEach((column) => {
    let scrollTimeout;
    const options = [...column.querySelectorAll("[data-wheel-value]")];
    column.addEventListener("click", (event) => {
      const option = event.target.closest("[data-wheel-value]");
      if (option) setWheelValue(column, option, true);
    });
    column.addEventListener("scroll", () => {
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        const center = column.getBoundingClientRect().top + (column.clientHeight / 2);
        const closest = options.reduce((current, option) => {
          const distance = Math.abs((option.getBoundingClientRect().top + (option.offsetHeight / 2)) - center);
          return !current || distance < current.distance ? { option, distance } : current;
        }, null)?.option;
        if (closest) setWheelValue(column, closest);
      }, 55);
    }, { passive: true });
    requestAnimationFrame(() => column.querySelector(".is-selected")?.scrollIntoView({ block: "center" }));
  });
}

function openScheduleEditor(schedule, disciplines, onSave, onDelete) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = scheduleEditorModal(schedule, disciplines);
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-schedule-editor]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-schedule-editor-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  modalRoot.querySelector("[data-delete-schedule]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const confirmed = await confirmModal({ title: "Excluir este horário?", message: "A aula será removida da sua grade semanal.", confirmLabel: "Excluir horário", tone: "danger" });
    if (!confirmed) return;
    try { setButtonLoading(button, true); await onDelete(schedule); close(); }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível excluir o horário.", "error"); }
  });
  modalRoot.querySelector("[data-schedule-editor]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    if (timeToMinutes(values.endTime) <= timeToMinutes(values.startTime)) {
      showToast("O término deve acontecer depois do início da aula.", "error");
      return;
    }
    const button = form.querySelector("[type=submit]");
    try { setButtonLoading(button, true); await onSave(values); close(); }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível salvar o horário.", "error"); }
  });
  bindTimeWheels(modalRoot);
}

function mappedLesson(schedule, disciplines, teachers) {
  const discipline = disciplines.find((item) => item.id === schedule.disciplina) || null;
  const teacher = teachers.find((item) => item.id === discipline?.professor_id) || null;
  return { discipline, teacher };
}

function boardRange(schedules) {
  if (!schedules.length) return { start: 7 * 60, end: 22 * 60 };
  const earliest = Math.min(...schedules.map((schedule) => timeToMinutes(schedule.hora_inicio)));
  const latest = Math.max(...schedules.map((schedule) => timeToMinutes(schedule.hora_fim)));
  const start = Math.max(0, Math.floor((earliest - 60) / 60) * 60);
  const end = Math.min(24 * 60, Math.max(start + (8 * 60), Math.ceil((latest + 60) / 60) * 60));
  return { start, end };
}

function boardEvent(schedule, disciplines, teachers, range, pixelsPerMinute, minimumHeight, editing, index) {
  const { discipline, teacher } = mappedLesson(schedule, disciplines, teachers);
  const top = Math.max(0, timeToMinutes(schedule.hora_inicio) - range.start) * pixelsPerMinute;
  const height = Math.max(minimumHeight, (timeToMinutes(schedule.hora_fim) - timeToMinutes(schedule.hora_inicio)) * pixelsPerMinute);
  const name = escapeHtml(discipline?.nome_disciplina || "Disciplina não encontrada");
  return `<article class="schedule-block schedule-block--${index % 4} ${editing ? "is-editable" : ""}" ${editing ? `data-edit-schedule="${escapeHtml(schedule.id)}" role="button" tabindex="0" aria-label="Editar ${name}"` : ""} style="--block-top:${top}px;--block-height:${height}px"><strong>${name}</strong><small>${displayTime(schedule.hora_inicio)} – ${displayTime(schedule.hora_fim)}</small>${teacher ? `<em>${icon("userRound", 12)} ${escapeHtml(teacher.nome_professor)}</em>` : ""}${editing ? `<span class="schedule-block__edit">${icon("edit", 13)}</span>` : ""}</article>`;
}

function weeklyBoard(schedules, disciplines, teachers, editing) {
  if (!schedules.length) return `<div class="schedule-empty"><span>${icon("calendar", 27)}</span><h3>Sua grade está livre</h3><p>${editing ? "Use o botão Adicionar aula para montar seus horários." : "Ative o modo de edição para adicionar a primeira aula."}</p></div>`;
  const range = boardRange(schedules);
  const totalMinutes = range.end - range.start;
  const compactScreen = typeof window !== "undefined" && window.matchMedia?.("(max-width: 760px)").matches;
  const maxHeight = compactScreen ? 390 : 640;
  const minHeight = compactScreen ? 280 : 400;
  const minimumBlockHeight = compactScreen ? 26 : 30;
  const boardHeight = Math.min(maxHeight, Math.max(minHeight, totalMinutes * 0.82));
  const pixelsPerMinute = boardHeight / totalMinutes;
  const hours = Array.from({ length: (range.end - range.start) / 60 }, (_, index) => range.start + (index * 60));
  return `<div class="schedule-board__scroll"><div class="schedule-board" style="--board-height:${boardHeight}px">
    <div class="schedule-board__head"><span>HORÁRIO</span>${WEEKDAY_SHORT.map((day, index) => `<span class="${index === new Date().getDay() ? "is-today" : ""}">${day}<small>${WEEKDAY_NAMES[index]}</small></span>`).join("")}</div>
    <div class="schedule-board__body"><aside class="schedule-board__times">${hours.map((minute, index) => `<span style="--line-top:${index * 60 * pixelsPerMinute}px">${String(Math.floor(minute / 60)).padStart(2, "0")}:00</span>`).join("")}</aside><div class="schedule-board__days">${WEEKDAY_NAMES.map((_, day) => `<section class="schedule-day ${day === new Date().getDay() ? "is-today" : ""}">${hours.map((__, index) => `<i style="--line-top:${index * 60 * pixelsPerMinute}px"></i>`).join("")}${schedules.filter((schedule) => Number(schedule.dia_semana) === day).map((schedule, index) => boardEvent(schedule, disciplines, teachers, range, pixelsPerMinute, minimumBlockHeight, editing, index)).join("")}</section>`).join("")}</div></div>
  </div></div>`;
}

export function schedulesView({ profile, disciplines, teachers, schedules, editing }) {
  const course = escapeHtml(profile?.curso || "perfil atual");
  const canEdit = disciplines.length > 0;
  return `<section class="page schedules-page">
    <div class="page-heading page-heading--row schedules-page__heading"><div><span class="eyebrow">ROTINA SEMANAL</span><h1>Horários</h1><p>Visualize as aulas de <strong>${course}</strong> durante a semana.</p></div><div class="schedules-page__actions"><button class="button ${editing ? "button--secondary" : "button--primary"}" data-toggle-schedule-edit>${icon(editing ? "check" : "edit", 17)} ${editing ? "Concluir edição" : "Modo de edição"}</button>${editing ? `<button class="button button--primary" data-add-schedule ${canEdit ? "" : "disabled"}>${icon("plus", 17)} Adicionar aula</button>` : ""}</div></div>
    ${!canEdit ? `<div class="schedule-needs-discipline">${icon("book", 18)} <span>Cadastre ao menos uma disciplina antes de montar a grade.</span></div>` : ""}
    <section class="schedule-panel ${editing ? "is-editing" : ""}"><div class="schedule-panel__top"><div><strong>Grade semanal</strong><small>${editing ? "Clique em uma aula para editar." : "Ative o modo de edição para fazer alterações."}</small></div><span>${schedules.length} ${schedules.length === 1 ? "aula" : "aulas"}</span></div>${weeklyBoard(schedules, disciplines, teachers, editing)}</section>
  </section>`;
}

export function bindSchedules(root, { disciplines, schedules, editing, onToggleEdit, onCreate, onUpdate, onDelete }) {
  root.querySelector("[data-toggle-schedule-edit]").addEventListener("click", onToggleEdit);
  root.querySelector("[data-add-schedule]")?.addEventListener("click", () => {
    if (disciplines.length) openScheduleEditor(null, disciplines, onCreate);
  });
  if (!editing) return;
  root.querySelectorAll("[data-edit-schedule]").forEach((block) => {
    const open = () => {
      const schedule = schedules.find((item) => item.id === block.dataset.editSchedule);
      if (schedule) openScheduleEditor(schedule, disciplines, (values) => onUpdate(schedule.id, values), onDelete);
    };
    block.addEventListener("click", open);
    block.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
}
