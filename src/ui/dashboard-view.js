import { icon } from "../utils/icons.js";
import { escapeHtml, firstName } from "../utils/formatters.js";
import { displayTime, weekdayName } from "../services/schedules.js";
import { DASHBOARD_QUICK_ACTIONS } from "../services/settings.js";

function nextClassCard(nextClass, nextClassChronogram, isLoading) {
  if (isLoading) return `<section class="next-class-card is-loading"><span class="next-class-card__icon"><span class="spinner"></span></span><div><small>PRÓXIMA AULA</small><strong>Organizando sua rotina...</strong><p>Estamos buscando os horários deste perfil.</p></div></section>`;
  if (!nextClass) return `<button class="next-class-card" data-open-schedules><span class="next-class-card__icon">${icon("calendar", 22)}</span><div><small>PRÓXIMA AULA</small><strong>Nenhuma aula programada</strong><p>Monte sua grade semanal para acompanhar o próximo compromisso.</p></div><em>${icon("arrowRight", 18)}</em></button>`;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(nextClass.start).replace(".", "");
  const discipline = escapeHtml(nextClass.discipline?.nome_disciplina || "Disciplina");
  const teacher = escapeHtml(nextClass.teacher?.nome_professor || "Professor não informado");
  const topic = String(nextClassChronogram?.tema || "").trim();
  const status = nextClass.isLive ? "Acontecendo agora" : "Próxima aula";
  const statusClass = nextClass.isLive ? "is-live" : "is-upcoming";
  return `<button class="next-class-card ${statusClass}" data-open-next-class><span class="next-class-card__icon">${icon("calendar", 22)}</span><div class="next-class-card__content"><span class="next-class-card__status"><i></i>${status}</span><strong>${discipline}</strong><p>${weekdayName(nextClass.schedule.dia_semana)}, ${date} · ${displayTime(nextClass.schedule.hora_inicio)}–${displayTime(nextClass.schedule.hora_fim)}</p>${topic ? `<small class="next-class-card__topic">${icon("book", 13)} Tema: ${escapeHtml(topic)}</small>` : ""}<small>${icon("userRound", 13)} ${teacher}</small></div><em>${icon("arrowRight", 18)}</em></button>`;
}

function calendarDate(value) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
    time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function calendarAction(entry) {
  if (entry.kind === "task") return `data-open-task="${escapeHtml(entry.id)}"`;
  if (entry.kind === "exam") return entry.isChronogramOnly
    ? `data-open-dashboard-chronogram="${escapeHtml(entry.cronograma)}"`
    : `data-open-dashboard-exam="${escapeHtml(entry.id)}"`;
  return entry.isChronogramOnly
    ? `data-open-dashboard-presentation-chronogram="${escapeHtml(entry.cronograma)}"`
    : `data-open-dashboard-presentation="${escapeHtml(entry.id)}"`;
}

function dashboardCalendar({ tasks, exams, presentations, disciplines, chronograms }) {
  const now = new Date();
  const knownExams = new Set(exams.map((exam) => exam.cronograma));
  const knownPresentations = new Set(presentations.map((item) => item.cronograma));
  const events = [
    ...tasks
      .filter((task) => !task.completa)
      .map((task) => ({ ...task, kind: "task", date: task.prazo })),
    ...exams.map((exam) => ({ ...exam, kind: "exam", date: exam.data })),
    ...chronograms
      .filter((entry) => entry.prova && !knownExams.has(entry.id))
      .map((entry) => ({ id: `exam:${entry.id}`, cronograma: entry.id, disciplina: entry.disciplina, titulo: entry.tema, date: entry.data_hora, kind: "exam", isChronogramOnly: true })),
    ...presentations.map((item) => ({ ...item, kind: "presentation", date: item.data })),
    ...chronograms
      .filter((entry) => entry.apresentacao && !knownPresentations.has(entry.id))
      .map((entry) => ({ id: `presentation:${entry.id}`, cronograma: entry.id, disciplina: entry.disciplina, titulo: entry.tema, date: entry.data_hora, kind: "presentation", isChronogramOnly: true })),
  ]
    .filter((entry) => entry.kind === "task" || new Date(entry.date) >= now)
    .sort((first, second) => new Date(first.date) - new Date(second.date))
    .slice(0, 8);
  const details = {
    task: { label: "TAREFA", iconName: "check" },
    exam: { label: "PROVA", iconName: "exam" },
    presentation: { label: "APRESENTAÇÃO", iconName: "presentation" },
  };
  const entries = events.length
    ? events.map((entry) => {
      const discipline = disciplines.find((item) => item.id === entry.disciplina);
      const date = calendarDate(entry.date);
      const detail = details[entry.kind];
      const overdue = entry.kind === "task" && new Date(entry.date) < now;
      return `<button class="dashboard-calendar__event dashboard-calendar__event--${entry.kind} ${overdue ? "is-overdue" : ""}" type="button" ${calendarAction(entry)}><span class="dashboard-calendar__date"><strong>${date.day}</strong><small>${date.month}</small></span><div class="dashboard-calendar__content"><div class="dashboard-calendar__meta"><span class="dashboard-calendar__type">${icon(detail.iconName, 15)}<small>${detail.label}</small></span><small>${escapeHtml(discipline?.nome_disciplina || "Disciplina")}</small></div><strong>${escapeHtml(entry.titulo)}</strong><p>${overdue ? "Prazo atrasado" : entry.kind === "task" ? `Prazo às ${date.time}` : `${date.time} · compromisso programado`}</p></div>${icon("arrowRight", 16)}</button>`;
    }).join("")
    : `<p class="dashboard-calendar__empty">Nenhuma tarefa, prova ou apresentação futura neste perfil.</p>`;
  return `<section class="dashboard-calendar"><header><div><span class="eyebrow">CALENDÁRIO ACADÊMICO</span><h3>Próximos compromissos</h3></div><button class="icon-button" type="button" data-add-dashboard-task aria-label="Adicionar tarefa" ${disciplines.length ? "" : "disabled title=\"Cadastre uma disciplina primeiro\""}>${icon("plus", 18)}</button></header><div class="dashboard-calendar__legend"><span>${icon("check", 13)} Tarefas</span><span>${icon("exam", 13)} Provas</span><span>${icon("presentation", 13)} Apresentações</span></div><div class="dashboard-calendar__list">${entries}</div></section>`;
}

const FAVORITE_MODULES = {
  schedules: { label: "Horários", iconName: "calendar" }, lessons: { label: "Aulas", iconName: "book" }, chronogram: { label: "Cronograma", iconName: "file" }, tasks: { label: "Tarefas", iconName: "check" }, exams: { label: "Provas", iconName: "exam" }, presentations: { label: "Apresentações", iconName: "presentation" }, files: { label: "Arquivos", iconName: "folder" }, mindmaps: { label: "Mapas mentais", iconName: "mindMap" }, notes: { label: "Anotações", iconName: "note" }, summaries: { label: "Resumos", iconName: "note" }, flashcards: { label: "Flashcards", iconName: "flashcards" }, calculations: { label: "Cálculos", iconName: "calculator" }, glossary: { label: "Glossário", iconName: "glossary" }, videos: { label: "Vídeos", iconName: "video" }, bibliography: { label: "Bibliografia", iconName: "book" }, disciplines: { label: "Disciplinas", iconName: "book" }, teachers: { label: "Professores", iconName: "users" }, profiles: { label: "Perfis de estudo", iconName: "graduation" },
};

const WEEKDAY_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function widgetPanel({ eyebrow, title, iconName, tone = "", content }) {
  return `<section class="dashboard-widget__panel ${tone ? `dashboard-widget__panel--${tone}` : ""}"><header class="dashboard-widget__header"><div><span>${icon(iconName, 18)}</span><div><small>${eyebrow}</small><h3>${title}</h3></div></div></header>${content}</section>`;
}

function favoriteWidget(favorites) {
  const items = favorites.map((id) => ({ id, ...FAVORITE_MODULES[id] })).filter((item) => item.label);
  return widgetPanel({ eyebrow: "ACESSOS RÁPIDOS", title: "Favoritos", iconName: "sparkles", content: items.length
    ? `<div class="dashboard-favorites-grid">${items.map((item) => `<button class="dashboard-favorite-link" type="button" data-dashboard-favorite-nav="${item.id}">${icon(item.iconName, 19)}<span>${escapeHtml(item.label)}</span></button>`).join("")}</div>`
    : `<p class="dashboard-widget__empty">Escolha até quatro módulos nas configurações do Dashboard.</p>` });
}

function quickActionsWidget(actions) {
  const items = actions
    .map((id) => DASHBOARD_QUICK_ACTIONS.find((action) => action.id === id))
    .filter(Boolean);
  return widgetPanel({
    eyebrow: "FAÇA AGORA",
    title: "Ações rápidas",
    iconName: "plus",
    content: items.length
      ? `<div class="dashboard-quick-actions">${items.map((action) => `<button class="dashboard-quick-action" type="button" data-dashboard-quick-action="${escapeHtml(action.id)}"><span>${icon(action.iconName, 18)}</span><strong>${escapeHtml(action.label)}</strong></button>`).join("")}</div>`
      : `<p class="dashboard-widget__empty">Configure até seis ações rápidas nas configurações do Dashboard.</p>`,
  });
}

function scheduleWidget(schedules, disciplines) {
  const days = WEEKDAY_SHORT.map((day, index) => {
    const entries = schedules.filter((schedule) => Number(schedule.dia_semana) === index).sort((first, second) => String(first.hora_inicio).localeCompare(String(second.hora_inicio)));
    return `<div class="dashboard-mini-schedule__day ${index === new Date().getDay() ? "is-today" : ""}"><strong>${day}</strong>${entries.map((schedule) => {
      const discipline = disciplines.find((item) => item.id === schedule.disciplina);
      return `<span class="dashboard-mini-schedule__class" title="${escapeHtml(discipline?.nome_disciplina || "Disciplina")}">${escapeHtml(discipline?.nome_disciplina || "Disciplina")}<small>${displayTime(schedule.hora_inicio)}</small></span>`;
    }).join("")}</div>`;
  }).join("");
  return widgetPanel({ eyebrow: "ROTINA SEMANAL", title: "Horários", iconName: "calendar", tone: "teal", content: schedules.length
    ? `<button class="dashboard-mini-schedule" type="button" data-open-dashboard-schedules aria-label="Abrir horários">${days}</button>`
    : `<button class="dashboard-widget__empty" type="button" data-open-dashboard-schedules>Monte sua grade semanal para vê-la aqui.</button>` });
}

function formatRecordedDate(value) {
  if (!value) return "Aula registrada";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Aula registrada";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", "");
}

function latestLessonsWidget(lessons, disciplines) {
  const latest = [...lessons].sort((first, second) => new Date(second.created_at || 0) - new Date(first.created_at || 0)).slice(0, 4);
  return widgetPanel({ eyebrow: "REGISTROS RECENTES", title: "Últimas aulas", iconName: "book", content: latest.length
    ? `<div class="dashboard-recent-lessons">${latest.map((lesson) => {
      const discipline = disciplines.find((item) => item.id === lesson.disciplina);
      return `<button class="dashboard-recent-lesson" type="button" data-open-dashboard-lesson="${escapeHtml(lesson.id)}"><span>${icon("book", 15)}</span><div><strong>${escapeHtml(lesson.tema || discipline?.nome_disciplina || "Aula registrada")}</strong><small>${escapeHtml(discipline?.nome_disciplina || "Disciplina")} · ${formatRecordedDate(lesson.created_at)}</small></div>${icon("arrowRight", 15)}</button>`;
    }).join("")}</div>`
    : `<p class="dashboard-widget__empty">As aulas que você registrar aparecerão aqui.</p>` });
}

function configuredWidgets(settings) {
  const defaults = [{ id: "next-class", enabled: true }, { id: "academic-calendar", enabled: true }];
  return Array.isArray(settings?.dashboard?.widgets) && settings.dashboard.widgets.length ? settings.dashboard.widgets : defaults;
}

function dashboardWidget(widget, data, isSoloRow = false) {
  const soloClass = isSoloRow ? " dashboard-widget--solo-row" : "";
  if (widget.id === "next-class") return `<div class="dashboard-widget dashboard-widget--next${soloClass}">${nextClassCard(data.nextClass, data.nextClassChronogram, data.isNextClassLoading)}</div>`;
  if (widget.id === "academic-calendar") return `<div class="dashboard-widget dashboard-widget--calendar${soloClass}">${dashboardCalendar(data)}</div>`;
  if (widget.id === "favorites") return `<div class="dashboard-widget dashboard-widget--favorites${soloClass}">${favoriteWidget(data.settings?.dashboard?.favorites || [])}</div>`;
  if (widget.id === "quick-actions") return `<div class="dashboard-widget dashboard-widget--quick-actions${soloClass}">${quickActionsWidget(data.settings?.dashboard?.quickActions || [])}</div>`;
  if (widget.id === "schedules") return `<div class="dashboard-widget dashboard-widget--schedules${soloClass}">${scheduleWidget(data.schedules, data.disciplines)}</div>`;
  if (widget.id === "recent-lessons") return `<div class="dashboard-widget dashboard-widget--lessons${soloClass}">${latestLessonsWidget(data.lessons, data.disciplines)}</div>`;
  return "";
}

export function dashboardView({ record, profile, nextClass, nextClassChronogram, isNextClassLoading, tasks = [], disciplines = [], schedules = [], lessons = [], exams = [], presentations = [], chronograms = [], settings = null }) {
  const name = escapeHtml(firstName(record?.nome));
  const data = { profile, nextClass, nextClassChronogram, isNextClassLoading, tasks, disciplines, schedules, lessons, exams, presentations, chronograms, settings };
  const enabledWidgets = configuredWidgets(settings).filter((widget) => widget.enabled);
  const widgets = enabledWidgets.map((widget, index) => dashboardWidget(widget, data, enabledWidgets.length === 1 || (enabledWidgets.length % 2 === 1 && index === enabledWidgets.length - 1))).join("");
  return `<section class="page dashboard-page"><p class="dashboard-welcome">Olá, ${name}. Que bom ter você por aqui.</p><section class="dashboard-widgets-grid">${widgets || `<section class="dashboard-widget__panel"><p class="dashboard-widget__empty">Ative widgets em Configurações → Dashboard para montar sua rotina.</p></section>`}</section></section>`;
  return `<section class="page dashboard-page">
    <p class="dashboard-welcome">Olá, ${name}. Que bom ter você por aqui.</p>
    <section class="dashboard-recent">
      <div class="dashboard-recent-grid"><div>${nextClassCard(nextClass, nextClassChronogram, isNextClassLoading)}</div><div class="dashboard-recent-side">${dashboardCalendar({ tasks, exams, presentations, disciplines, chronograms })}</div></div>
    </section>
  </section>`;
}
