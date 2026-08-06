import { icon } from "../utils/icons.js";
import { escapeHtml, initials } from "../utils/formatters.js";

export function avatar(record, photoUrl, extraClass = "") {
  const label = escapeHtml(initials(record?.nome));
  const name = escapeHtml(record?.nome || "Usuário");
  return `<span class="avatar ${extraClass}" title="${name}">${photoUrl
    ? `<img src="${photoUrl}" alt="Foto de perfil de ${name}" />`
    : `<img src="assets/avatar-default.svg" alt="Foto de perfil padrão" data-initials="${label}" />`}</span>`;
}

export function showToast(message, type = "success") {
  const root = document.querySelector("#toast-root");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `${type === "success" ? icon("check", 18) : icon("info", 18)}<span>${escapeHtml(message)}</span>`;
  root.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 250);
  }, 4200);
}

export function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
}

export function confirmModal({ title, message, confirmLabel = "Continuar", tone = "default" }) {
  return new Promise((resolve) => {
    const root = document.querySelector("#modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" data-modal-close>
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button class="modal__close" type="button" aria-label="Fechar" data-modal-close>${icon("close", 19)}</button>
          <div class="modal__symbol modal__symbol--${tone}">${tone === "danger" ? icon("trash", 22) : icon("info", 22)}</div>
          <h2 id="modal-title">${escapeHtml(title)}</h2>
          <p>${escapeHtml(message)}</p>
          <div class="modal__actions">
            <button class="button button--ghost" type="button" data-modal-cancel>Cancelar</button>
            <button class="button ${tone === "danger" ? "button--danger" : "button--primary"}" type="button" data-modal-confirm>${escapeHtml(confirmLabel)}</button>
          </div>
        </section>
      </div>`;
    const done = (answer) => { closeModal(); resolve(answer); };
    root.querySelector("[data-modal-confirm]").addEventListener("click", () => done(true));
    root.querySelector("[data-modal-cancel]").addEventListener("click", () => done(false));
    root.querySelectorAll("[data-modal-close]").forEach((element) => element.addEventListener("click", (event) => {
      if (event.target === element || element.matches("button")) done(false);
    }));
  });
}

export function unsavedModal() {
  return new Promise((resolve) => {
    const root = document.querySelector("#modal-root");
    root.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
          <div class="modal__symbol">${icon("save", 22)}</div>
          <h2 id="unsaved-title">Salvar alterações?</h2>
          <p>Você tem mudanças que ainda não foram aplicadas às suas informações.</p>
          <div class="modal__actions modal__actions--stack-mobile">
            <button class="button button--ghost" type="button" data-modal-discard>Descartar</button>
            <button class="button button--primary" type="button" data-modal-save>Salvar alterações</button>
          </div>
        </section>
      </div>`;
    root.querySelector("[data-modal-save]").addEventListener("click", () => { closeModal(); resolve("save"); });
    root.querySelector("[data-modal-discard]").addEventListener("click", () => { closeModal(); resolve("discard"); });
  });
}

export function setButtonLoading(button, loading, label) {
  button.disabled = loading;
  if (!button.dataset.original) button.dataset.original = button.innerHTML;
  button.innerHTML = loading ? '<span class="spinner"></span> Aguarde...' : (label || button.dataset.original);
}
