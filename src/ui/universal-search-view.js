import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";

function resultsMarkup(results, query) {
  if (!query.trim()) return "";
  if (!results.length) {
    return `<div class="universal-search__empty"><span>${icon("search", 21)}</span><strong>Nada encontrado</strong><p>Tente usar outra palavra, trecho ou detalhe do conteúdo.</p></div>`;
  }
  return `<div class="universal-search__results">${results.map((result) => `<button class="universal-search__result" type="button" data-universal-search-result="${escapeHtml(result.id)}"><span class="universal-search__result-icon">${icon(result.iconName, 18)}</span><span><small>${escapeHtml(result.typeLabel)}</small><strong>${escapeHtml(result.title)}</strong>${result.subtitle ? `<em>${escapeHtml(result.subtitle)}</em>` : ""}</span>${icon("arrowRight", 16)}</button>`).join("")}</div>`;
}

export function universalSearchHeader({ variant = "desktop" } = {}) {
  const mobile = variant === "mobile";
  return `<div class="universal-search universal-search--${mobile ? "mobile" : "desktop"}" data-universal-search>
    ${mobile ? `<button class="universal-search__mobile-trigger icon-button" type="button" data-universal-search-open aria-label="Abrir busca universal">${icon("search", 19)}</button>` : ""}
    <div class="universal-search__overlay" data-universal-search-overlay ${mobile ? "hidden" : ""}></div>
    <section class="universal-search__dialog" data-universal-search-dialog ${mobile ? "hidden" : ""} role="dialog" aria-label="Busca universal">
      <label class="universal-search__field"><span>${icon("search", 18)}</span><input type="search" data-universal-search-input autocomplete="off" placeholder="Buscar em todo o AKADEMO" aria-label="Buscar em todo o AKADEMO"/></label>
      ${mobile ? `<button class="universal-search__close icon-button" type="button" data-universal-search-close aria-label="Fechar busca">${icon("close", 19)}</button>` : ""}
      <div class="universal-search__panel" data-universal-search-panel hidden></div>
    </section>
  </div>`;
}

export function bindUniversalSearch(root, { onQuery, onSelect } = {}) {
  root.querySelectorAll("[data-universal-search]").forEach((searchRoot) => {
    const input = searchRoot.querySelector("[data-universal-search-input]");
    const panel = searchRoot.querySelector("[data-universal-search-panel]");
    const dialog = searchRoot.querySelector("[data-universal-search-dialog]");
    const overlay = searchRoot.querySelector("[data-universal-search-overlay]");
    const isMobile = searchRoot.classList.contains("universal-search--mobile");
    let timer = null;
    let sequence = 0;
    let latestResults = [];

    const close = () => {
      if (!isMobile) {
        panel.hidden = true;
        return;
      }
      dialog.hidden = true;
      overlay.hidden = true;
      panel.hidden = true;
      input.value = "";
    };

    const render = (results, query) => {
      latestResults = results;
      panel.innerHTML = resultsMarkup(results, query);
      panel.hidden = !query.trim();
    };

    const runSearch = async () => {
      const query = input.value;
      const request = ++sequence;
      if (!query.trim()) {
        render([], "");
        return;
      }
      panel.hidden = false;
      panel.innerHTML = `<div class="universal-search__loading"><span class="spinner"></span><span>Procurando em seu espaço…</span></div>`;
      try {
        const results = await onQuery?.(query);
        if (request !== sequence) return;
        render(Array.isArray(results) ? results : [], query);
      } catch (error) {
        if (request !== sequence) return;
        console.warn("Não foi possível concluir a busca universal.", error);
        panel.innerHTML = `<div class="universal-search__empty"><span>${icon("search", 21)}</span><strong>Não foi possível pesquisar agora</strong><p>Tente novamente em alguns instantes.</p></div>`;
        panel.hidden = false;
      }
    };

    input?.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(runSearch, 150);
    });
    input?.addEventListener("focus", () => {
      if (input.value.trim()) runSearch();
    });
    searchRoot.querySelector("[data-universal-search-open]")?.addEventListener("click", () => {
      dialog.hidden = false;
      overlay.hidden = false;
      window.setTimeout(() => input.focus(), 0);
    });
    searchRoot.querySelectorAll("[data-universal-search-close]").forEach((button) => button.addEventListener("click", close));
    overlay?.addEventListener("click", close);
    panel?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-universal-search-result]");
      if (!button) return;
      const result = latestResults.find((item) => item.id === button.dataset.universalSearchResult);
      if (!result) return;
      close();
      await onSelect?.(result);
    });
    searchRoot.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      close();
    });

    if (!isMobile) {
      const onOutside = (event) => {
        if (!searchRoot.contains(event.target)) close();
      };
      document.addEventListener("click", onOutside);
      const previousCleanup = root.universalSearchCleanup || [];
      previousCleanup.push(() => document.removeEventListener("click", onOutside));
      root.universalSearchCleanup = previousCleanup;
    }
  });
}
