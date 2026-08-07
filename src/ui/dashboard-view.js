import { icon } from "../utils/icons.js";
import { escapeHtml, firstName } from "../utils/formatters.js";
import { displayTime, weekdayName } from "../services/schedules.js";

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

function basicAccess({ action, iconName, eyebrow, title, description, tone = "" }) {
  return `<button class="dashboard-basic-card ${tone}" data-open-${action}><span>${icon(iconName, 20)}</span><div><small>${eyebrow}</small><strong>${title}</strong><p>${description}</p></div>${icon("arrowRight", 17)}</button>`;
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

export function dashboardView({ record, profile, nextClass, nextClassChronogram, isNextClassLoading, tasks = [], disciplines = [], lessons = [], exams = [], presentations = [], chronograms = [] }) {
  const name = escapeHtml(firstName(record?.nome));
  const course = escapeHtml(profile?.curso || "seu curso");
  return `<section class="page dashboard-page">
    <div class="page-heading page-heading--hero">
      <div><span class="eyebrow">VISÃO GERAL</span><h1>Olá, ${name} <span class="wave">✦</span></h1><p>Seu espaço para estudar com mais intenção, ${course} por vez.</p></div>
    </div>
    <section class="dashboard-recent">
      <div class="dashboard-section-title"><div><span class="eyebrow">RECENTES</span><h2>Sua rotina agora</h2></div><span class="soft-status">Perfil em foco</span></div>
      <div class="dashboard-recent-grid"><div>${nextClassCard(nextClass, nextClassChronogram, isNextClassLoading)}</div><div class="dashboard-recent-side">${dashboardCalendar({ tasks, exams, presentations, disciplines, chronograms })}</div></div>
    </section>
    <section class="dashboard-basics"><div class="dashboard-section-title"><div><span class="eyebrow">CADASTROS BÁSICOS</span><h2>Organize sua base</h2></div></div><div class="dashboard-basic-grid">${basicAccess({ action: "teachers", iconName: "users", eyebrow: "PROFESSORES", title: "Professores", description: "Contatos do perfil" })}${basicAccess({ action: "disciplines", iconName: "book", eyebrow: "DISCIPLINAS", title: "Disciplinas", description: "Sua grade de estudo", tone: "dashboard-basic-card--teal" })}${basicAccess({ action: "profiles", iconName: "graduation", eyebrow: "PERFIS", title: "Perfis de estudo", description: "Cursos e semestres", tone: "dashboard-basic-card--olive" })}</div></section>
  </section>`;
}
