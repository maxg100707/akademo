import { icon } from "../utils/icons.js";
import { escapeHtml, firstName } from "../utils/formatters.js";

export function dashboardView({ record, profile, profiles }) {
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
  </section>`;
}
