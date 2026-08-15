import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, confirmModal, setButtonLoading, showToast, unsavedModal } from "./components.js";

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function recordFor(bib, references) {
  const discipline = references.disciplines.find((item) => item.id === bib.disciplina);
  const activity = bib.aula
    ? references.lessons.find((item) => item.id === bib.aula)
    : bib.prova
      ? references.exams.find((item) => item.id === bib.prova)
      : bib.apresentacao
        ? references.presentations.find((item) => item.id === bib.apresentacao)
        : null;
  const activityLabel = bib.aula ? "Aula" : bib.prova ? "Prova" : bib.apresentacao ? "Apresentação" : "Material do perfil";
  const activityName = bib.aula
    ? activity?.tema
    : activity?.titulo;
  return {
    discipline,
    activity,
    activityLabel,
    activityName: activityName || null,
  };
}

function scopeText(scope) {
  if (!scope) return null;
  if (scope.type === "lesson") return { back: "Aula", label: "REFERÊNCIAS DA AULA", title: scope.record.tema || "Aula registrada", description: "Consulte e configure as referências bibliográficas desta aula." };
  if (scope.type === "exam") return { back: "Prova", label: "REFERÊNCIAS DA PROVA", title: scope.record.titulo || "Prova", description: "Reúna as leituras e referências cobradas nesta avaliação." };
  return { back: "Apresentação", label: "REFERÊNCIAS DA APRESENTAÇÃO", title: scope.record.titulo || "Apresentação", description: "Consulte e anexe as referências bibliográficas desta apresentação." };
}

function bibliographyCard(bib, references) {
  const meta = recordFor(bib, references);
  const search = normalize([
    bib.titulo,
    bib.tipo,
    bib.autor,
    bib.descricao,
    meta.discipline?.nome_disciplina,
    meta.activityName,
    meta.activityLabel,
    bib.link,
    bib.arquivo ? "arquivo enviado físico upload" : "link externo url"
  ].filter(Boolean).join(" "));

  return `
    <article class="bibliography-card" data-open-bibliography="${escapeHtml(bib.id)}" data-discipline-id="${escapeHtml(bib.disciplina || "")}" data-bibliography-search="${escapeHtml(search)}" role="button" tabindex="0" aria-label="Ver detalhes de ${escapeHtml(bib.titulo)}">
      <div class="bibliography-card__icon">
        <span>${icon("book", 22)}</span>
        <em>${escapeHtml(bib.tipo.toUpperCase())}</em>
      </div>
      <div class="bibliography-card__body">
        <strong>${escapeHtml(bib.titulo)}</strong>
        <p class="bibliography-card__author">Por: ${escapeHtml(bib.autor)}</p>
        ${bib.descricao ? `<p class="bibliography-card__desc">${escapeHtml(bib.descricao)}</p>` : `<p class="bibliography-card__desc text-muted">Sem descrição cadastrada.</p>`}
        <div class="bibliography-card__meta">
          <small>${escapeHtml(meta.discipline?.nome_disciplina || "Perfil geral")}</small>
          ${meta.activityName ? `<b>${escapeHtml(meta.activityLabel)} · ${escapeHtml(meta.activityName)}</b>` : ""}
        </div>
      </div>
      <div class="bibliography-card__footer">
        <span>${icon("arrowRight", 16)} Detalhes</span>
      </div>
    </article>
  `;
}

function empty(scope) {
  return `
    <section class="bibliography-empty">
      <span>${icon("book", 30)}</span>
      <h2>${scope ? "Nenhuma referência vinculada" : "Sua biblioteca acadêmica"}</h2>
      <p>${scope ? "Vincule livros, artigos ou leis para apoiar a preparação desta atividade." : "Cadastre livros, artigos, notícias e outros materiais para consultar a qualquer momento."}</p>
      <button class="button button--secondary" data-add-bibliography>${icon("plus", 16)} Adicionar referência</button>
    </section>
  `;
}

export function bibliographyView({ bibliography, references, scope }) {
  const scopedBib = scope ? bibliography.filter((bib) => bib[scope.field] === scope.record.id) : bibliography;
  const copy = scopeText(scope);

  return `
    <section class="page bibliography-page">
      ${copy ? `
        <button class="back-link" data-bibliography-back>${icon("arrowLeft", 18)} ${copy.back}</button>
        <header class="bibliography-context">
          <span>${icon("book", 19)}</span>
          <div>
            <small>${copy.label}</small>
            <h1>${escapeHtml(copy.title)}</h1>
            <p>${copy.description}</p>
          </div>
        </header>
      ` : ""}
      
      <div class="page-heading page-heading--row">
        <div>
          <span class="eyebrow">BIBLIOTECA ACADÊMICA</span>
          <h1>Bibliografia</h1>
          <p>Consulte e organize seus livros, artigos, notícias, leis e referências de estudo.</p>
        </div>
        <button class="button button--primary" data-add-bibliography>${icon("plus", 17)} Salvar referência</button>
      </div>

      <section class="bibliography-toolbar">
        <label class="field bibliography-search">
          <span class="field__control">
            ${icon("search", 17)}
            <input data-bibliography-search autocomplete="off" placeholder="Buscar por título, autor, tipo, disciplina, aula, prova ou apresentação" />
          </span>
        </label>
        <label class="field bibliography-filter">
          <span class="field__control">
            ${icon("book", 17)}
            <select data-bibliography-discipline-filter>
              <option value="all">Todas as disciplinas</option>
              <option value="none">Sem disciplina</option>
              ${references.disciplines.map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.nome_disciplina)}</option>`).join("")}
            </select>
          </span>
        </label>
        <p>
          <span>${icon("book", 16)}</span>
          <strong data-bibliography-count>${scopedBib.length}</strong> ${scopedBib.length === 1 ? "referência salva" : "referências salvas"}
        </p>
      </section>

      <div class="bibliography-grid" data-bibliography-grid>
        ${scopedBib.length ? scopedBib.map((bib) => bibliographyCard(bib, references)).join("") : empty(scope)}
      </div>
      <p class="bibliography-search-empty" data-bibliography-search-empty hidden>Nenhuma referência combina com esta busca.</p>
    </section>
  `;
}

function activitiesFor(type, disciplineId, references) {
  if (!disciplineId || !type) return [];
  const collection = type === "lesson" ? references.lessons : type === "exam" ? references.exams : references.presentations;
  return collection.filter((item) => item.disciplina === disciplineId);
}

function activityOptions(type, disciplineId, references) {
  const label = type === "lesson" ? "aula" : type === "exam" ? "prova" : "apresentação";
  return `<option value="">Sem ${label} vinculada</option>${activitiesFor(type, disciplineId, references).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(type === "lesson" ? item.tema || "Aula registrada" : item.titulo)}</option>`).join("")}`;
}

function createModal(references, scope, record) {
  const isEdit = Boolean(record);
  const title = isEdit ? "Editar referência" : "Salvar referência";
  const buttonText = isEdit ? "Atualizar referência" : "Salvar referência";
  const scoped = Boolean(scope);

  const selectedType = record?.tipo || "Livro";
  const types = ["Livro", "Artigo", "Tese", "Dissertação", "Noticia", "Relatorio", "Lei/decreto", "outros"];
  const typeOptions = types.map((t) => `<option value="${escapeHtml(t)}" ${t === selectedType ? "selected" : ""}>${escapeHtml(t)}</option>`).join("");

  const originalDiscipline = record?.disciplina || (scoped ? scope.disciplineId : "");
  const origActivityType = record?.aula ? "lesson" : record?.prova ? "exam" : record?.apresentacao ? "presentation" : (scoped ? scope.type : "");
  const origActivityId = record?.aula || record?.prova || record?.apresentacao || (scoped ? scope.record.id : "");

  const scopeData = scoped 
    ? `
      <div class="bibliography-create__scope">
        <span>${icon("calendar", 16)}</span>
        <div>
          <small>VÍNCULO AUTOMÁTICO</small>
          <strong>${escapeHtml(scope.type === "lesson" ? "Aula" : scope.type === "exam" ? "Prova" : "Apresentação")}</strong>
          <p>${escapeHtml(scope.type === "lesson" ? scope.record.tema || "Aula registrada" : scope.record.titulo)}</p>
        </div>
      </div>
    ` 
    : `
      <div class="bibliography-create__links">
        <label class="field">
          <span>Disciplina <em>opcional</em></span>
          <span class="field__control">
            ${icon("book", 17)}
            <select name="disciplineId" data-bibliography-discipline>
              <option value="">Sem disciplina</option>
              ${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === originalDiscipline ? "selected" : ""}>${escapeHtml(item.nome_disciplina)}</option>`).join("")}
            </select>
          </span>
        </label>
        <label class="field">
          <span>Vincular a <em>opcional</em></span>
          <span class="field__control">
            ${icon("calendar", 17)}
            <select name="activityType" data-bibliography-activity-type ${originalDiscipline ? "" : "disabled"}>
              <option value="">Nenhuma atividade</option>
              <option value="lesson" ${origActivityType === "lesson" ? "selected" : ""}>Aula</option>
              <option value="exam" ${origActivityType === "exam" ? "selected" : ""}>Prova</option>
              <option value="presentation" ${origActivityType === "presentation" ? "selected" : ""}>Apresentação</option>
            </select>
          </span>
        </label>
        <label class="field bibliography-activity-choice" ${origActivityType ? "" : "hidden"}>
          <span data-bibliography-activity-label>${origActivityType === "lesson" ? "Aula" : origActivityType === "exam" ? "Prova" : origActivityType === "presentation" ? "Apresentação" : "Atividade"}</span>
          <span class="field__control">
            ${icon("file", 17)}
            <select name="activityId" data-bibliography-activity-id ${origActivityType ? "" : "disabled"}>
              ${origActivityType ? activityOptions(origActivityType, originalDiscipline, references) : `<option value="">Selecione primeiro uma atividade</option>`}
            </select>
          </span>
        </label>
      </div>
    `;

  return `
    <div class="modal-backdrop" data-bibliography-create-backdrop>
      <section class="modal modal--bibliography-create" role="dialog" aria-modal="true" aria-labelledby="bib-create-title">
        <form class="bibliography-create" data-bibliography-create-form novalidate>
          <header>
            <div>
              <span class="eyebrow">${isEdit ? "ATUALIZAR ACADÊMICO" : "NOVA REFERÊNCIA"}</span>
              <h2 id="bib-create-title">${escapeHtml(title)}</h2>
              <p>Guarde o link de acesso ou envie um arquivo privado (PDF, DOCX, etc) de apoio acadêmico.</p>
            </div>
            <button class="icon-button" type="button" data-close-bibliography-create aria-label="Fechar">${icon("close", 19)}</button>
          </header>

          ${scoped ? scopeData : ""}

          <div class="bibliography-create__fields">
            <div class="form-row-2">
              <label class="field">
                <span>Título da referência</span>
                <span class="field__control">
                  ${icon("book", 17)}
                  <input name="title" maxlength="180" required autofocus value="${escapeHtml(record?.titulo || "")}" placeholder="Ex.: Princípios de Física e Cálculo" />
                </span>
              </label>
              <label class="field">
                <span>Tipo de referência</span>
                <span class="field__control">
                  ${icon("info", 17)}
                  <select name="type" required>
                    ${typeOptions}
                  </select>
                </span>
              </label>
            </div>

            <label class="field">
              <span>Autor / Entidade</span>
              <span class="field__control">
                ${icon("userRound", 17)}
                <input name="author" maxlength="120" required value="${escapeHtml(record?.autor || "")}" placeholder="Ex.: Halliday, Resnick ou Ministério da Educação" />
              </span>
            </label>

            <label class="field">
              <span>Descrição ou resumo <em>opcional</em></span>
              <textarea class="field__textarea" name="description" maxlength="5000" placeholder="De que trata esta obra e onde ela é usada?">${escapeHtml(record?.descricao || "")}</textarea>
            </label>

            <div class="bibliography-source">
              <div>
                <strong>Conteúdo / Link da referência</strong>
                <small>Cole uma URL de acesso ou anexe um arquivo privado para salvar no seu espaço.</small>
              </div>
              <label class="field">
                <span>Link da web <em>opcional</em></span>
                <span class="field__control">
                  ${icon("arrowRight", 17)}
                  <input type="url" name="link" value="${record && !record.arquivo ? escapeHtml(record.link) : ""}" placeholder="https://..." inputmode="url" />
                </span>
              </label>
              <div class="bibliography-source__or"><span>ou</span></div>
              <label class="bibliography-source__file">
                <input type="file" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" data-bibliography-file/>
                <span>${icon("upload", 20)}</span>
                <div>
                  <strong>${record?.arquivo ? "Substituir arquivo privado" : "Selecionar arquivo de referência"}</strong>
                  <small data-bibliography-file-label>${record?.arquivo ? "O arquivo já está salvo. Clique se desejar alterá-lo." : "PDF, Word, Excel, PowerPoint ou ZIP · até 20 MB"}</small>
                </div>
              </label>
            </div>
          </div>

          ${!scoped ? scopeData : ""}

          <footer>
            <button class="button button--ghost" type="button" data-close-bibliography-create>Cancelar</button>
            <button class="button button--primary" type="submit">${icon("save", 16)} ${escapeHtml(buttonText)}</button>
          </footer>
        </form>
      </section>
    </div>
  `;
}

export function openBibliographyCreate({ references, scope, record, onCreateOrUpdate }) {
  const modalRoot = document.querySelector("#modal-root");
  let closed = false;

  modalRoot.innerHTML = createModal(references, scope, record);
  const form = modalRoot.querySelector("[data-bibliography-create-form]");
  const originalData = record ? {
    titulo: record.titulo || "",
    tipo: record.tipo || "",
    autor: record.autor || "",
    descricao: record.descricao || "",
    link: record.arquivo ? "" : record.link || "",
    disciplina: record.disciplina || "",
    activityType: record.aula ? "lesson" : record.prova ? "exam" : record.apresentacao ? "presentation" : "",
    activityId: record.aula || record.prova || record.apresentacao || ""
  } : {
    titulo: "",
    tipo: "Livro",
    autor: "",
    descricao: "",
    link: "",
    disciplina: scope?.disciplineId || "",
    activityType: scope?.type || "",
    activityId: scope?.record?.id || ""
  };

  const isDirty = () => {
    const currentTitle = String(form.querySelector("[name=title]").value || "").trim();
    const currentType = String(form.querySelector("[name=type]").value || "").trim();
    const currentAuthor = String(form.querySelector("[name=author]").value || "").trim();
    const currentDescription = String(form.querySelector("[name=description]").value || "").trim();
    const currentLink = String(form.querySelector("[name=link]").value || "").trim();
    const fileSelected = Boolean(form.querySelector("[name=file]").files?.length);
    const disciplineSelect = form.querySelector("[name=disciplineId]");
    const currentDiscipline = disciplineSelect ? String(disciplineSelect.value || "").trim() : originalData.disciplina;
    const typeSelect = form.querySelector("[name=activityType]");
    const currentActivityType = typeSelect ? String(typeSelect.value || "").trim() : originalData.activityType;
    const idSelect = form.querySelector("[name=activityId]");
    const currentActivityId = idSelect ? String(idSelect.value || "").trim() : originalData.activityId;

    return (
      currentTitle !== originalData.titulo ||
      currentType !== originalData.tipo ||
      currentAuthor !== originalData.autor ||
      currentDescription !== originalData.descricao ||
      currentLink !== originalData.link ||
      fileSelected ||
      currentDiscipline !== originalData.disciplina ||
      currentActivityType !== originalData.activityType ||
      currentActivityId !== originalData.activityId
    );
  };

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };

  const handleCloseAttempt = async () => {
    if (isDirty()) {
      const choice = await unsavedModal({
        title: "Descartar alterações?",
        message: "Você tem informações não salvas neste formulário.",
        saveLabel: "Salvar agora",
        discardLabel: "Descartar alterações"
      });
      if (choice === "save") {
        form.requestSubmit();
      } else if (choice === "discard") {
        close();
      }
    } else {
      close();
    }
  };

  const onKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handleCloseAttempt();
    }
  };

  document.addEventListener("keydown", onKeydown);

  modalRoot.querySelectorAll("[data-close-bibliography-create]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      handleCloseAttempt();
    });
  });

  modalRoot.querySelector("[data-bibliography-create-backdrop]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      handleCloseAttempt();
    }
  });

  const discipline = modalRoot.querySelector("[data-bibliography-discipline]");
  const activityType = modalRoot.querySelector("[data-bibliography-activity-type]");
  const activityField = modalRoot.querySelector(".bibliography-activity-choice");
  const activityId = modalRoot.querySelector("[data-bibliography-activity-id]");
  const activityLabel = modalRoot.querySelector("[data-bibliography-activity-label]");

  const syncActivities = () => {
    if (!discipline || !activityType || !activityId) return;
    activityType.disabled = !discipline.value;
    if (!discipline.value) {
      activityType.value = "";
    }
    const type = activityType.value;
    if (activityField) {
      activityField.hidden = !type;
    }
    activityId.disabled = !type;
    activityId.innerHTML = type ? activityOptions(type, discipline.value, references) : "<option value=\"\">Selecione primeiro uma atividade</option>";
    if (activityLabel && type) {
      activityLabel.textContent = type === "lesson" ? "Aula" : type === "exam" ? "Prova" : "Apresentação";
    }

    // Set correct value if preselected
    if (type === originalData.activityType && discipline.value === originalData.disciplina) {
      activityId.value = originalData.activityId;
    }
  };

  discipline?.addEventListener("change", syncActivities);
  activityType?.addEventListener("change", syncActivities);

  // Initialize activity values if editing
  if (record && record.disciplina) {
    syncActivities();
  }

  const fileInput = modalRoot.querySelector("[data-bibliography-file]");
  fileInput?.addEventListener("change", () => {
    const selected = fileInput.files?.[0];
    const label = modalRoot.querySelector("[data-bibliography-file-label]");
    if (label && selected) {
      label.textContent = `${selected.name} · ${Math.max(1, Math.ceil(selected.size / 1024 / 1024))} MB`;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const type = data.get("activityType");
    const actId = String(data.get("activityId") || "");

    const values = {
      title: data.get("title"),
      type: data.get("type"),
      author: data.get("author"),
      description: data.get("description"),
      link: data.get("link"),
      file: fileInput?.files?.[0] || null,
      disciplineId: data.get("disciplineId"),
      lessonId: scope?.type === "lesson" ? scope.record.id : type === "lesson" ? actId : "",
      examId: scope?.type === "exam" ? scope.record.id : type === "exam" ? actId : "",
      presentationId: scope?.type === "presentation" ? scope.record.id : type === "presentation" ? actId : "",
    };

    if (scope) {
      values.disciplineId = scope.disciplineId;
    }

    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      await onCreateOrUpdate(values);
      close();
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Erro ao salvar referência bibliográfica.", "error");
    }
  });
}

export function openBibliographyDetail({ record, references, onOpenLink, onEdit, onDelete }) {
  const modalRoot = document.querySelector("#modal-root");
  const meta = recordFor(record, references);

  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-bibliography-detail-backdrop>
      <section class="modal modal--bibliography-detail" role="dialog" aria-modal="true" aria-labelledby="bib-detail-title">
        <header>
          <div>
            <span class="eyebrow">${escapeHtml(record.tipo.toUpperCase())}</span>
            <h2 id="bib-detail-title">${escapeHtml(record.titulo)}</h2>
            <p class="bibliography-detail-author">De: ${escapeHtml(record.autor)}</p>
          </div>
          <button class="icon-button" data-close-bibliography-detail aria-label="Fechar">${icon("close", 19)}</button>
        </header>

        <section class="bibliography-detail__body">
          <div class="bibliography-detail__desc">
            <strong>Descrição / Notas de estudo</strong>
            <p>${escapeHtml(record.descricao || "Nenhuma nota ou descrição adicionada para esta referência.")}</p>
          </div>
          <div class="bibliography-detail__meta">
            <div>
              <span>${icon("book", 15)} Disciplina</span>
              <strong>${escapeHtml(meta.discipline?.nome_disciplina || "Perfil geral")}</strong>
            </div>
            ${meta.activityName ? `
              <div>
                <span>${icon("calendar", 15)} ${escapeHtml(meta.activityLabel)}</span>
                <strong>${escapeHtml(meta.activityName)}</strong>
              </div>
            ` : ""}
            <div>
              <span>${icon("info", 15)} Tipo de acesso</span>
              <strong>${record.arquivo ? "Arquivo privado armazenado" : "Link externo cadastrado"}</strong>
            </div>
          </div>
        </section>

        <footer>
          <div class="footer-left">
            <button class="button button--danger button--ghost" data-delete-bibliography-btn>${icon("trash", 16)} Apagar</button>
          </div>
          <div class="footer-right">
            <button class="button button--secondary" data-edit-bibliography-btn>${icon("edit", 16)} Editar</button>
            <button class="button button--primary" data-open-bibliography-content>${icon("arrowRight", 16)} Abrir conteúdo</button>
          </div>
        </footer>
      </section>
    </div>
  `;

  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };

  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-bibliography-detail]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-bibliography-detail-backdrop]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) close();
  });

  modalRoot.querySelector("[data-open-bibliography-content]").addEventListener("click", () => {
    onOpenLink(record);
  });

  modalRoot.querySelector("[data-edit-bibliography-btn]").addEventListener("click", () => {
    onEdit(record);
  });

  modalRoot.querySelector("[data-delete-bibliography-btn]").addEventListener("click", () => {
    onDelete(record);
  });
}

export function bindBibliographyCatalog(root, { bibliography, references, scope, onBack, onCreate, onUpdate, onDelete, onOpenLink }) {
  root.querySelector("[data-bibliography-back]")?.addEventListener("click", onBack);
  
  const triggerAdd = () => openBibliographyCreate({
    references,
    scope,
    onCreateOrUpdate: async (values) => onCreate(values)
  });

  root.querySelectorAll("[data-add-bibliography]").forEach((button) => button.addEventListener("click", triggerAdd));

  const triggerEdit = (record) => openBibliographyCreate({
    references,
    scope,
    record,
    onCreateOrUpdate: async (values) => onUpdate(record.id, values)
  });

  const triggerDelete = async (record) => {
    const question = record.arquivo 
      ? `“${record.titulo}” e seu arquivo privado associado serão removidos definitivamente.`
      : `“${record.titulo}” será removido da sua lista de referências.`;
    if (await confirmModal({
      title: "Remover esta bibliografia?",
      message: question,
      confirmLabel: "Apagar bibliografia",
      tone: "danger"
    })) {
      closeModal();
      await onDelete(record);
    }
  };

  const triggerDetail = (record) => openBibliographyDetail({
    record,
    references,
    onOpenLink,
    onEdit: triggerEdit,
    onDelete: triggerDelete
  });

  root.querySelectorAll("[data-open-bibliography]").forEach((card) => {
    const record = bibliography.find((item) => item.id === Number(card.dataset.openBibliography));
    if (!record) return;

    card.addEventListener("click", () => triggerDetail(record));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        triggerDetail(record);
      }
    });
  });

  const searchInput = root.querySelector("[data-bibliography-search]");
  const disciplineFilter = root.querySelector("[data-bibliography-discipline-filter]");
  const emptyMessage = root.querySelector("[data-bibliography-search-empty]");
  const countSpan = root.querySelector("[data-bibliography-count]");

  const filterCatalog = () => {
    const terms = searchInput ? normalize(searchInput.value).split(/\s+/).filter(Boolean) : [];
    const selectedDiscipline = disciplineFilter ? disciplineFilter.value : "all";
    let visible = 0;

    root.querySelectorAll("[data-open-bibliography]").forEach((card) => {
      const textMatches = terms.every((term) => card.dataset.bibliographySearch.includes(term));
      const cardDiscipline = card.dataset.disciplineId || "";
      let disciplineMatches = false;
      if (selectedDiscipline === "all") {
        disciplineMatches = true;
      } else if (selectedDiscipline === "none") {
        disciplineMatches = cardDiscipline === "";
      } else {
        disciplineMatches = cardDiscipline === selectedDiscipline;
      }

      const matches = textMatches && disciplineMatches;
      card.hidden = !matches;
      if (matches) visible += 1;
    });

    if (countSpan) {
      countSpan.textContent = String(visible);
    }
    if (emptyMessage) {
      const hasFilterActive = terms.length > 0 || selectedDiscipline !== "all";
      emptyMessage.hidden = visible > 0 || !hasFilterActive;
    }
  };

  searchInput?.addEventListener("input", filterCatalog);
  disciplineFilter?.addEventListener("change", filterCatalog);
}
