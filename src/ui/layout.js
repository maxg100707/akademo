import { icon } from "../utils/icons.js";
import { escapeHtml } from "../utils/formatters.js";
import { avatar } from "./components.js";

const basicRegistrationModules = [
  { view: "profiles", iconName: "graduation", label: "Perfis de estudo", isActive: (currentView) => currentView === "profiles" },
  { view: "disciplines", iconName: "book", label: "Disciplinas", isActive: (currentView) => currentView === "disciplines" },
  { view: "teachers", iconName: "users", label: "Professores", isActive: (currentView) => currentView === "teachers" },
];

const organizationModules = [
  { view: "schedules", iconName: "calendar", label: "Hor&aacute;rios", isActive: (currentView) => currentView === "schedules" },
  { view: "lessons", iconName: "book", label: "Aulas", isActive: (currentView) => currentView === "lessons" || currentView.startsWith("lesson-") },
  { view: "files", iconName: "folder", label: "Arquivos", isActive: (currentView) => currentView === "files" },
  { view: "tasks", iconName: "check", label: "Tarefas", isActive: (currentView) => currentView === "tasks" },
  { view: "exams", iconName: "exam", label: "Provas", isActive: (currentView) => currentView === "exams" || currentView.startsWith("exam-") },
  { view: "presentations", iconName: "presentation", label: "Apresenta&ccedil;&otilde;es", isActive: (currentView) => currentView === "presentations" || currentView.startsWith("presentation-") },
  { view: "chronogram", iconName: "file", label: "Cronograma", isActive: (currentView) => currentView === "chronogram" },
];

const contentModules = [
  { view: "mindmaps", iconName: "mindMap", label: "Mapas mentais", isActive: (currentView) => currentView === "mindmaps" || currentView === "mindmap-editor" },
];

const moduleContexts = {
  dashboard: { iconName: "dashboard", title: "Dashboard", description: "Acompanhe sua rotina acadêmica em um só lugar." },
  profiles: { iconName: "graduation", title: "Perfis de estudo", description: "Organize cada etapa da sua jornada acadêmica." },
  personal: { iconName: "info", title: "Informações pessoais", description: "Mantenha os dados da sua conta atualizados." },
  disciplines: { iconName: "book", title: "Disciplinas", description: "Organize as disciplinas do seu perfil de estudo." },
  teachers: { iconName: "users", title: "Professores", description: "Centralize os contatos do seu corpo docente." },
  schedules: { iconName: "calendar", title: "Horários", description: "Visualize e organize as aulas da sua semana." },
  chronogram: { iconName: "file", title: "Cronograma", description: "Planeje os temas e situações de cada aula." },
  tasks: { iconName: "check", title: "Tarefas", description: "Acompanhe prazos e priorize suas entregas." },
  files: { iconName: "folder", title: "Arquivos", description: "Encontre e organize todos os seus materiais." },
  lessons: { iconName: "book", title: "Aulas", description: "Selecione uma aula para registrar o que foi estudado e guardar seus conteúdos." },
  exams: { iconName: "exam", title: "Provas", description: "Planeje suas avaliações e materiais de revisão." },
  presentations: { iconName: "presentation", title: "Apresentações", description: "Prepare orientações, materiais e referências." },
  mindmaps: { iconName: "mindMap", title: "Mapas mentais", description: "Conecte ideias e desenvolva seus estudos visualmente." },
};

function contextForView(view) {
  if (view?.startsWith("lesson-")) return moduleContexts.lessons;
  if (view?.startsWith("exam-")) return moduleContexts.exams;
  if (view?.startsWith("presentation-")) return moduleContexts.presentations;
  if (view === "mindmap-editor") return moduleContexts.mindmaps;
  return moduleContexts[view] || moduleContexts.dashboard;
}

function moduleContext(context, className) {
  return `<div class="${className}"><span>${icon(context.iconName, 17)}</span><div><strong>${escapeHtml(context.title)}</strong><p>${escapeHtml(context.description)}</p></div></div>`;
}

function navigationGroup({ view, key, label, iconName, modules, isExpanded }) {
  const hasActiveModule = modules.some((module) => module.isActive(view));
  const items = modules.map((module) => `<button class="nav-item ${module.isActive(view) ? "is-active" : ""}" data-nav="${module.view}">${icon(module.iconName, 19)}<span>${module.label}</span></button>`).join("");
  const contentId = `menu-group-${key}`;
  return `<section class="nav-group ${isExpanded ? "is-expanded" : ""} ${hasActiveModule ? "has-active" : ""}" aria-label="${label}"><button class="nav-group__trigger" type="button" data-menu-group-toggle="${key}" aria-expanded="${isExpanded}" aria-controls="${contentId}"><span class="nav-group__icon">${icon(iconName, 18)}</span><span class="nav-group__copy"><strong>${label}</strong></span>${icon("chevronDown", 17)}</button><div class="nav-group__items" id="${contentId}">${items}</div></section>`;
}

export function renderLayout(root, { record, photoUrl, profiles, currentProfile, view, content, theme, basicRegistrationExpanded = false, organizationExpanded = false, contentExpanded = false }) {
  const course = escapeHtml(currentProfile?.curso || "Perfil de estudo");
  const currentContext = contextForView(view);
  root.innerHTML = `<div class="app-shell" data-theme="${theme}">
    <aside class="sidebar" aria-label="Menu principal">
      <div class="sidebar__top"><a href="#" class="brand"><img class="brand-icon" src="icon.png" alt=""/><span class="brand__text">AKADEMO</span></a></div>
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
      <nav class="sidebar-nav"><span class="sidebar-nav__label">MENU</span><button class="nav-item ${view === "dashboard" ? "is-active" : ""}" data-nav="dashboard">${icon("dashboard", 20)}<span>Dashboard</span></button>${navigationGroup({ view, key: "basic", label: "Cadastros B&aacute;sicos", iconName: "idCard", modules: basicRegistrationModules, isExpanded: basicRegistrationExpanded })}${navigationGroup({ view, key: "organization", label: "Organiza&ccedil;&atilde;o B&aacute;sica", iconName: "organize", modules: organizationModules, isExpanded: organizationExpanded })}${navigationGroup({ view, key: "content", label: "Conte&uacute;dos", iconName: "mindMap", modules: contentModules, isExpanded: contentExpanded })}</nav>
      <div class="sidebar__bottom"><button class="mobile-close-menu" data-mobile-close>${icon("close", 18)}<span>Fechar menu</span></button><div class="sidebar__tip">${icon("sparkles", 18)}<span>Faça hoje valer a pena.</span></div></div>
    </aside>
    <div class="mobile-menu-overlay" data-mobile-close></div>
    <main class="main-area"><header class="mobile-topbar"><button class="mobile-menu-button" data-mobile-open aria-label="Abrir menu">${icon("bars", 20)}</button><a href="#" class="mobile-brand"><img class="brand-icon" src="icon.png" alt=""/> AKADEMO</a><div class="mobile-profile-indicator" title="${course}"><span>${icon("graduation", 16)}</span><div>${profiles.length > 1 ? `<small>PERFIL ATIVO</small><select data-profile-select aria-label="Selecionar perfil de estudo">${profiles.map((profile) => `<option value="${profile.id}" ${profile.id === currentProfile?.id ? "selected" : ""}>${escapeHtml(profile.curso)}</option>`).join("")}</select>` : `<strong>${course}</strong><small>${currentProfile?.semestre}º semestre</small>`}</div></div></header>${content}</main>
  </div>`;
  root.querySelector(".mobile-brand")?.insertAdjacentHTML("afterend", moduleContext(currentContext, "mobile-module-context"));
  root.querySelector(".main-area").insertAdjacentHTML("afterbegin", `
    <header class="desktop-topbar">
      <div class="desktop-header-content">
      ${moduleContext(currentContext, "desktop-module-context")}
      <div class="desktop-profile-indicator" title="${course}">
        <span>${icon("graduation", 16)}</span>
        <div>${profiles.length > 1 ? `<small>PERFIL ATIVO</small><select data-profile-select aria-label="Selecionar perfil de estudo">${profiles.map((profile) => `<option value="${profile.id}" ${profile.id === currentProfile?.id ? "selected" : ""}>${escapeHtml(profile.curso)}</option>`).join("")}</select>` : `<strong>${course}</strong><small>${currentProfile?.semestre}º semestre</small>`}</div>
      </div>
      </div>
    </header>`);
}

export function bindLayout(root, actions) {
  root.querySelectorAll("[data-mobile-open]").forEach((button) => button.addEventListener("click", () => root.querySelector(".app-shell").classList.add("mobile-menu-open")));
  root.querySelectorAll("[data-mobile-close]").forEach((button) => button.addEventListener("click", () => root.querySelector(".app-shell").classList.remove("mobile-menu-open")));
  const profileWrapper = root.querySelector(".sidebar__profile-wrap");
  const mobileTopbar = root.querySelector(".mobile-topbar");
  const desktopTopbar = root.querySelector(".desktop-topbar");
  const profileViewport = window.matchMedia("(max-width: 760px)");
  const placeProfileMenu = () => {
    if (!profileWrapper) return;
    if (profileViewport.matches) mobileTopbar?.append(profileWrapper);
    else desktopTopbar?.append(profileWrapper);
  };

  if (root.profileViewportQuery && root.profileViewportHandler) {
    root.profileViewportQuery.removeEventListener("change", root.profileViewportHandler);
  }
  root.profileViewportQuery = profileViewport;
  root.profileViewportHandler = placeProfileMenu;
  profileViewport.addEventListener("change", placeProfileMenu);
  placeProfileMenu();

  const profileMenu = root.querySelector("[data-profile-menu]");
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
  root.querySelectorAll("[data-menu-group-toggle]").forEach((button) => button.addEventListener("click", (event) => {
    const group = event.currentTarget.closest(".nav-group");
    const isExpanded = group?.classList.toggle("is-expanded");
    event.currentTarget.setAttribute("aria-expanded", String(Boolean(isExpanded)));
    if (isExpanded) {
      root.querySelectorAll(".nav-group.is-expanded").forEach((otherGroup) => {
        if (otherGroup === group) return;
        otherGroup.classList.remove("is-expanded");
        otherGroup.querySelector("[data-menu-group-toggle]")?.setAttribute("aria-expanded", "false");
        actions.onMenuGroupToggle?.(otherGroup.querySelector("[data-menu-group-toggle]")?.dataset.menuGroupToggle, false);
      });
    }
    actions.onMenuGroupToggle?.(event.currentTarget.dataset.menuGroupToggle, Boolean(isExpanded));
  }));
  root.querySelectorAll("[data-nav]").forEach((button) => button.addEventListener("click", () => actions.onNavigate(button.dataset.nav)));
  root.querySelectorAll("[data-profile-select]").forEach((select) => select.addEventListener("change", (event) => actions.onProfileChange(event.target.value)));
  if (root.profileOutsideClickHandler) document.removeEventListener("click", root.profileOutsideClickHandler);
  root.profileOutsideClickHandler = (event) => {
    if (profileWrapper && !profileWrapper.contains(event.target)) closeProfileMenu();
  };
  document.addEventListener("click", root.profileOutsideClickHandler);
}
