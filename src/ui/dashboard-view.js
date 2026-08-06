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

export function dashboardView({ record, profile, profiles, nextClass, nextClassChronogram, isNextClassLoading }) {
  const name = escapeHtml(firstName(record?.nome));
  const course = escapeHtml(profile?.curso || "seu curso");
  const institution = escapeHtml(profile?.instituicao || "sua instituição");
  return `<section class="page dashboard-page">
    <div class="page-heading page-heading--hero">
      <div><span class="eyebrow">VISÃO GERAL</span><h1>Olá, ${name} <span class="wave">✦</span></h1><p>Seu espaço para estudar com mais intenção, ${course} por vez.</p>
      </div>
      <div class="active-profile-summary active-profile-summary--select"><span class="active-profile-summary__icon">${icon("graduation", 19)}</span><div class="active-profile-summary__details"><span>PERFIL ATIVO</span>${profiles.length > 1 ? `<label class="active-profile-summary__select-wrap"><span class="visually-hidden">Selecionar perfil de estudo</span><select data-profile-select aria-label="Selecionar perfil de estudo">${profiles.map((item) => `<option value="${item.id}" ${item.id === profile?.id ? "selected" : ""}>${escapeHtml(item.curso)} · ${item.semestre}º</option>`).join("")}</select></label>` : `<strong>${course}</strong>`}<small>${institution} · ${profile?.semestre}º semestre</small></div></div>
    </div>
    <button class="dashboard-teachers-link" data-open-teachers><span class="dashboard-teachers-link__icon">${icon("users", 21)}</span><span><small>PROFESSORES</small><strong>Organize os contatos do seu perfil</strong><em>Acessar ${icon("arrowRight", 17)}</em></span></button>
    <button class="dashboard-teachers-link dashboard-disciplines-link" data-open-disciplines><span class="dashboard-teachers-link__icon">${icon("book", 21)}</span><span><small>DISCIPLINAS</small><strong>Monte a grade do seu perfil</strong><em>Acessar ${icon("arrowRight", 17)}</em></span></button>
    ${nextClassCard(nextClass, nextClassChronogram, isNextClassLoading)}
  </section>`;
}
