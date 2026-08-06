import { icon } from "../utils/icons.js";
import { fileToDataUrl } from "../utils/formatters.js";
import { setButtonLoading, showToast } from "./components.js";

const authArt = `
  <aside class="auth-art" aria-hidden="true">
    <div class="auth-art__brand"><img class="brand-icon" src="icon.png" alt=""/><span>AKADEMO</span></div>
    <div class="auth-art__copy">
      <span class="eyebrow">SEU ESPAÇO ACADÊMICO</span>
      <h1>Estudar também pode ser leve.</h1>
      <p>Organize sua jornada, encontre foco e avance um passo por vez.</p>
    </div>
    <div class="auth-art__orb auth-art__orb--one"></div><div class="auth-art__orb auth-art__orb--two"></div>
    <div class="auth-art__quote">${icon("sparkles", 18)}<span>Clareza para aprender.<br/>Ritmo para conquistar.</span></div>
  </aside>`;

export function renderAuth(root, { mode = "login", onLogin, onRegister, onGoogle }) {
  const registering = mode === "register";
  root.innerHTML = `<main class="auth-page">${authArt}
    <section class="auth-panel">
      <div class="auth-panel__inner">
        <a class="mobile-brand" href="#" aria-label="AKADEMO"><img class="brand-icon" src="icon.png" alt=""/> AKADEMO</a>
        <span class="eyebrow">${registering ? "COMECE AGORA" : "BEM-VINDO DE VOLTA"}</span>
        <h2>${registering ? "Crie seu espaço" : "Que bom te ver por aqui."}</h2>
        <p class="auth-panel__intro">${registering ? "Vamos deixar sua vida acadêmica mais simples." : "Entre e continue de onde você parou."}</p>
        <button type="button" class="button button--google" data-google>${googleLogo()}<span>${registering ? "Cadastrar com Google" : "Continuar com Google"}</span></button>
        <div class="divider"><span>ou use seu e-mail</span></div>
        <form class="auth-form" id="auth-form" novalidate>
          ${registering ? `<label class="field"><span>Como podemos te chamar?</span><span class="field__control">${icon("user", 18)}<input name="name" autocomplete="name" placeholder="Seu nome completo" required maxlength="80" /></span></label>
          <div class="field field--photo"><span>Foto de perfil <em>opcional</em></span><label class="photo-upload" for="profile-photo"><span class="photo-upload__preview">${icon("camera", 22)}</span><span><strong>Escolher uma foto</strong><small>JPG, PNG ou WEBP · até 3 MB</small></span><input id="profile-photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" /></label></div>` : ""}
          <label class="field"><span>E-mail</span><span class="field__control">${icon("userRound", 18)}<input name="email" type="email" autocomplete="email" placeholder="voce@email.com" required /></span></label>
          <label class="field"><span>Senha</span><span class="field__control">${icon("settings", 18)}<input name="password" type="password" autocomplete="${registering ? "new-password" : "current-password"}" placeholder="••••••••" minlength="6" required /></span></label>
          ${registering ? `<label class="field"><span>Confirme sua senha</span><span class="field__control">${icon("check", 18)}<input name="confirmPassword" type="password" autocomplete="new-password" placeholder="••••••••" minlength="6" required /></span></label><p class="form-note">Ao continuar, você concorda em usar o AKADEMO para cuidar da sua jornada de estudos.</p>` : ""}
          <button class="button button--primary button--wide" type="submit">${registering ? "Criar minha conta" : "Entrar no AKADEMO"} ${icon("arrowRight", 18)}</button>
        </form>
        <p class="auth-switch">${registering ? "Já faz parte do AKADEMO?" : "Ainda não tem uma conta?"} <button type="button" class="text-button" data-switch>${registering ? "Entrar" : "Criar conta"}</button></p>
      </div>
    </section>
  </main>`;

  root.querySelector("[data-switch]").addEventListener("click", () => renderAuth(root, { mode: registering ? "login" : "register", onLogin, onRegister, onGoogle }));
  root.querySelector("[data-google]").addEventListener("click", async (event) => {
    try { setButtonLoading(event.currentTarget, true); await onGoogle(); }
    catch (error) { setButtonLoading(event.currentTarget, false); showToast(error.message, "error"); }
  });
  const form = root.querySelector("#auth-form");
  if (registering) {
    form.photo.addEventListener("change", async () => {
      const file = form.photo.files[0];
      if (!file) return;
      // Esta imagem pode ficar temporariamente no localStorage se a confirmação de e-mail estiver ativa.
      if (file.size > 3 * 1024 * 1024) { form.photo.value = ""; showToast("Para o cadastro, escolha uma imagem de até 3 MB.", "error"); return; }
      const url = await fileToDataUrl(file);
      form.querySelector(".photo-upload__preview").innerHTML = `<img src="${url}" alt="Prévia da foto"/>`;
      form.querySelector(".photo-upload strong").textContent = file.name;
    });
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    const values = Object.fromEntries(new FormData(form));
    if (registering && values.password !== values.confirmPassword) { showToast("As senhas precisam ser iguais.", "error"); return; }
    try {
      setButtonLoading(button, true);
      if (registering) await onRegister({ name: values.name, email: values.email, password: values.password, photo: form.photo.files[0] });
      else await onLogin(values.email, values.password);
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível continuar. Tente novamente.", "error");
    }
  });
}

function googleLogo() {
  return '<svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.8 3.1-4.3 3.1-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.2 13.7a6 6 0 0 1 0-3.4V7.7H2.9A10 10 0 0 0 2 12c0 1.5.4 3 .9 4.3l3.3-2.6Z"/><path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.9 1.5l2.9-2.8C17 3.1 14.8 2 12 2a10 10 0 0 0-9.1 5.7l3.3 2.6C7 7.8 9.3 6 12 6Z"/></svg>';
}
