import { DASHBOARD_WIDGETS, normalizeSettings } from "../services/settings.js";
import { icon } from "../utils/icons.js";
import { escapeHtml } from "../utils/formatters.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const categories = [
  {
    id: "user",
    title: "Usuário",
    description: "Nome, foto e informações da sua conta.",
    iconName: "userRound",
    terms: "usuario usuário conta perfil nome foto email informações pessoais identidade avatar",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Widgets, favoritos e a ordem da sua rotina.",
    iconName: "dashboard",
    terms: "dashboard painel widgets próxima aula calendario calendário favoritos horários ultimas últimas aulas ordem grade",
  },
  {
    id: "personalization",
    title: "Personalização",
    description: "Escolha a temática e as cores do seu espaço.",
    iconName: "sparkles",
    terms: "personalizacao personalização aparencia aparência tema tematica temática cores paleta palheta floresta chamas cosmic cósmica verde vermelho laranja azul roxo violeta",
  },
];

const settingsSearchEntries = [
  { kind: "Categoria", target: "user", title: "Usuário", description: "Nome, foto, e-mail e identidade da conta.", terms: "usuario usuario conta perfil pessoal identidade dados nome foto avatar email e-mail" },
  { kind: "Configuração do usuário", target: "user", title: "Nome e foto de perfil", description: "Altere como você aparece no AKADEMO.", terms: "nome foto imagem avatar perfil conta usuario usuário" },
  { kind: "Categoria", target: "dashboard", title: "Dashboard", description: "Widgets e organização da rotina.", terms: "dashboard painel inicio inicio home rotina widgets" },
  { kind: "Widget", target: "dashboard", title: "Próxima aula", description: "Exiba ou oculte o seu próximo encontro.", terms: "proxima próxima aula encontro horario horários agenda" },
  { kind: "Widget", target: "dashboard", title: "Calendário acadêmico", description: "Tarefas, provas e apresentações próximas.", terms: "calendario calendário academico acadêmico tarefas provas apresentacoes apresentações compromissos" },
  { kind: "Widget", target: "dashboard", title: "Favoritos", description: "Fixe até quatro módulos no Dashboard.", terms: "favoritos favoritos fixar modulo modulos módulo módulos atalhos acesso rapido rápido" },
  { kind: "Widget", target: "dashboard", title: "Miniatura de horários", description: "Mostre uma versão compacta da grade semanal.", terms: "horario horarios horário horários grade semanal semana aulas" },
  { kind: "Widget", target: "dashboard", title: "Últimas aulas", description: "Abra os quatro registros de aula mais recentes.", terms: "ultimas últimas aulas recentes registros estudo resumo" },
  { kind: "Configuração", target: "dashboard", title: "Ordem dos widgets", description: "Organize a posição dos widgets do Dashboard.", terms: "ordem ordenar posicao posição mover setas widgets grade" },
  { kind: "Categoria", target: "personalization", title: "Personalização", description: "Altere a temática de cores do AKADEMO.", terms: "personalizacao personalização aparencia aparência cores paleta palheta tema tematica temática" },
  { kind: "Temática", target: "personalization", title: "Floresta", description: "A paleta verde original do AKADEMO.", terms: "floresta verde tema tematica temática paleta cores padrao padrão" },
  { kind: "Temática", target: "personalization", title: "Chamas", description: "Tons equilibrados de vermelho e laranja.", terms: "chamas vermelho laranja quente tema tematica temática paleta cores" },
  { kind: "Temática", target: "personalization", title: "Cosmic", description: "Azuis profundos e roxos luminosos com alto contraste.", terms: "cosmic cósmica azul azul escuro roxo roxo escuro violeta indigo índigo tema tematica temática paleta cores" },
];

const favoriteModules = [
  ["schedules", "Horários", "calendar"],
  ["lessons", "Aulas", "book"],
  ["chronogram", "Cronograma", "file"],
  ["tasks", "Tarefas", "check"],
  ["exams", "Provas", "exam"],
  ["presentations", "Apresentações", "presentation"],
  ["files", "Arquivos", "folder"],
  ["mindmaps", "Mapas mentais", "mindMap"],
  ["notes", "Anotações", "note"],
  ["glossary", "Glossário", "glossary"],
  ["videos", "Vídeos", "video"],
  ["disciplines", "Disciplinas", "book"],
  ["teachers", "Professores", "users"],
  ["profiles", "Perfis de estudo", "graduation"],
];

function normalizeSearch(value) {
  const raw = String(value || "");
  let repaired = raw;
  try { repaired = decodeURIComponent(escape(raw)); } catch { /* texto já está em UTF-8 */ }
  return repaired
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function categoryCard(category) {
  const searchable = `${category.title} ${category.description} ${category.terms}`;
  return `<button class="settings-category-card" type="button" data-settings-category="${category.id}" data-settings-search="${escapeHtml(searchable)}"><span>${icon(category.iconName, 25)}</span><div><strong>${escapeHtml(category.title)}</strong><p>${escapeHtml(category.description)}</p></div>${icon("arrowRight", 17)}</button>`;
}

function searchResult(entry) {
  const iconName = entry.target === "dashboard" ? "dashboard" : entry.target === "personalization" ? "sparkles" : "userRound";
  return `<button class="settings-search-result" type="button" data-settings-result="${entry.target}"><span>${icon(iconName, 18)}</span><div><small>${escapeHtml(entry.kind)}</small><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.description)}</p></div>${icon("arrowRight", 16)}</button>`;
}

export function settingsCatalogView() {
  return `<section class="page settings-catalog-page">
    <button class="back-link" type="button" data-settings-back>${icon("arrowLeft", 18)} Voltar</button>
    <label class="settings-search" for="settings-search"><span>${icon("search", 19)}</span><input id="settings-search" type="search" autocomplete="off" placeholder="Buscar por configurações, widgets, foto..." data-settings-catalog-search /><button type="button" data-clear-settings-search aria-label="Limpar pesquisa">${icon("close", 16)}</button></label>
    <div class="settings-categories-grid" data-settings-categories>${categories.map(categoryCard).join("")}</div>
    <section class="settings-search-results" hidden data-settings-results></section>
    <section class="settings-search-empty" hidden data-settings-search-empty><span>${icon("search", 25)}</span><h2>Nenhuma configuração encontrada</h2><p>Tente termos como “foto”, “widgets”, “calendário” ou “horários”.</p></section>
  </section>`;
}

function dashboardWidgetCard(widget, index, widgets) {
  const enabled = Boolean(widget.enabled);
  const metadata = DASHBOARD_WIDGETS.find((item) => item.id === widget.id);
  const enabledWidgets = widgets.filter((item) => item.enabled);
  const enabledPosition = enabledWidgets.findIndex((item) => item.id === widget.id);
  const canMoveUp = enabled && enabledPosition > 0;
  const canMoveDown = enabled && enabledPosition < enabledWidgets.length - 1;
  return `<article class="dashboard-widget-setting ${enabled ? "is-enabled" : ""}">
    <span class="dashboard-widget-setting__icon">${icon(widget.id === "next-class" ? "calendar" : widget.id === "academic-calendar" ? "organize" : widget.id === "favorites" ? "sparkles" : widget.id === "schedules" ? "calendar" : "book", 20)}</span>
    <div class="dashboard-widget-setting__copy"><strong>${escapeHtml(metadata?.label || "Widget")}</strong><p>${escapeHtml(metadata?.description || "")}</p></div>
    <div class="dashboard-widget-setting__actions"><label class="switch" title="${enabled ? "Desativar" : "Ativar"}"><input type="checkbox" data-dashboard-widget-toggle="${escapeHtml(widget.id)}" ${enabled ? "checked" : ""}/><i></i></label>${widget.id === "favorites" && enabled ? `<button class="icon-button dashboard-widget-setting__configure" type="button" data-configure-dashboard-favorites aria-label="Configurar módulos favoritos">${icon("settings", 16)}</button>` : ""}<div class="dashboard-widget-setting__order"><button class="icon-button" type="button" data-dashboard-widget-move="up" data-dashboard-widget-id="${escapeHtml(widget.id)}" aria-label="Mover para cima" ${canMoveUp ? "" : "disabled"}>${icon("arrowLeft", 15)}</button><button class="icon-button" type="button" data-dashboard-widget-move="down" data-dashboard-widget-id="${escapeHtml(widget.id)}" aria-label="Mover para baixo" ${canMoveDown ? "" : "disabled"}>${icon("arrowRight", 15)}</button></div></div>
  </article>`;
}

function favoritePicker(selected) {
  return "";
  return `<section class="dashboard-favorite-picker"><div><strong>Módulos fixados</strong><small>Escolha até 4 atalhos para o widget Favoritos.</small></div><div class="dashboard-favorite-picker__options">${favoriteModules.map(([id, label, iconName]) => `<label class="dashboard-favorite-option ${selected.includes(id) ? "is-selected" : ""}"><input type="checkbox" value="${id}" data-dashboard-favorite ${selected.includes(id) ? "checked" : ""}/><span>${icon(iconName, 16)}</span>${label}</label>`).join("")}</div></section>`;
}

function favoriteEditorModal(selected) {
  return `<div class="modal-backdrop" data-favorite-editor-backdrop><section class="modal modal--favorites-editor" role="dialog" aria-modal="true" aria-labelledby="favorite-editor-title"><form class="favorites-editor" data-favorite-editor-form><div class="favorites-editor__head"><div><span class="eyebrow">DASHBOARD</span><h2 id="favorite-editor-title">Módulos favoritos</h2><p>Escolha até quatro módulos para aparecerem no widget Favoritos.</p></div><button class="icon-button" type="button" data-close-favorite-editor aria-label="Fechar">${icon("close", 19)}</button></div><div class="favorites-editor__grid">${favoriteModules.map(([id, label, iconName]) => `<label class="favorites-editor__option ${selected.includes(id) ? "is-selected" : ""}"><input type="checkbox" value="${id}" ${selected.includes(id) ? "checked" : ""}/><span>${icon(iconName, 17)}</span><strong>${escapeHtml(label)}</strong></label>`).join("")}</div><div class="favorites-editor__actions"><small data-favorite-count>${selected.length}/4 selecionados</small><span></span><button class="button button--ghost" type="button" data-close-favorite-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("check", 16)} Aplicar favoritos</button></div></form></section></div>`;
}

function openFavoriteEditor(selected, onApply) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = favoriteEditorModal(selected);
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };
  const selectedIds = () => [...modalRoot.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  const refresh = () => {
    const ids = selectedIds();
    modalRoot.querySelector("[data-favorite-count]").textContent = `${ids.length}/4 selecionados`;
    modalRoot.querySelectorAll(".favorites-editor__option").forEach((option) => option.classList.toggle("is-selected", option.querySelector("input").checked));
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-favorite-editor]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-favorite-editor-backdrop]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });
  modalRoot.querySelectorAll('input[type="checkbox"]').forEach((input) => input.addEventListener("change", () => {
    if (selectedIds().length > 4) {
      input.checked = false;
      showToast("Escolha no máximo quatro módulos favoritos.", "error");
    }
    refresh();
  }));
  modalRoot.querySelector("[data-favorite-editor-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    onApply(selectedIds());
    close();
  });
}

export function dashboardSettingsView({ settings }) {
  const normalized = normalizeSettings(settings);
  return `<section class="page dashboard-settings-page">
    <button class="back-link" type="button" data-dashboard-settings-back>${icon("arrowLeft", 18)} Configurações</button>
    <form data-dashboard-settings-form>
      <section class="settings-control-section"><header><div><span class="section-icon">${icon("dashboard", 20)}</span><div><h2>Widgets</h2><p>Os widgets ativados são distribuídos em uma grade que se adapta a qualquer tela.</p></div></div><small>Use as setas para mudar a ordem.</small></header><div class="dashboard-widget-settings-list">${normalized.dashboard.widgets.map((widget, index, widgets) => dashboardWidgetCard(widget, index, widgets)).join("")}</div>${favoritePicker(normalized.dashboard.favorites)}</section>
      <div class="settings-save-bar"><span>${icon("info", 16)} A visualização do Dashboard será atualizada ao salvar.</span><button class="button button--primary" type="submit">${icon("save", 17)} Salvar configurações</button></div>
    </form>
  </section>`;
}

function paletteChoice({ id, name, description, selected, swatches }) {
  return `<label class="palette-choice ${selected ? "is-selected" : ""}">
    <input type="radio" name="system-palette" value="${id}" data-palette-choice ${selected ? "checked" : ""}/>
    <span class="palette-choice__preview palette-choice__preview--${id}">${swatches.map((swatch) => `<i style="--palette-swatch:${swatch}"></i>`).join("")}</span>
    <span class="palette-choice__copy"><strong>${name}</strong><small>${description}</small></span>
    <span class="palette-choice__check">${icon("check", 16)}</span>
  </label>`;
}

export function personalizationView({ settings }) {
  const normalized = normalizeSettings(settings);
  const palette = normalized.appearance.palette;
  return `<section class="page personalization-settings-page">
    <button class="back-link" type="button" data-personalization-back>${icon("arrowLeft", 18)} Configurações</button>
    <form data-personalization-form>
      <section class="settings-control-section personalization-section">
        <header><div><span class="section-icon">${icon("sparkles", 20)}</span><div><h2>Temática do sistema</h2><p>Escolha uma paleta que acompanha os modos claro e escuro sem perder contraste.</p></div></div></header>
        <div class="palette-choice-grid" role="radiogroup" aria-label="Escolher temática do sistema">
          ${paletteChoice({ id: "forest", name: "Floresta", description: "A identidade verde original do AKADEMO.", selected: palette === "forest", swatches: ["#006333", "#00bb5b", "#4bd39b", "#9ed33e"] })}
          ${paletteChoice({ id: "flames", name: "Chamas", description: "Vermelho e laranja equilibrados e confortáveis.", selected: palette === "flames", swatches: ["#7d2f21", "#c95638", "#d98245", "#b5672a"] })}
          ${paletteChoice({ id: "cosmic", name: "Cosmic", description: "Azul profundo e roxo com uma atmosfera cósmica e legível.", selected: palette === "cosmic", swatches: ["#252852", "#3f4f9c", "#6859cb", "#a694ee"] })}
        </div>
      </section>
      <div class="settings-save-bar"><span>${icon("info", 16)} A temática será aplicada em todo o seu espaço.</span><button class="button button--primary" type="submit">${icon("save", 17)} Salvar personalização</button></div>
    </form>
  </section>`;
}

export function bindSettingsCatalog(root, { onBack, onOpen }) {
  const input = root.querySelector("[data-settings-catalog-search]");
  const grid = root.querySelector("[data-settings-categories]");
  const results = root.querySelector("[data-settings-results]");
  const empty = root.querySelector("[data-settings-search-empty]");
  const aliases = {
    configuracao: ["configuracao", "configuracoes", "preferencias"],
    configuracoes: ["configuracao", "configuracoes", "preferencias"],
    widget: ["widget", "widgets", "painel", "dashboard"],
    widgets: ["widget", "widgets", "painel", "dashboard"],
    aula: ["aula", "aulas", "proxima", "ultimas", "horario"],
    aulas: ["aula", "aulas", "proxima", "ultimas", "horario"],
    horario: ["horario", "horarios", "grade", "semanal"],
    horarios: ["horario", "horarios", "grade", "semanal"],
    calendario: ["calendario", "academico", "compromissos"],
    conta: ["conta", "usuario", "usuario", "perfil", "nome", "foto"],
    usuario: ["usuario", "usuario", "conta", "perfil", "nome", "foto"],
    foto: ["foto", "avatar", "imagem", "perfil"],
  };
  const entryMatches = (entry, terms) => {
    const searchable = normalizeSearch(`${entry.title} ${entry.description} ${entry.terms}`);
    return terms.every((term) => {
      const variants = aliases[term] || [term];
      return variants.some((variant) => searchable.includes(variant) || searchable.split(/\s+/).some((word) => word.startsWith(variant)));
    });
  };
  const applySearch = () => {
    const terms = normalizeSearch(input?.value).split(/\s+/).filter(Boolean);
    const hasQuery = terms.length > 0;
    const matches = hasQuery ? settingsSearchEntries.filter((entry) => entryMatches(entry, terms)) : [];
    grid.hidden = hasQuery;
    results.hidden = !hasQuery || !matches.length;
    if (hasQuery && matches.length) results.innerHTML = matches.map(searchResult).join("");
    empty.hidden = !hasQuery || matches.length > 0;
    results.querySelectorAll("[data-settings-result]").forEach((button) => button.addEventListener("click", () => onOpen(button.dataset.settingsResult)));
  };
  root.querySelector("[data-settings-back]")?.addEventListener("click", onBack);
  input?.addEventListener("input", applySearch);
  root.querySelector("[data-clear-settings-search]")?.addEventListener("click", () => {
    if (!input) return;
    input.value = "";
    input.focus();
    applySearch();
  });
  root.querySelectorAll("[data-settings-category]").forEach((card) => {
    card.addEventListener("click", () => onOpen(card.dataset.settingsCategory));
  });
}

export function bindDashboardSettings(root, { settings, onBack, onChange, onSave }) {
  const form = root.querySelector("[data-dashboard-settings-form]");
  const update = (mutate) => {
    const next = normalizeSettings(settings);
    mutate(next.dashboard);
    onChange(normalizeSettings(next));
  };
  root.querySelector("[data-dashboard-settings-back]")?.addEventListener("click", onBack);
  root.querySelectorAll("[data-dashboard-widget-toggle]").forEach((input) => input.addEventListener("change", () => {
    update((dashboard) => {
      const widget = dashboard.widgets.find((item) => item.id === input.dataset.dashboardWidgetToggle);
      if (widget) widget.enabled = input.checked;
    });
  }));
  root.querySelector("[data-configure-dashboard-favorites]")?.addEventListener("click", () => {
    openFavoriteEditor(settings.dashboard?.favorites || [], (favorites) => {
      update((dashboard) => { dashboard.favorites = favorites; });
    });
  });
  root.querySelectorAll("[data-dashboard-widget-move]").forEach((button) => button.addEventListener("click", () => {
    if (button.disabled) return;
    update((dashboard) => {
      const enabledIndexes = dashboard.widgets
        .map((widget, index) => widget.enabled ? index : -1)
        .filter((index) => index >= 0);
      const currentIndex = dashboard.widgets.findIndex((widget) => widget.id === button.dataset.dashboardWidgetId);
      const position = enabledIndexes.indexOf(currentIndex);
      const targetPosition = button.dataset.dashboardWidgetMove === "up" ? position - 1 : position + 1;
      const targetIndex = enabledIndexes[targetPosition];
      if (targetIndex === undefined) return;
      [dashboard.widgets[currentIndex], dashboard.widgets[targetIndex]] = [dashboard.widgets[targetIndex], dashboard.widgets[currentIndex]];
    });
  }));
  root.querySelectorAll("[data-dashboard-favorite]").forEach((input) => input.addEventListener("change", () => {
    const selected = [...root.querySelectorAll("[data-dashboard-favorite]:checked")].map((item) => item.value);
    if (selected.length > 4) {
      input.checked = false;
      showToast("Escolha no máximo quatro módulos favoritos.", "error");
      return;
    }
    update((dashboard) => { dashboard.favorites = selected; });
  }));
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      await onSave(normalizeSettings(settings));
      setButtonLoading(button, false);
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar as configurações.", "error");
    }
  });
}

export function bindPersonalization(root, { settings, onBack, onChange, onSave }) {
  const form = root.querySelector("[data-personalization-form]");
  root.querySelector("[data-personalization-back]")?.addEventListener("click", onBack);
  root.querySelectorAll("[data-palette-choice]").forEach((input) => input.addEventListener("change", () => {
    if (!input.checked) return;
    const next = normalizeSettings(settings);
    next.appearance.palette = input.value;
    onChange(normalizeSettings(next));
  }));
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      await onSave(normalizeSettings(settings));
      setButtonLoading(button, false);
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar a personalização.", "error");
    }
  });
}
