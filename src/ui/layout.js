import { icon } from "../utils/icons.js";
import { escapeHtml } from "../utils/formatters.js";
import { avatar } from "./components.js";

export function renderLayout(root, { record, photoUrl, profiles, currentProfile, view, content, collapsed, theme }) {
  const course = escapeHtml(currentProfile?.curso || "Perfil de estudo");
  root.innerHTML = `<div class="app-shell ${collapsed ? "sidebar-collapsed" : ""}" data-theme="${theme}">
    <aside class="sidebar" aria-label="Menu principal">
      <div class="sidebar__top"><a href="#" class="brand"><img class="brand-icon" src="icon.png" alt=""/><span class="brand__text">AKADEMO</span></a><button class="collapse-button" data-collapse aria-label="${collapsed ? "Expandir menu" : "Recolher menu"}">${icon(collapsed ? "arrowRight" : "arrowLeft", 16)}</button></div>
      <div class="sidebar__profile-wrap">
        <button class="sidebar-profile" data-profile-menu aria-expanded="false">${avatar(record, photoUrl, "sidebar-profile__avatar")}<span class="sidebar-profile__details"><strong>${escapeHtml(record?.nome || "Estudante")}</strong><small>${course}</small></span>${icon("chevronDown", 16)}</button>
        <div class="profile-popover" data-profile-popover>
          <div class="profile-popover__head">${avatar(record, photoUrl, "profile-popover__avatar")}<div><strong>${escapeHtml(record?.nome || "Estudante")}</strong><small>${escapeHtml(record?.email || "")}</small></div></div>
          <button data-personal>${icon("info", 18)}<span>Informações</span></button>
          <button data-profiles>${icon("graduation", 18)}<span>Perfis de estudo</span></button>
          <button data-teachers>${icon("users", 18)}<span>Professores</span></button>
          <button data-disciplines>${icon("book", 18)}<span>Disciplinas</span></button>
          <div class="theme-control"><span>${icon("moon", 18)} Tema escuro</span><label class="switch"><input type="checkbox" data-theme-toggle ${theme === "dark" ? "checked" : ""}/><i></i></label></div>
          <button class="profile-popover__logout" data-logout>${icon("logout", 18)}<span>Sair da conta</span></button>
        </div>
      </div>
      <nav class="sidebar-nav"><span class="sidebar-nav__label">MENU</span><button class="nav-item ${view === "dashboard" ? "is-active" : ""}" data-nav="dashboard">${icon("dashboard", 20)}<span>Dashboard</span></button><button class="nav-item ${view === "schedules" ? "is-active" : ""}" data-nav="schedules">${icon("calendar", 20)}<span>Horários</span></button><button class="nav-item ${view === "lessons" || view.startsWith("lesson-") ? "is-active" : ""}" data-nav="lessons">${icon("book", 20)}<span>Aulas</span></button><button class="nav-item ${view === "tasks" ? "is-active" : ""}" data-nav="tasks">${icon("check", 20)}<span>Tarefas</span></button><button class="nav-item ${view === "exams" || view.startsWith("exam-") ? "is-active" : ""}" data-nav="exams">${icon("exam", 20)}<span>Provas</span></button><button class="nav-item ${view === "presentations" || view.startsWith("presentation-") ? "is-active" : ""}" data-nav="presentations">${icon("presentation", 20)}<span>Apresentações</span></button><button class="nav-item ${view === "chronogram" ? "is-active" : ""}" data-nav="chronogram">${icon("file", 20)}<span>Cronograma</span></button></nav>
      <div class="sidebar__bottom"><button class="mobile-close-menu" data-mobile-close>${icon("close", 18)}<span>Fechar menu</span></button><div class="sidebar__tip">${icon("sparkles", 18)}<span>Faça hoje valer a pena.</span></div></div>
    </aside>
    <div class="mobile-menu-overlay" data-mobile-close></div>
    <main class="main-area"><header class="mobile-topbar"><a href="#" class="mobile-brand"><img class="brand-icon" src="icon.png" alt=""/> AKADEMO</a><div class="mobile-profile-indicator" title="${course}"><span>${icon("graduation", 16)}</span><div>${profiles.length > 1 ? `<small>PERFIL ATIVO</small><select data-profile-select aria-label="Selecionar perfil de estudo">${profiles.map((profile) => `<option value="${profile.id}" ${profile.id === currentProfile?.id ? "selected" : ""}>${escapeHtml(profile.curso)}</option>`).join("")}</select>` : `<strong>${course}</strong><small>${currentProfile?.semestre}º semestre</small>`}</div></div></header>${content}</main>
    <button class="floating-menu-button" data-mobile-open aria-label="Abrir menu">${icon("bars", 22)}</button>
  </div>`;
}

export function bindLayout(root, actions) {
  root.querySelector("[data-collapse]")?.addEventListener("click", actions.onCollapse);
  root.querySelectorAll("[data-mobile-open]").forEach((button) => button.addEventListener("click", () => root.querySelector(".app-shell").classList.add("mobile-menu-open")));
  root.querySelectorAll("[data-mobile-close]").forEach((button) => button.addEventListener("click", () => root.querySelector(".app-shell").classList.remove("mobile-menu-open")));
  const profileMenu = root.querySelector("[data-profile-menu]");
  const profileWrapper = root.querySelector(".sidebar__profile-wrap");
  const closeProfileMenu = () => {
    profileWrapper?.classList.remove("is-open");
    profileMenu?.setAttribute("aria-expanded", "false");
  };

  profileMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = profileWrapper?.classList.toggle("is-open");
    profileMenu.setAttribute("aria-expanded", String(Boolean(isOpen)));
  });
  root.querySelector("[data-personal]").addEventListener("click", actions.onPersonal);
  root.querySelector("[data-profiles]").addEventListener("click", actions.onProfiles);
  root.querySelector("[data-teachers]").addEventListener("click", actions.onTeachers);
  root.querySelector("[data-disciplines]").addEventListener("click", actions.onDisciplines);
  root.querySelector("[data-logout]").addEventListener("click", actions.onLogout);
  root.querySelector("[data-theme-toggle]").addEventListener("change", actions.onTheme);
  root.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => actions.onNavigate(button.dataset.nav)));
  root.querySelectorAll("[data-profile-select]").forEach((select) => select.addEventListener("change", (event) => actions.onProfileChange(event.target.value)));
  if (root.profileOutsideClickHandler) document.removeEventListener("click", root.profileOutsideClickHandler);
  root.profileOutsideClickHandler = (event) => {
    if (profileWrapper && !profileWrapper.contains(event.target)) closeProfileMenu();
  };
  document.addEventListener("click", root.profileOutsideClickHandler);
}
