import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const normalize = (value = "") => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
const same = (first, second) => String(first || "") === String(second || "");
const questionsOf = (quiz) => Array.isArray(quiz?.perguntas) ? quiz.perguntas : [];
const shuffle = (items = []) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
};
const makeId = (prefix) => (globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function author(quiz) {
  return quiz?.publico && quiz?.revelar_nome ? quiz.nome_autor || "Estudante AKADEMO" : "Autor anônimo";
}

function resultData(result) {
  return result?.resultado && typeof result.resultado === "object" ? result.resultado : null;
}

function resultFor(results, quizId) {
  return (results || []).find((item) => same(item.quiz, quizId)) || null;
}

function quizCard(quiz, result, mine = false) {
  const total = questionsOf(quiz).length;
  const data = resultData(result);
  const searchable = normalize([quiz.tema, quiz.descricao, quiz.publico ? "publico público" : "privado", author(quiz), ...questionsOf(quiz).flatMap((question) => [question.statement, ...(question.alternatives || []).map((alternative) => alternative?.text)])].join(" "));
  return `<button class="quiz-card" type="button" data-open-quiz="${escapeHtml(quiz.id)}" data-quiz-search="${escapeHtml(searchable)}"><span class="quiz-card__icon">${icon("quiz", 22)}</span><div><small>${quiz.publico ? "QUIZ PÚBLICO" : "QUIZ PRIVADO"}</small><strong>${escapeHtml(quiz.tema)}</strong>${quiz.descricao ? `<p>${escapeHtml(quiz.descricao)}</p>` : `<p class="quiz-card__placeholder">Desafio pronto para responder.</p>`}${quiz.publico && quiz.revelar_nome && quiz.nome_autor ? `<span class="quiz-card__author">${icon("userRound", 13)} ${escapeHtml(quiz.nome_autor)}</span>` : ""}<span>${icon("file", 14)} ${total} ${total === 1 ? "pergunta" : "perguntas"}</span></div>${data ? `<em>${data.percentage ?? 0}%</em>` : mine ? `<em>${icon("edit", 16)}</em>` : ""}</button>`;
}

function emptyState(mode) {
  const copy = mode === "mine"
    ? ["Seu primeiro quiz começa aqui", "Crie perguntas, publique quando quiser e acompanhe quem está aprendendo."]
    : mode === "results"
      ? ["Sem resultados ainda", "Ao finalizar um quiz, o seu desempenho aparecerá aqui."]
      : ["A comunidade ainda está preparando quizzes", "Crie o primeiro desafio público para começar."];
  return `<section class="quizzes-empty"><span>${icon("quiz", 31)}</span><h2>${copy[0]}</h2><p>${copy[1]}</p>${mode !== "results" ? `<button class="button button--secondary" type="button" data-create-quiz>${icon("plus", 16)} Criar quiz</button>` : ""}</section>`;
}

function resultCard(result, quiz) {
  const data = resultData(result) || {};
  const title = quiz?.tema || data.quizTheme || "Quiz removido";
  return `<button class="quiz-card quiz-card--result" type="button" data-view-quiz-result="${escapeHtml(result.quiz)}" data-quiz-search="${escapeHtml(normalize([title, data.percentage, data.correctCount].join(" ")))}"><span class="quiz-card__icon">${icon("check", 22)}</span><div><small>RESULTADO SALVO</small><strong>${escapeHtml(title)}</strong><p>${data.correctCount ?? 0} de ${data.totalQuestions ?? 0} respostas corretas</p><span>${icon("calendar", 14)} ${data.answeredAt ? new Date(data.answeredAt).toLocaleDateString("pt-BR") : "Agora"}</span></div><em>${data.percentage ?? 0}%</em></button>`;
}

export function quizzesView({ mode = "public", publicQuizzes = [], myQuizzes = [], results = [] }) {
  const isMine = mode === "mine";
  const isResults = mode === "results";
  const source = isMine ? myQuizzes : publicQuizzes;
  const cards = isResults
    ? results.map((result) => resultCard(result, [...myQuizzes, ...publicQuizzes].find((quiz) => same(quiz.id, result.quiz)))).join("")
    : source.map((quiz) => quizCard(quiz, resultFor(results, quiz.id), isMine)).join("");
  const visibleCount = isResults ? results.length : source.length;
  const title = isMine ? "Meus quizzes" : isResults ? "Meus resultados" : "Quizzes públicos";
  const description = isMine ? "Crie, edite e publique os seus desafios." : isResults ? "Veja o seu desempenho em cada quiz respondido." : "Explore desafios criados pela comunidade AKADEMO.";
  return `<section class="page quizzes-page"><header class="quizzes-page__head"><div><span class="eyebrow">JOGOS E REVISÃO</span><h1>${title}</h1><p>${description}</p></div>${!isResults ? `<button class="button button--primary" type="button" data-create-quiz>${icon("plus", 17)} Criar quiz</button>` : ""}</header><div class="quizzes-toolbar"><label class="field quizzes-toolbar__search"><span class="visually-hidden">Buscar quiz</span><span class="field__control">${icon("search", 17)}<input data-quiz-search-input autocomplete="off" placeholder="Buscar por tema, descrição ou autor" /></span></label><div class="quizzes-toolbar__actions">${!isMine && !isResults ? `<button class="button button--secondary" type="button" data-quiz-mine>${icon("userRound", 16)} Meus quizzes</button><button class="button button--secondary" type="button" data-quiz-results>${icon("check", 16)} Meus resultados</button>` : `<button class="button button--ghost" type="button" data-quiz-public>${icon("arrowLeft", 16)} Todos os quizzes</button>${isMine ? `<button class="button button--secondary" type="button" data-quiz-results>${icon("check", 16)} Resultados</button>` : `<button class="button button--secondary" type="button" data-quiz-mine>${icon("userRound", 16)} Meus quizzes</button>`}`}</div></div><div class="quizzes-toolbar__meta"><p>${isResults ? "Resultados armazenados por quiz. Uma nova tentativa atualiza o resultado anterior." : isMine ? "Somente você pode editar ou apagar estes quizzes." : "Os quizzes privados aparecem somente para quem os criou."}</p><strong data-quiz-count>${visibleCount} ${visibleCount === 1 ? "quiz" : "quizzes"}</strong></div><section class="quizzes-grid" data-quizzes-grid>${cards || emptyState(isResults ? "results" : isMine ? "mine" : "public")}</section><p class="quizzes-search-empty" data-quiz-search-empty hidden>Nenhum quiz corresponde à sua busca.</p></section>`;
}

function detailsModal(quiz, { isOwner, result }) {
  const data = resultData(result);
  const total = questionsOf(quiz).length;
  return `<div class="modal-backdrop" data-quiz-details-backdrop><section class="modal modal--quiz-details" role="dialog" aria-modal="true" aria-labelledby="quiz-details-title"><header class="quiz-modal__head"><div><span class="eyebrow">${quiz.publico ? "QUIZ PÚBLICO" : "QUIZ PRIVADO"}</span><h2 id="quiz-details-title">${escapeHtml(quiz.tema)}</h2><p>${quiz.publico ? `${icon("userRound", 14)} ${escapeHtml(author(quiz))}` : "Visível apenas para você."}</p></div><button class="icon-button" type="button" data-close-quiz-details aria-label="Fechar">${icon("close", 19)}</button></header><main class="quiz-details__body">${quiz.descricao ? `<p class="quiz-details__description">${escapeHtml(quiz.descricao)}</p>` : ""}<div class="quiz-details__metrics"><span>${icon("file", 18)} <strong>${total}</strong> ${total === 1 ? "pergunta" : "perguntas"}</span>${data ? `<span>${icon("check", 18)} <strong>${data.percentage ?? 0}%</strong> de acerto</span>` : `<span>${icon("sparkles", 18)} Ainda não respondido</span>`}</div></main><footer class="modal__actions">${isOwner ? `<button class="button button--danger button--small" type="button" data-delete-quiz>${icon("trash", 15)} Apagar</button><span></span><button class="button button--secondary" type="button" data-edit-quiz>${icon("edit", 16)} Editar</button>` : ""}${data ? `<button class="button button--secondary" type="button" data-view-quiz-result>${icon("file", 16)} Ver resultado</button><button class="button button--primary" type="button" data-start-quiz>${icon("sparkles", 16)} Refazer</button>` : `<button class="button button--primary" type="button" data-start-quiz>${icon("sparkles", 16)} Iniciar quiz</button>`}</footer><div class="quiz-inline-confirm" data-quiz-inline-confirm hidden></div></section></div>`;
}

function inlineConfirm(host, { title, message, confirmLabel, cancelLabel = "Voltar", tone = "button--primary", onConfirm, onCancel }) {
  const layer = host.querySelector("[data-quiz-inline-confirm]");
  layer.hidden = false;
  layer.innerHTML = `<div><span>${icon(tone === "button--danger" ? "trash" : "info", 20)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p><footer><button class="button button--ghost button--small" type="button" data-quiz-confirm-cancel>${escapeHtml(cancelLabel)}</button><button class="button ${tone} button--small" type="button" data-quiz-confirm-action>${escapeHtml(confirmLabel)}</button></footer></div>`;
  const clear = () => { layer.hidden = true; layer.innerHTML = ""; };
  layer.querySelector("[data-quiz-confirm-cancel]").addEventListener("click", () => { clear(); onCancel?.(); });
  layer.querySelector("[data-quiz-confirm-action]").addEventListener("click", () => { clear(); onConfirm?.(); });
}

function newQuestion() {
  return {
    id: makeId("question"), statement: "", correctId: "",
    alternatives: Array.from({ length: 4 }, () => ({ id: makeId("alternative"), text: "" })),
  };
}

function questionEditor(question, index, total) {
  return `<section class="quiz-question-editor" data-quiz-question-editor><div class="quiz-question-editor__nav"><label class="field"><span>Pergunta atual</span><span class="field__control">${icon("quiz", 16)}<select data-quiz-question-select>${Array.from({ length: total }, (_, position) => `<option value="${position}" ${position === index ? "selected" : ""}>Pergunta ${position + 1}</option>`).join("")}</select></span></label><button class="button button--danger button--small" type="button" data-delete-quiz-question ${total < 2 ? "disabled" : ""}>${icon("trash", 15)} Apagar pergunta</button></div><label class="field"><span>Enunciado</span><textarea class="field__textarea" data-quiz-statement rows="4" maxlength="5000" placeholder="Escreva a pergunta de forma clara e objetiva" required>${escapeHtml(question.statement)}</textarea></label><section class="quiz-alternatives"><div><small>ALTERNATIVAS</small><strong>Selecione a resposta correta</strong></div><div data-quiz-alternatives>${question.alternatives.map((alternative, position) => `<article class="quiz-alternative-row" data-quiz-alternative data-alternative-id="${escapeHtml(alternative.id)}"><label class="quiz-alternative-row__correct"><input type="radio" name="quiz-correct" value="${escapeHtml(alternative.id)}" ${same(question.correctId, alternative.id) ? "checked" : ""}/><i></i><span>${String.fromCharCode(65 + position)}</span></label><label class="field"><span class="visually-hidden">Alternativa ${position + 1}</span><span class="field__control"><input data-quiz-alternative-text maxlength="3000" value="${escapeHtml(alternative.text)}" placeholder="Alternativa ${position + 1}" required /></span></label><button class="icon-button icon-button--danger" type="button" data-remove-quiz-alternative aria-label="Remover alternativa" ${question.alternatives.length <= 4 ? "disabled" : ""}>${icon("close", 16)}</button></article>`).join("")}</div>${question.alternatives.length < 6 ? `<button class="text-button" type="button" data-add-quiz-alternative>${icon("plus", 15)} Adicionar alternativa</button>` : ""}</section></section>`;
}

function quizBasicsModal(quiz = null) {
  const editing = Boolean(quiz);
  return `<div class="modal-backdrop" data-quiz-basics-backdrop><section class="modal modal--quiz-basics" role="dialog" aria-modal="true" aria-labelledby="quiz-basics-title"><form data-quiz-basics-form novalidate><header class="quiz-modal__head"><div><span class="eyebrow">${editing ? "EDITAR QUIZ" : "NOVO QUIZ"}</span><h2 id="quiz-basics-title">${editing ? escapeHtml(quiz.tema) : "Defina o seu quiz"}</h2><p>Escolha a identidade e a visibilidade antes de montar as perguntas.</p></div><button class="icon-button" type="button" data-close-quiz-basics aria-label="Fechar">${icon("close", 19)}</button></header><main class="quiz-basics__body"><label class="field"><span>Tema do quiz</span><span class="field__control">${icon("quiz", 17)}<input name="theme" maxlength="180" value="${escapeHtml(quiz?.tema || "")}" placeholder="Ex.: Fundamentos de estatística" required autofocus/></span></label><label class="field"><span>Descrição</span><textarea class="field__textarea" name="description" rows="4" maxlength="3000" placeholder="Explique o objetivo deste desafio." required>${escapeHtml(quiz?.descricao || "")}</textarea></label><label class="field"><span>Visibilidade</span><span class="field__control">${icon("users", 17)}<select name="public" data-quiz-public-select><option value="public" ${quiz?.publico !== false ? "selected" : ""}>Público — outros estudantes podem responder</option><option value="private" ${quiz?.publico === false ? "selected" : ""}>Privado — somente você pode acessar</option></select></span></label><label class="quiz-reveal-name" data-quiz-reveal-name ${quiz?.publico === false ? "hidden" : ""}><span><i>${icon("userRound", 17)}</i><b>Mostrar meu nome como criador<small>Os participantes verão o seu nome neste quiz público.</small></b></span><span class="switch"><input name="revealName" type="checkbox" ${quiz?.revelar_nome ? "checked" : ""}/><i></i></span></label></main><footer class="modal__actions"><button class="button button--ghost" type="button" data-close-quiz-basics>Cancelar</button>${editing ? `<button class="button button--secondary" type="button" data-save-quiz-basics>${icon("save", 16)} Salvar e sair</button>` : ""}<button class="button button--primary" type="submit">Montar perguntas ${icon("arrowRight", 16)}</button></footer><div class="quiz-inline-confirm" data-quiz-inline-confirm hidden></div></form></section></div>`;
}

function quizEditorModal(basics, questions, index, editing) {
  return `<div class="modal-backdrop" data-quiz-editor-backdrop><section class="modal modal--quiz-editor" role="dialog" aria-modal="true" aria-labelledby="quiz-editor-title"><form data-quiz-editor-form novalidate><header class="quiz-modal__head"><div><span class="eyebrow">${editing ? "EDITAR PERGUNTAS" : "MONTAR QUIZ"}</span><h2 id="quiz-editor-title">${escapeHtml(basics.theme)}</h2><p>Cadastre uma pergunta por vez. Cada pergunta precisa de uma única resposta correta.</p></div><button class="icon-button" type="button" data-close-quiz-editor aria-label="Fechar">${icon("close", 19)}</button></header><main class="quiz-editor__body" data-quiz-editor-body>${questionEditor(questions[index], index, questions.length)}</main><footer class="modal__actions"><button class="button button--secondary" type="button" data-add-quiz-question>${icon("plus", 16)} Adicionar pergunta</button><span></span><button class="button button--ghost" type="button" data-close-quiz-editor>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} Finalizar quiz</button></footer><div class="quiz-inline-confirm" data-quiz-inline-confirm hidden></div></form></section></div>`;
}

function collectQuestion(form, current) {
  const statement = form.querySelector("[data-quiz-statement]").value;
  const alternatives = [...form.querySelectorAll("[data-quiz-alternative]")].map((row) => ({ id: row.dataset.alternativeId, text: row.querySelector("[data-quiz-alternative-text]").value }));
  const correctId = form.querySelector("[name=quiz-correct]:checked")?.value || "";
  return { ...current, statement, alternatives, correctId };
}

export function openQuizEditor({ quiz = null, authorName = "", onSave, onClosed }) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = quizBasicsModal(quiz);
  let basics = { theme: quiz?.tema || "", description: quiz?.descricao || "", public: quiz?.publico !== false, revealName: Boolean(quiz?.revelar_nome), authorName };
  let questions = questionsOf(quiz).length ? questionsOf(quiz).map((item) => ({ ...item, alternatives: [...item.alternatives] })) : [newQuestion()];
  let index = 0;
  let dirty = false;
  let saving = false;
  const close = (meta = {}) => { document.removeEventListener("keydown", onKeydown); closeModal(); onClosed?.(meta); };
  const requestClose = (host) => {
    if (saving) return;
    if (!dirty) return close();
    inlineConfirm(host, { title: "Salvar alterações antes de sair?", message: "As mudanças deste quiz ainda não foram salvas.", confirmLabel: "Salvar quiz", cancelLabel: "Descartar", onCancel: () => close({ discarded: true }), onConfirm: () => finish() });
  };
  const renderEditor = () => {
    modalRoot.innerHTML = quizEditorModal(basics, questions, index, Boolean(quiz));
    const form = modalRoot.querySelector("[data-quiz-editor-form]");
    const body = form.querySelector("[data-quiz-editor-body]");
    const persist = () => {
      questions[index] = collectQuestion(form, questions[index]);
      dirty = true;
    };
    const renderQuestion = () => {
      body.innerHTML = questionEditor(questions[index], index, questions.length);
      body.querySelector("[data-quiz-question-select]").addEventListener("change", (event) => {
        persist();
        index = Number(event.target.value);
        renderQuestion();
      });
      body.querySelector("[data-add-quiz-alternative]")?.addEventListener("click", () => {
        persist();
        if (questions[index].alternatives.length >= 6) return;
        questions[index].alternatives.push({ id: makeId("alternative"), text: "" });
        renderQuestion();
      });
      body.querySelectorAll("[data-remove-quiz-alternative]").forEach((button) => button.addEventListener("click", () => {
        persist();
        if (questions[index].alternatives.length <= 4) return;
        const id = button.closest("[data-quiz-alternative]").dataset.alternativeId;
        questions[index].alternatives = questions[index].alternatives.filter((item) => !same(item.id, id));
        if (same(questions[index].correctId, id)) questions[index].correctId = "";
        renderQuestion();
      }));
      body.querySelector("[data-delete-quiz-question]").addEventListener("click", () => {
        if (questions.length < 2) return;
        inlineConfirm(form, {
          title: "Apagar esta pergunta?",
          message: "A pergunta e suas alternativas serão removidas do quiz.",
          confirmLabel: "Apagar pergunta",
          tone: "button--danger",
          onConfirm: () => {
            questions.splice(index, 1);
            index = Math.max(0, index - 1);
            dirty = true;
            renderQuestion();
          },
        });
      });
    };
    form.addEventListener("input", () => { dirty = true; });
    form.addEventListener("change", () => { dirty = true; });
    form.querySelector("[data-add-quiz-question]").addEventListener("click", () => {
      persist();
      questions.push(newQuestion());
      index = questions.length - 1;
      renderQuestion();
    });
    form.querySelectorAll("[data-close-quiz-editor]").forEach((button) => button.addEventListener("click", () => requestClose(form)));
    form.addEventListener("submit", (event) => { event.preventDefault(); persist(); finish(); });
    modalRoot.querySelector("[data-quiz-editor-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) requestClose(form); });
    renderQuestion();
  };
  const finish = async () => {
    if (saving) return;
    const activeForm = modalRoot.querySelector("[data-quiz-editor-form]");
    if (activeForm) questions[index] = collectQuestion(activeForm, questions[index]);
    if (!basics.theme.trim()) return showToast("Informe o tema do quiz.", "error");
    if (!questions.every((question) => question.statement.trim() && question.alternatives.length >= 4 && question.alternatives.length <= 6 && question.alternatives.every((alternative) => alternative.text.trim()) && question.alternatives.some((alternative) => same(alternative.id, question.correctId)))) {
      return showToast("Preencha todas as perguntas e selecione a resposta correta de cada uma.", "error");
    }
    saving = true;
    const button = modalRoot.querySelector("[type=submit]");
    try {
      if (button) setButtonLoading(button, true);
      const saved = await onSave({ ...basics, questions });
      dirty = false;
      close({ saved, created: !quiz });
    } catch (error) {
      showToast(error.message || "Não foi possível salvar o quiz.", "error");
    } finally {
      saving = false;
      if (button && document.body.contains(button)) setButtonLoading(button, false);
    }
  };
  const renderBasics = () => {
    modalRoot.innerHTML = quizBasicsModal(quiz);
    const form = modalRoot.querySelector("[data-quiz-basics-form]");
    const visibility = form.querySelector("[data-quiz-public-select]");
    const reveal = form.querySelector("[data-quiz-reveal-name]");
    const read = () => ({ theme: form.elements.theme.value, description: form.elements.description.value, public: visibility.value === "public", revealName: form.elements.revealName.checked, authorName });
    form.addEventListener("input", () => { dirty = true; basics = read(); });
    visibility.addEventListener("change", () => { dirty = true; reveal.hidden = visibility.value !== "public"; if (reveal.hidden) form.elements.revealName.checked = false; basics = read(); });
    form.addEventListener("submit", (event) => { event.preventDefault(); if (!form.reportValidity()) return; basics = read(); dirty = true; renderEditor(); });
    form.querySelector("[data-save-quiz-basics]")?.addEventListener("click", () => {
      if (!form.reportValidity()) return;
      basics = read();
      finish();
    });
    form.querySelectorAll("[data-close-quiz-basics]").forEach((button) => button.addEventListener("click", () => requestClose(form)));
    modalRoot.querySelector("[data-quiz-basics-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) requestClose(form); });
  };
  const onKeydown = (event) => { if (event.key === "Escape") requestClose(modalRoot.querySelector("form")); };
  document.addEventListener("keydown", onKeydown);
  renderBasics();
}

function quizPlayModal(quiz) {
  return `<div class="modal-backdrop quiz-play-backdrop" data-quiz-play-backdrop><section class="modal modal--quiz-play" role="dialog" aria-modal="true" aria-labelledby="quiz-play-title"><header class="quiz-play__head"><div><span class="eyebrow">QUIZ EM ANDAMENTO</span><h2 id="quiz-play-title">${escapeHtml(quiz.tema)}</h2></div><button class="icon-button" type="button" data-close-quiz-play aria-label="Sair do quiz">${icon("close", 20)}</button></header><main data-quiz-play-stage></main></section></div>`;
}

function playExitModal() {
  return `<div class="modal-backdrop quiz-play-exit-backdrop" data-quiz-play-exit><section class="modal modal--quiz-play-exit" role="dialog" aria-modal="true"><div class="modal__symbol modal__symbol--danger">${icon("close", 21)}</div><h2>Sair deste quiz?</h2><p>As respostas desta tentativa não serão salvas se você abandonar agora.</p><footer class="modal__actions"><button class="button button--ghost" type="button" data-resume-quiz>Continuar respondendo</button><button class="button button--danger" type="button" data-abandon-quiz>Abandonar quiz</button></footer></section></div>`;
}

function answerCopy(question, answer) {
  const selected = question.alternatives.find((alternative) => same(alternative.id, answer?.selectedId));
  const correct = question.alternatives.find((alternative) => same(alternative.id, question.correctId));
  return { selected, correct, isCorrect: same(answer?.selectedId, question.correctId) };
}

export function openQuizPlay(quiz, { onFinish, onCompleted } = {}) {
  const questions = questionsOf(quiz).map((question) => ({ ...question, alternatives: shuffle(question.alternatives) }));
  if (!questions.length) return showToast("Este quiz ainda não tem perguntas válidas.", "error");
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = quizPlayModal(quiz);
  const stage = modalRoot.querySelector("[data-quiz-play-stage]");
  const answers = Array.from({ length: questions.length }, () => null);
  let index = 0;
  let selectedId = "";
  let saving = false;
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const render = () => {
    const question = questions[index];
    const answer = answers[index];
    const viewing = Boolean(answer);
    const copy = answerCopy(question, answer);
    stage.innerHTML = `<div class="quiz-play__progress"><span>Pergunta ${index + 1} de ${questions.length}</span><i><b style="width:${((index + (viewing ? 1 : 0)) / questions.length) * 100}%"></b></i></div><section class="quiz-play-question"><span>PERGUNTA ${index + 1}</span><h3>${escapeHtml(question.statement)}</h3><div class="quiz-play-alternatives">${question.alternatives.map((alternative, alternativeIndex) => `<button type="button" data-quiz-play-option="${escapeHtml(alternative.id)}" class="${viewing ? (same(alternative.id, question.correctId) ? "is-correct" : same(alternative.id, answer.selectedId) ? "is-incorrect" : "") : same(selectedId, alternative.id) ? "is-selected" : ""}" ${viewing ? "disabled" : ""}><b>${String.fromCharCode(65 + alternativeIndex)}</b><span>${escapeHtml(alternative.text)}</span></button>`).join("")}</div>${viewing ? `<div class="quiz-play-feedback ${copy.isCorrect ? "is-correct" : "is-incorrect"}">${icon(copy.isCorrect ? "check" : "info", 18)}<p><strong>${copy.isCorrect ? "Resposta correta!" : "Resposta incorreta"}</strong>${copy.isCorrect ? "" : `<span>A resposta correta é: ${escapeHtml(copy.correct?.text || "")}</span>`}</p></div>` : `<button class="button button--primary quiz-play-confirm" type="button" data-confirm-quiz-answer ${selectedId ? "" : "disabled"}>Confirmar resposta ${icon("check", 16)}</button>`}</section><footer class="quiz-play__actions"><button class="button button--ghost" type="button" data-quiz-play-previous ${index === 0 ? "hidden" : ""}>${icon("arrowLeft", 16)} Anterior</button><span></span>${viewing ? `<button class="button button--primary" type="button" data-quiz-play-next>${index === questions.length - 1 ? `${icon("check", 16)} Finalizar` : `Próxima ${icon("arrowRight", 16)}`}</button>` : ""}</footer>`;
    stage.querySelectorAll("[data-quiz-play-option]").forEach((button) => button.addEventListener("click", () => { selectedId = button.dataset.quizPlayOption; render(); }));
    stage.querySelector("[data-confirm-quiz-answer]")?.addEventListener("click", () => { if (!selectedId) return; answers[index] = { selectedId }; selectedId = ""; render(); });
    stage.querySelector("[data-quiz-play-previous]")?.addEventListener("click", () => { index -= 1; selectedId = ""; render(); });
    stage.querySelector("[data-quiz-play-next]")?.addEventListener("click", () => { if (index === questions.length - 1) finish(); else { index += 1; selectedId = ""; render(); } });
  };
  const finish = async () => {
    if (saving) return;
    saving = true;
    const items = questions.map((question, questionIndex) => {
      const copy = answerCopy(question, answers[questionIndex]);
      return { questionId: question.id, statement: question.statement, selectedOptionId: copy.selected?.id || null, selectedText: copy.selected?.text || "", correctOptionId: copy.correct?.id || null, correctText: copy.correct?.text || "", isCorrect: copy.isCorrect };
    });
    const correctCount = items.filter((item) => item.isCorrect).length;
    const result = { totalQuestions: items.length, correctCount, incorrectCount: items.length - correctCount, percentage: Math.round((correctCount / items.length) * 100), questions: items };
    try {
      const saved = await onFinish?.(result);
      document.removeEventListener("keydown", onKeydown);
      modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal modal--quiz-complete" role="dialog" aria-modal="true"><div class="modal__symbol">${icon("check", 22)}</div><h2>Quiz finalizado!</h2><p>Você acertou <strong>${correctCount}</strong> de ${items.length} perguntas e alcançou <strong>${result.percentage}%</strong>.</p><footer class="modal__actions"><button class="button button--secondary" type="button" data-quiz-complete-result>Ver resultado</button><button class="button button--primary" type="button" data-close-quiz-complete>Concluir</button></footer></section></div>`;
      modalRoot.querySelector("[data-close-quiz-complete]").addEventListener("click", () => { closeModal(); onCompleted?.(saved); });
      modalRoot.querySelector("[data-quiz-complete-result]").addEventListener("click", () => { closeModal(); onCompleted?.(saved, { openResult: true }); });
    } catch (error) {
      saving = false;
      showToast(error.message || "Não foi possível salvar o resultado.", "error");
    }
  };
  const requestClose = () => {
    if (modalRoot.querySelector("[data-quiz-play-exit]")) return;
    modalRoot.insertAdjacentHTML("beforeend", playExitModal());
    const exit = modalRoot.querySelector("[data-quiz-play-exit]");
    exit.querySelector("[data-resume-quiz]").addEventListener("click", () => exit.remove());
    exit.querySelector("[data-abandon-quiz]").addEventListener("click", close);
  };
  const onKeydown = () => {};
  modalRoot.querySelector("[data-close-quiz-play]").addEventListener("click", requestClose);
  render();
}

export function openQuizResult(quiz, result) {
  const data = resultData(result);
  if (!data) return showToast("Este resultado não está disponível.", "error");
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = `<div class="modal-backdrop" data-quiz-result-backdrop><section class="modal modal--quiz-result" role="dialog" aria-modal="true" aria-labelledby="quiz-result-title"><header class="quiz-modal__head"><div><span class="eyebrow">RESULTADO DO QUIZ</span><h2 id="quiz-result-title">${escapeHtml(quiz?.tema || data.quizTheme || "Quiz")}</h2><p>${data.correctCount ?? 0} acertos em ${data.totalQuestions ?? 0} perguntas · ${data.percentage ?? 0}%</p></div><button class="icon-button" type="button" data-close-quiz-result aria-label="Fechar">${icon("close", 19)}</button></header><main class="quiz-result__body">${(data.questions || []).map((question, index) => `<article class="quiz-result-question ${question.isCorrect ? "is-correct" : "is-incorrect"}"><header><span>${question.isCorrect ? icon("check", 16) : icon("info", 16)}</span><strong>Pergunta ${index + 1}</strong></header><h3>${escapeHtml(question.statement || "Pergunta")}</h3><p><small>SUA RESPOSTA</small><b>${escapeHtml(question.selectedText || "Não respondida")}</b></p>${question.isCorrect ? "" : `<p><small>RESPOSTA CORRETA</small><b>${escapeHtml(question.correctText || "")}</b></p>`}</article>`).join("")}</main><footer class="modal__actions"><button class="button button--primary" type="button" data-close-quiz-result>Concluir</button></footer></section></div>`;
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-quiz-result]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-quiz-result-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
}

export function openQuizDetails(quiz, { result = null, isOwner = false, onEdit, onDelete, onStart, onViewResult } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = detailsModal(quiz, { isOwner, result });
  const dialog = modalRoot.querySelector(".modal--quiz-details");
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelector("[data-close-quiz-details]").addEventListener("click", close);
  modalRoot.querySelector("[data-quiz-details-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  modalRoot.querySelector("[data-start-quiz]").addEventListener("click", () => { close(); onStart?.(quiz); });
  modalRoot.querySelector("[data-view-quiz-result]")?.addEventListener("click", () => { close(); onViewResult?.(quiz, result); });
  modalRoot.querySelector("[data-edit-quiz]")?.addEventListener("click", () => { close(); onEdit?.(quiz); });
  modalRoot.querySelector("[data-delete-quiz]")?.addEventListener("click", () => inlineConfirm(dialog, { title: "Apagar este quiz?", message: "As perguntas e os resultados associados serão removidos definitivamente.", confirmLabel: "Apagar quiz", tone: "button--danger", onConfirm: async () => { try { await onDelete?.(quiz); close(); } catch (error) { showToast(error.message || "Não foi possível apagar o quiz.", "error"); } } }));
}

export function bindQuizzes(root, { mode, publicQuizzes, myQuizzes, results, onCreate, onMine, onResults, onPublic, onOpen }) {
  root.querySelectorAll("[data-create-quiz]").forEach((button) => button.addEventListener("click", onCreate));
  root.querySelectorAll("[data-quiz-mine]").forEach((button) => button.addEventListener("click", onMine));
  root.querySelectorAll("[data-quiz-results]").forEach((button) => button.addEventListener("click", onResults));
  root.querySelectorAll("[data-quiz-public]").forEach((button) => button.addEventListener("click", onPublic));
  root.querySelectorAll("[data-open-quiz]").forEach((button) => button.addEventListener("click", () => {
    const quiz = [...myQuizzes, ...publicQuizzes].find((item) => same(item.id, button.dataset.openQuiz));
    if (quiz) onOpen?.(quiz);
  }));
  root.querySelectorAll("[data-view-quiz-result]").forEach((button) => button.addEventListener("click", () => {
    const result = results.find((item) => same(item.quiz, button.dataset.viewQuizResult));
    const quiz = [...myQuizzes, ...publicQuizzes].find((item) => same(item.id, button.dataset.viewQuizResult));
    if (result) onOpen?.(quiz || { id: result.quiz, tema: resultData(result)?.quizTheme }, result);
  }));
  const search = root.querySelector("[data-quiz-search-input]");
  const empty = root.querySelector("[data-quiz-search-empty]");
  const count = root.querySelector("[data-quiz-count]");
  const initialEmpty = root.querySelector(".quizzes-empty");
  const apply = () => {
    const words = normalize(search?.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    root.querySelectorAll("[data-open-quiz], [data-view-quiz-result]").forEach((card) => {
      const match = !words.length || words.every((word) => (card.dataset.quizSearch || "").includes(word));
      card.hidden = !match;
      if (match) visible += 1;
    });
    if (count) count.textContent = `${visible} ${visible === 1 ? "quiz" : "quizzes"}`;
    if (initialEmpty) initialEmpty.hidden = Boolean(words.length);
    if (empty) empty.hidden = visible > 0 || !words.length;
  };
  search?.addEventListener("input", apply);
}
