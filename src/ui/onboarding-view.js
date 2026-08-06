import { icon } from "../utils/icons.js";
import { setButtonLoading, showToast } from "./components.js";

export function renderOnboarding(root, { name, onSubmit, onSignOut }) {
  root.innerHTML = `<main class="onboarding-page">
    <header class="onboarding-header"><a class="mobile-brand" href="#"><img class="brand-icon" src="icon.png" alt=""/> AKADEMO</a><button class="quiet-action" data-logout>${icon("logout", 17)} Sair</button></header>
    <section class="onboarding-card">
      <div class="onboarding-card__step"><span>01</span><i></i><span>02</span></div>
      <div class="onboarding-card__icon">${icon("graduation", 27)}</div>
      <span class="eyebrow">PRIMEIRO PASSO</span>
      <h1>Vamos montar seu<br/>perfil de estudo.</h1>
      <p>Olá, ${name}! Conte um pouco sobre sua jornada atual para deixarmos tudo no lugar certo.</p>
      <form id="onboarding-form" class="form-grid" novalidate>
        <label class="field"><span>Instituição de ensino</span><span class="field__control">${icon("book", 18)}<input name="institution" placeholder="Ex.: Universidade Federal..." maxlength="120" required /></span></label>
        <label class="field"><span>Curso</span><span class="field__control">${icon("graduation", 18)}<input name="course" placeholder="Ex.: Engenharia de Software" maxlength="120" required /></span></label>
        <label class="field"><span>Semestre atual</span><span class="field__control">${icon("calendar", 18)}<select name="semester" required><option value="" disabled selected>Selecione o semestre</option>${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">${i + 1}º semestre</option>`).join("")}</select></span></label>
        <div class="profile-date-fields"><label class="field"><span>Data de início</span><span class="field__control">${icon("calendar", 18)}<input name="startDate" type="date" required /></span></label><label class="field"><span>Data de fim</span><span class="field__control">${icon("calendar", 18)}<input name="endDate" type="date" required /></span></label></div>
        <button class="button button--primary button--wide onboarding-card__submit" type="submit">Começar a organizar ${icon("arrowRight", 18)}</button>
      </form>
    </section>
  </main>`;
  root.querySelector("[data-logout]").addEventListener("click", onSignOut);
  root.querySelector("#onboarding-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector("button");
    try { setButtonLoading(button, true); await onSubmit(Object.fromEntries(new FormData(form))); }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível criar seu perfil.", "error"); }
  });
}
