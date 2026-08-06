import { icon } from "../utils/icons.js";
import { escapeHtml, firstName } from "../utils/formatters.js";
import { displayTime, weekdayName } from "../services/schedules.js";

function nextClassCard(nextClass, nextClassChronogram, isLoading) {
  if (isLoading) return `<section class="next-class-card is-loading"><span class="next-class-card__icon"><span class="spinner"></span></span><div><small>PR\u00d3XIMA AULA</small><strong>Organizando sua rotina...</strong><p>Estamos buscando os hor\u00e1rios deste perfil.</p></div></section>`;
  if (!nextClass) return `<button class="next-class-card" data-open-schedules><span class="next-class-card__icon">${icon("calendar", 22)}</span><div><small>PR\u00d3XIMA AULA</small><strong>Nenhuma aula programada</strong><p>Monte sua grade semanal para acompanhar o pr\u00f3ximo compromisso.</p></div><em>${icon("arrowRight", 18)}</em></button>`;
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(nextClass.start).replace(".", "");
  const discipline = escapeHtml(nextClass.discipline?.nome_disciplina || "Disciplina");
  const teacher = escapeHtml(nextClass.teacher?.nome_professor || "Professor n\u00e3o informado");
  const topic = String(nextClassChronogram?.tema || "").trim();
  const status = nextClass.isLive ? "Acontecendo agora" : "Pr\u00f3xima aula";
  const statusClass = nextClass.isLive ? "is-live" : "is-upcoming";
  return `<button class="next-class-card ${statusClass}" data-open-next-class><span class="next-class-card__icon">${icon("calendar", 22)}</span><div class="next-class-card__content"><span class="next-class-card__status"><i></i>${status}</span><strong>${discipline}</strong><p>${weekdayName(nextClass.schedule.dia_semana)}, ${date} \u00b7 ${displayTime(nextClass.schedule.hora_inicio)}\u2013${displayTime(nextClass.schedule.hora_fim)}</p>${topic ? `<small class="next-class-card__topic">${icon("book", 13)} Tema: ${escapeHtml(topic)}</small>` : ""}<small>${icon("userRound", 13)} ${teacher}</small></div><em>${icon("arrowRight", 18)}</em></button>`;
}

function basicAccess({ action, iconName, eyebrow, title, description, tone = "" }) {
  return `<button class="dashboard-basic-card ${tone}" data-open-${action}><span>${icon(iconName, 20)}</span><div><small>${eyebrow}</small><strong>${title}</strong><p>${description}</p></div>${icon("arrowRight", 17)}</button>`;
}

export function dashboardView({ record, profile, profiles, nextClass, nextClassChronogram, isNextClassLoading }) {
  const name = escapeHtml(firstName(record?.nome));
  const course = escapeHtml(profile?.curso || "seu curso");
  const institution = escapeHtml(profile?.instituicao || "sua institui\u00e7\u00e3o");
  return `<section class="page dashboard-page">
    <div class="page-heading page-heading--hero">
      <div><span class="eyebrow">VIS\u00c3O GERAL</span><h1>Ol\u00e1, ${name} <span class="wave">\u2726</span></h1><p>Seu espa\u00e7o para estudar com mais inten\u00e7\u00e3o, ${course} por vez.</p></div>
      <div class="active-profile-summary active-profile-summary--select"><span class="active-profile-summary__icon">${icon("graduation", 19)}</span><div class="active-profile-summary__details"><span>PERFIL ATIVO</span>${profiles.length > 1 ? `<label class="active-profile-summary__select-wrap"><span class="visually-hidden">Selecionar perfil de estudo</span><select data-profile-select aria-label="Selecionar perfil de estudo">${profiles.map((item) => `<option value="${item.id}" ${item.id === profile?.id ? "selected" : ""}>${escapeHtml(item.curso)} \u00b7 ${item.semestre}\u00ba</option>`).join("")}</select></label>` : `<strong>${course}</strong>`}<small>${institution} \u00b7 ${profile?.semestre}\u00ba semestre</small></div></div>
    </div>
    <section class="dashboard-recent"><div class="dashboard-section-title"><div><span class="eyebrow">RECENTES</span><h2>Sua rotina agora</h2></div><span class="soft-status">Perfil em foco</span></div>${nextClassCard(nextClass, nextClassChronogram, isNextClassLoading)}</section>
    <section class="dashboard-basics"><div class="dashboard-section-title"><div><span class="eyebrow">CADASTROS B\u00c1SICOS</span><h2>Organize sua base</h2></div></div><div class="dashboard-basic-grid">${basicAccess({ action: "teachers", iconName: "users", eyebrow: "PROFESSORES", title: "Professores", description: "Contatos do perfil" })}${basicAccess({ action: "disciplines", iconName: "book", eyebrow: "DISCIPLINAS", title: "Disciplinas", description: "Sua grade de estudo", tone: "dashboard-basic-card--teal" })}${basicAccess({ action: "profiles", iconName: "graduation", eyebrow: "PERFIS", title: "Perfis de estudo", description: "Cursos e semestres", tone: "dashboard-basic-card--olive" })}</div></section>
  </section>`;
}
