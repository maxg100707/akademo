import { icon } from "../utils/icons.js";
import { escapeHtml, firstName } from "../utils/formatters.js";
import { displayTime, weekdayName } from "../services/schedules.js";
import { taskListMarkup } from "./tasks-view.js";

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

function dashboardExams(exams, disciplines, chronograms) {
  const now = new Date();
  const inOneWeek = new Date(now);
  inOneWeek.setDate(inOneWeek.getDate() + 7);
  const knownChronograms = new Set(exams.map((exam) => exam.cronograma));
  const upcoming = [
    ...exams,
    ...chronograms
      .filter((entry) => entry.prova && !knownChronograms.has(entry.id))
      .map((entry) => ({
        id: `chronogram:${entry.id}`,
        cronograma: entry.id,
        disciplina: entry.disciplina,
        titulo: entry.tema,
        data: entry.data_hora,
        isChronogramOnly: true,
      })),
  ]
    .filter((exam) => {
      const date = new Date(exam.data);
      return date >= now && date < inOneWeek;
    })
    .sort((first, second) => new Date(first.data) - new Date(second.data));
  const formatDate = (value) =>
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value)).replace(".", "");
  const entries = upcoming.length
    ? upcoming.map((exam) => {
      const discipline = disciplines.find((item) => item.id === exam.disciplina);
      const action = exam.isChronogramOnly
        ? `data-open-dashboard-chronogram="${escapeHtml(exam.cronograma)}"`
        : `data-open-dashboard-exam="${escapeHtml(exam.id)}"`;
      return `<button class="dashboard-exam-card" type="button" ${action}><span>${icon("exam", 17)}</span><div><small>${escapeHtml(discipline?.nome_disciplina || "Disciplina")}</small><strong>${escapeHtml(exam.titulo)}</strong><p>${escapeHtml(formatDate(exam.data))}</p></div>${icon("arrowRight", 15)}</button>`;
    }).join("")
    : `<p class="dashboard-exams__empty">Nenhuma prova marcada para os próximos sete dias.</p>`;
  return `<section class="dashboard-exams"><div class="dashboard-exams__head"><div><span class="eyebrow">PRÓXIMAS PROVAS</span><h3>Na próxima semana</h3></div><span>${icon("exam", 17)}</span></div><div class="dashboard-exams__list">${entries}</div></section>`;
}

export function dashboardView({ record, profile, profiles, nextClass, nextClassChronogram, isNextClassLoading, tasks = [], disciplines = [], lessons = [], exams = [], chronograms = [] }) {
  const name = escapeHtml(firstName(record?.nome));
  const course = escapeHtml(profile?.curso || "seu curso");
  const institution = escapeHtml(profile?.instituicao || "sua instituição");
  const pendingTasks = tasks
    .filter((task) => !task.completa)
    .sort((first, second) => new Date(first.prazo) - new Date(second.prazo))
    .slice(0, 5);
  return `<section class="page dashboard-page">
    <div class="page-heading page-heading--hero">
      <div><span class="eyebrow">VISÃO GERAL</span><h1>Olá, ${name} <span class="wave">✦</span></h1><p>Seu espaço para estudar com mais intenção, ${course} por vez.</p></div>
      <div class="active-profile-summary active-profile-summary--select"><span class="active-profile-summary__icon">${icon("graduation", 19)}</span><div class="active-profile-summary__details"><span>PERFIL ATIVO</span>${profiles.length > 1 ? `<label class="active-profile-summary__select-wrap"><span class="visually-hidden">Selecionar perfil de estudo</span><select data-profile-select aria-label="Selecionar perfil de estudo">${profiles.map((item) => `<option value="${item.id}" ${item.id === profile?.id ? "selected" : ""}>${escapeHtml(item.curso)} · ${item.semestre}º</option>`).join("")}</select></label>` : `<strong>${course}</strong>`}<small>${institution} · ${profile?.semestre}º semestre</small></div></div>
    </div>
    <section class="dashboard-recent">
      <div class="dashboard-section-title"><div><span class="eyebrow">RECENTES</span><h2>Sua rotina agora</h2></div><span class="soft-status">Perfil em foco</span></div>
      <div class="dashboard-recent-grid"><div>${nextClassCard(nextClass, nextClassChronogram, isNextClassLoading)}</div><div class="dashboard-recent-side"><section class="dashboard-tasks"><div class="dashboard-tasks__head"><div><span class="eyebrow">PRÓXIMAS ENTREGAS</span><h3>Tarefas a vencer</h3></div><button class="icon-button" type="button" data-add-dashboard-task aria-label="Adicionar tarefa" ${disciplines.length ? "" : "disabled title=\"Cadastre uma disciplina primeiro\""}>${icon("plus", 18)}</button></div>${taskListMarkup(pendingTasks, disciplines, lessons, { compact: true, emptyMessage: "Nenhuma tarefa pendente no momento." })}</section>${dashboardExams(exams, disciplines, chronograms)}</div></div>
    </section>
    <section class="dashboard-basics"><div class="dashboard-section-title"><div><span class="eyebrow">CADASTROS BÁSICOS</span><h2>Organize sua base</h2></div></div><div class="dashboard-basic-grid">${basicAccess({ action: "teachers", iconName: "users", eyebrow: "PROFESSORES", title: "Professores", description: "Contatos do perfil" })}${basicAccess({ action: "disciplines", iconName: "book", eyebrow: "DISCIPLINAS", title: "Disciplinas", description: "Sua grade de estudo", tone: "dashboard-basic-card--teal" })}${basicAccess({ action: "profiles", iconName: "graduation", eyebrow: "PERFIS", title: "Perfis de estudo", description: "Cursos e semestres", tone: "dashboard-basic-card--olive" })}</div></section>
  </section>`;
}
