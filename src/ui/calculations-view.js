import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, setButtonLoading, showToast } from "./components.js";

const SIZES = {
  small: { label: "Pequenas", detail: "Uma etapa objetiva", steps: 1 },
  medium: { label: "Médias", detail: "Duas etapas conectadas", steps: 2 },
  large: { label: "Grandes", detail: "Três etapas e mais símbolos", steps: 3 },
};

const OPERAND_LIMIT = 12;
const MAX_EXPRESSION_VALUE = 1000000;

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomPick = (items) => items[randomInt(0, items.length - 1)];
const nonZero = (min, max) => {
  let value = 0;
  while (!value) value = randomInt(min, max);
  return value;
};
const signed = (value) => value < 0 ? `− ${Math.abs(value)}` : `+ ${value}`;
const displayNumber = (value) => value < 0 ? `−${Math.abs(value)}` : String(value);

function baseOperand() {
  const value = nonZero(-OPERAND_LIMIT, OPERAND_LIMIT);
  return { type: "operand", value, prompt: displayNumber(value), precedence: 3 };
}

function powerOperand(maxPower) {
  const powerLimit = Math.min(6, Math.max(2, Number(maxPower) || 3));
  const base = randomPick([-4, -3, -2, 2, 3, 4]);
  const power = randomInt(2, powerLimit);
  const value = base ** power;
  return { type: "operand", value, prompt: `(${displayNumber(base)})${power === 2 ? "²" : power === 3 ? "³" : `<sup>${power}</sup>`}`, precedence: 3 };
}

function squareRootOperand() {
  const root = randomInt(2, OPERAND_LIMIT);
  return { type: "operand", value: root, prompt: `√${root ** 2}`, precedence: 3 };
}

function factorialOperand() {
  const number = randomInt(2, 5);
  let value = 1;
  for (let index = 2; index <= number; index += 1) value *= index;
  return { type: "operand", value, prompt: `${number}!`, precedence: 3 };
}

function specialOperandFactories(rules) {
  const factories = [];
  if (rules.power) factories.push(() => powerOperand(rules.maxPower));
  if (rules.squareRoot) factories.push(squareRootOperand);
  if (rules.factorial) factories.push(factorialOperand);
  return factories;
}

function expressionOperand(rules) {
  const specialFactories = specialOperandFactories(rules);
  const factories = [baseOperand, ...specialFactories];
  return randomPick(factories)();
}

function combineExpression(left, right, operation) {
  if (operation === "divide") {
    const product = { type: "binary", operation: "multiply", left, right, value: left.value * right.value, precedence: 2 };
    return { type: "binary", operation: "divide", left: product, right, value: left.value, precedence: 2 };
  }
  const value = operation === "add" ? left.value + right.value
    : operation === "subtract" ? left.value - right.value
      : left.value * right.value;
  return { type: "binary", operation, left, right, value, precedence: operation === "multiply" ? 2 : 1 };
}

const OPERATION_SYMBOLS = { add: "+", subtract: "−", multiply: "·", divide: "÷" };

function formatExpression(node, parentPrecedence = 0, position = "") {
  if (node.type === "operand") return node.prompt;
  const left = formatExpression(node.left, node.precedence, "left");
  const right = formatExpression(node.right, node.precedence, "right");
  const expression = `${left} ${OPERATION_SYMBOLS[node.operation]} ${right}`;
  const requiresParentheses = node.precedence < parentPrecedence
    || (position === "right" && node.precedence === parentPrecedence && ["subtract", "divide"].includes(node.operation))
    || (position === "right" && node.operation === "divide" && parentPrecedence === 2);
  return requiresParentheses ? `(${expression})` : expression;
}

function compoundExpression(size, rules) {
  const requiredOperands = specialOperandFactories(rules).map((factory) => factory());
  const configuredSteps = SIZES[size]?.steps || SIZES.small.steps;
  const steps = Math.max(configuredSteps, requiredOperands.length - 1);
  let current = requiredOperands.shift() || expressionOperand(rules);
  for (let step = 0; step < steps; step += 1) {
    const requiredOperand = requiredOperands[0] || null;
    let next = null;
    for (let attempt = 0; attempt < 24 && !next; attempt += 1) {
      const candidate = combineExpression(
        current,
        requiredOperand || expressionOperand(rules),
        randomPick(["add", "subtract", "multiply", "divide"]),
      );
      if (candidate.value !== 0 && Number.isSafeInteger(candidate.value) && Math.abs(candidate.value) <= MAX_EXPRESSION_VALUE) next = candidate;
    }
    if (requiredOperand) requiredOperands.shift();
    current = next || combineExpression(
      current,
      requiredOperand || (current.value === -1 ? { type: "operand", value: 2, prompt: "2", precedence: 3 } : { type: "operand", value: 1, prompt: "1", precedence: 3 }),
      "add",
    );
  }
  return current;
}

function expressionQuestion(size, rules) {
  const expression = compoundExpression(size, rules);
  const prompt = formatExpression(expression);
  return {
    prompt,
    answer: expression.value,
    solution: `${prompt} = ${displayNumber(expression.value)}`,
  };
}

function equationQuestion(size, rules) {
  const right = compoundExpression(size, rules);
  const rightPrompt = formatExpression(right);
  const coefficient = randomInt(2, 5);
  const variable = nonZero(-OPERAND_LIMIT, OPERAND_LIMIT);
  const constant = right.value - coefficient * variable;
  return {
    prompt: `${coefficient}x ${signed(constant)} = ${rightPrompt}`,
    answer: variable,
    solution: `${coefficient}x = ${rightPrompt} ${constant < 0 ? "+" : "−"} ${Math.abs(constant)}; x = ${displayNumber(variable)}`,
  };
}

function generateQuestion(settings) {
  const rules = settings.rules || {};
  const useEquation = Boolean(rules.equations);
  const question = useEquation
    ? equationQuestion(settings.size, rules)
    : expressionQuestion(settings.size, rules);
  const answerMode = settings.answerMode === "both" ? randomPick(["written", "choices"]) : settings.answerMode;
  return { ...question, answerMode };
}

function alternativesFor(answer) {
  const options = new Set([answer]);
  const spread = Math.max(3, Math.min(100, Math.abs(answer) + 3));
  while (options.size < 4) {
    const delta = nonZero(-spread, spread);
    options.add(answer + delta);
  }
  const values = [...options];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const other = randomInt(0, index);
    [values[index], values[other]] = [values[other], values[index]];
  }
  return values;
}

function calculationStats(data) {
  return data?.games?.calculations || {
    totalCorrect: 0, totalIncorrect: 0, highestScore: 0, totalGames: 0, longestStreak: 0,
  };
}

export function calculationsView({ data }) {
  const stats = calculationStats(data);
  const cards = [
    ["Acertos", stats.totalCorrect, "check"],
    ["Erros", stats.totalIncorrect, "close"],
    ["Pontuação máxima", stats.highestScore, "sparkles"],
    ["Jogos realizados", stats.totalGames, "calculator"],
    ["Maior sequência", stats.longestStreak, "flashcards"],
  ];
  return `<section class="page calculations-page"><section class="calculations-stats">${cards.map(([label, value, iconName]) => `<article><span>${icon(iconName, 19)}</span><small>${label}</small><strong>${escapeHtml(value)}</strong></article>`).join("")}</section><section class="calculations-start"><div><span>${icon("calculator", 27)}</span><div><small>PRONTO PARA JOGAR?</small><h2>Transforme revisão em prática.</h2><p>Continue resolvendo desafios com soluções inteiras até cometer um erro.</p></div></div><button class="button button--primary calculations-start__button" type="button" data-start-calculations>${icon("sparkles", 18)} Iniciar jogo</button></section></section>`;
}

function setupModal() {
  return `<div class="modal-backdrop" data-calculations-setup-backdrop><section class="modal modal--calculations-setup" role="dialog" aria-modal="true" aria-labelledby="calculations-setup-title"><form data-calculations-setup><header class="calculations-modal__head"><div><span class="eyebrow">CONFIGURAR PARTIDA</span><h2 id="calculations-setup-title">Seu desafio de cálculos</h2><p>Escolha a complexidade, a resposta e as regras que quer praticar.</p></div><button class="icon-button" type="button" data-close-calculations-setup aria-label="Fechar">${icon("close", 19)}</button></header><div class="calculations-setup__body"><fieldset><legend>Tamanho das contas e equações</legend><div class="calculations-choice-grid">${Object.entries(SIZES).map(([id, size]) => `<label class="calculations-choice"><input type="radio" name="size" value="${id}" ${id === "small" ? "checked" : ""}/><span><strong>${size.label}</strong><small>${size.detail}</small></span></label>`).join("")}</div></fieldset><fieldset><legend>Tipo de resposta</legend><div class="calculations-choice-grid calculations-choice-grid--answer"><label class="calculations-choice"><input type="radio" name="answerMode" value="written" checked/><span><strong>Escrita</strong><small>Digite o resultado.</small></span></label><label class="calculations-choice"><input type="radio" name="answerMode" value="choices"/><span><strong>Alternativas</strong><small>Escolha entre quatro respostas.</small></span></label><label class="calculations-choice"><input type="radio" name="answerMode" value="both"/><span><strong>Ambas</strong><small>Alternado aleatoriamente em cada conta.</small></span></label></div></fieldset><fieldset class="calculations-rules"><legend>Regras do jogo</legend><p>Ative recursos extras. As questões são combinadas de forma válida e sempre têm solução inteira.</p><div class="calculations-rules__list"><label><span><i>${icon("sparkles", 17)}</i><b>Potência <small>Inclui exponenciação.</small></b></span><span class="switch"><input type="checkbox" name="power" data-calculation-power/><i></i></span></label><label class="calculations-power-limit" data-calculation-power-limit hidden><span><i>${icon("calculator", 17)}</i><b>Maior potência permitida <small>Define o maior expoente.</small></b></span><select name="maxPower"><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select></label><label><span><i>${icon("calculator", 17)}</i><b>Raiz quadrada <small>Inclui radiciação exata.</small></b></span><span class="switch"><input type="checkbox" name="squareRoot"/><i></i></span></label><label><span><i>${icon("note", 17)}</i><b>Equações <small>Inclui equações com variável x.</small></b></span><span class="switch"><input type="checkbox" name="equations"/><i></i></span></label><label><span><i>${icon("sparkles", 17)}</i><b>Exponencial <small>Inclui fatorial, usando !.</small></b></span><span class="switch"><input type="checkbox" name="factorial"/><i></i></span></label></div></fieldset></div><footer class="modal__actions"><button class="button button--ghost" type="button" data-close-calculations-setup>Cancelar</button><button class="button button--primary" type="submit">${icon("sparkles", 16)} Começar partida</button></footer></form></section></div>`;
}

function readSettings(form) {
  const data = new FormData(form);
  return {
    size: ["small", "medium", "large"].includes(data.get("size")) ? data.get("size") : "small",
    answerMode: ["written", "choices", "both"].includes(data.get("answerMode")) ? data.get("answerMode") : "written",
    rules: {
      power: data.get("power") === "on",
      squareRoot: data.get("squareRoot") === "on",
      equations: data.get("equations") === "on",
      factorial: data.get("factorial") === "on",
      maxPower: Math.min(6, Math.max(2, Number(data.get("maxPower")) || 3)),
    },
  };
}

function powerSettingsModal(value) {
  return `<div class="modal-backdrop calculations-power-backdrop" data-calculation-power-backdrop><section class="modal modal--calculations-power" role="dialog" aria-modal="true" aria-labelledby="calculation-power-title"><header class="calculations-modal__head"><div><span class="eyebrow">POTÊNCIA</span><h2 id="calculation-power-title">Maior potência permitida</h2><p>Escolha o expoente máximo que poderá aparecer nas contas.</p></div><button class="icon-button" type="button" data-close-calculation-power aria-label="Fechar">${icon("close", 19)}</button></header><div class="calculations-power-modal__body"><label class="field"><span>Expoente máximo</span><span class="field__control">${icon("calculator", 18)}<select data-calculation-power-value><option value="2" ${value === 2 ? "selected" : ""}>2</option><option value="3" ${value === 3 ? "selected" : ""}>3</option><option value="4" ${value === 4 ? "selected" : ""}>4</option><option value="5" ${value === 5 ? "selected" : ""}>5</option><option value="6" ${value === 6 ? "selected" : ""}>6</option></select></span></label></div><footer class="modal__actions"><button class="button button--ghost" type="button" data-close-calculation-power>Cancelar</button><button class="button button--primary" type="button" data-save-calculation-power>Salvar potência</button></footer></section></div>`;
}

function openPowerSettings(modalRoot, currentValue, onSave) {
  modalRoot.querySelector("[data-calculation-power-backdrop]")?.remove();
  modalRoot.insertAdjacentHTML("beforeend", powerSettingsModal(currentValue));
  const backdrop = modalRoot.querySelector("[data-calculation-power-backdrop]");
  const close = () => backdrop.remove();
  backdrop.querySelectorAll("[data-close-calculation-power]").forEach((button) => button.addEventListener("click", close));
  backdrop.addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  backdrop.querySelector("[data-save-calculation-power]").addEventListener("click", () => {
    onSave(Number(backdrop.querySelector("[data-calculation-power-value]").value));
    close();
  });
}

export function openCalculationsSetup({ onStart } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = setupModal();
  const form = modalRoot.querySelector("[data-calculations-setup]");
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => {
    if (event.key !== "Escape") return;
    const powerBackdrop = modalRoot.querySelector("[data-calculation-power-backdrop]");
    if (powerBackdrop) return powerBackdrop.remove();
    close();
  };
  document.addEventListener("keydown", onKeydown);
  const power = form.querySelector("[data-calculation-power]");
  const limit = form.querySelector("[data-calculation-power-limit]");
  const savedPowerLimit = document.createElement("input");
  savedPowerLimit.type = "hidden";
  savedPowerLimit.name = "maxPower";
  savedPowerLimit.value = limit.querySelector("select").value;
  limit.replaceWith(savedPowerLimit);
  const powerLabel = power.closest("label");
  const powerRow = document.createElement("div");
  powerRow.className = `${powerLabel.className} calculations-rule`;
  while (powerLabel.firstChild) powerRow.append(powerLabel.firstChild);
  powerLabel.replaceWith(powerRow);
  const switchControl = powerRow.querySelector(".switch");
  const powerActions = document.createElement("span");
  powerActions.className = "calculations-power-actions";
  switchControl.before(powerActions);
  powerActions.append(switchControl);
  powerActions.insertAdjacentHTML("afterbegin", `<button class="icon-button calculations-power-settings" type="button" data-open-calculation-power aria-label="Configurar maior potência" hidden>${icon("settings", 17)}</button>`);
  const powerSettings = powerActions.querySelector("[data-open-calculation-power]");
  const syncPowerControls = () => { powerSettings.hidden = !power.checked; };
  power.addEventListener("change", syncPowerControls);
  switchControl.addEventListener("click", (event) => {
    if (event.target === power) return;
    event.preventDefault();
    event.stopPropagation();
    power.checked = !power.checked;
    power.dispatchEvent(new Event("change", { bubbles: true }));
  });
  powerSettings.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPowerSettings(modalRoot, Number(savedPowerLimit.value), (value) => { savedPowerLimit.value = String(value); });
  });
  syncPowerControls();
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const settings = readSettings(form);
    close();
    window.setTimeout(() => openCalculationsGame(settings, { onFinished: onStart }), 0);
  });
  modalRoot.querySelectorAll("[data-close-calculations-setup]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-calculations-setup-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
}

function gameModal() {
  return `<div class="modal-backdrop calculations-game-backdrop" data-calculations-game-backdrop><section class="modal modal--calculations-game" role="dialog" aria-modal="true" aria-labelledby="calculations-game-title"><header class="calculations-game__head"><div><span class="eyebrow">PARTIDA EM ANDAMENTO</span><h2 id="calculations-game-title">Cálculos</h2></div><div><strong data-calculations-score>0 pts</strong><button class="icon-button" type="button" data-close-calculations-game aria-label="Encerrar partida">${icon("close", 19)}</button></div></header><main><div class="calculations-game__progress"><span data-calculations-progress>Questão 1</span><span data-calculations-streak>Sequência: 0</span></div><section class="calculations-question" data-calculations-question></section></main></section></div>`;
}

function exitGameModal() {
  return `<div class="modal-backdrop calculations-game-exit-backdrop" data-calculations-game-exit><section class="modal modal--calculations-game-exit" role="dialog" aria-modal="true" aria-labelledby="calculations-game-exit-title"><div class="modal__symbol modal__symbol--danger">${icon("close", 21)}</div><h2 id="calculations-game-exit-title">Abandonar a partida?</h2><p>Seu progresso desta partida ainda não foi salvo. Você pode voltar e continuar exatamente de onde parou.</p><footer class="modal__actions"><button class="button button--ghost" type="button" data-resume-calculations-game>Voltar à partida</button><button class="button button--danger" type="button" data-abandon-calculations-game>Abandonar</button></footer></section></div>`;
}

function renderQuestion(root, question, game) {
  const alternatives = question.answerMode === "choices" ? alternativesFor(question.answer) : [];
  root.innerHTML = `<span class="calculations-question__type">${question.answerMode === "choices" ? "ESCOLHA A RESPOSTA" : "DIGITE A RESPOSTA"}</span><div class="calculations-question__formula">${question.prompt}</div><p>Qual é o resultado?</p>${question.answerMode === "choices" ? `<div class="calculations-alternatives">${alternatives.map((answer) => `<button type="button" data-calculation-answer="${answer}">${displayNumber(answer)}</button>`).join("")}</div><button class="button button--primary calculations-confirm-answer" type="button" data-confirm-calculation disabled>Confirmar resposta ${icon("check", 16)}</button>` : `<form class="calculations-written" data-calculations-answer-form><label class="field"><span class="visually-hidden">Resposta</span><span class="field__control">${icon("calculator", 18)}<input name="answer" inputmode="numeric" autocomplete="off" placeholder="Digite um número inteiro" required autofocus/></span></label><button class="button button--primary" type="submit">Responder ${icon("arrowRight", 16)}</button></form>`}<div class="calculations-feedback" data-calculations-feedback hidden></div>`;
  const respond = (value) => answerQuestion(root, question, game, value);
  const choiceButtons = [...root.querySelectorAll("[data-calculation-answer]")];
  const confirmButton = root.querySelector("[data-confirm-calculation]");
  let selectedAnswer = null;
  choiceButtons.forEach((button) => button.addEventListener("click", () => {
    selectedAnswer = Number(button.dataset.calculationAnswer);
    choiceButtons.forEach((item) => item.classList.toggle("is-selected", item === button));
    confirmButton.disabled = false;
  }));
  confirmButton?.addEventListener("click", () => { if (selectedAnswer !== null) respond(selectedAnswer); });
  root.querySelector("[data-calculations-answer-form]")?.addEventListener("submit", (event) => { event.preventDefault(); const value = Number(new FormData(event.currentTarget).get("answer")); if (!Number.isInteger(value)) return showToast("Digite um número inteiro.", "error"); respond(value); });
}

function answerQuestion(root, question, game, answer) {
  if (game.answered) return;
  game.answered = true;
  const correct = answer === question.answer;
  if (correct) {
    game.correct += 1;
    game.streak += 1;
    game.largestStreak = Math.max(game.largestStreak, game.streak);
    game.score += 100 + (game.streak - 1) * 20;
  } else {
    game.incorrect += 1;
    game.streak = 0;
    game.ended = true;
  }
  root.querySelectorAll("[data-calculation-answer], [data-confirm-calculation], [data-calculations-answer-form] input, [data-calculations-answer-form] button").forEach((element) => { element.disabled = true; });
  root.querySelectorAll("[data-calculation-answer]").forEach((button) => {
    const value = Number(button.dataset.calculationAnswer);
    button.classList.toggle("is-correct", value === question.answer);
    button.classList.toggle("is-incorrect", value === answer && !correct);
  });
  const feedback = root.querySelector("[data-calculations-feedback]");
  feedback.hidden = false;
  feedback.innerHTML = `<span>${icon(correct ? "check" : "info", 19)}</span><div><strong>${correct ? "Resposta correta!" : `A resposta é ${displayNumber(question.answer)}.`}</strong><p>${question.solution}</p></div><button class="button button--primary button--small" type="button" data-next-calculation>${correct ? `Próxima ${icon("arrowRight", 15)}` : "Finalizar partida"}</button>`;
  feedback.querySelector("[data-next-calculation]").addEventListener("click", () => game.next());
  game.sync();
}

export function openCalculationsGame(settings, { onFinished } = {}) {
  const modalRoot = document.querySelector("#modal-root");
  modalRoot.innerHTML = gameModal();
  const questionRoot = modalRoot.querySelector("[data-calculations-question]");
  const score = modalRoot.querySelector("[data-calculations-score]");
  const progress = modalRoot.querySelector("[data-calculations-progress]");
  const streak = modalRoot.querySelector("[data-calculations-streak]");
  const game = {
    index: 0, correct: 0, incorrect: 0, score: 0, streak: 0, largestStreak: 0, answered: false, ended: false, finishing: false,
    sync() {
      score.textContent = `${this.score} pts`;
      progress.textContent = `Questão ${this.index + 1}`;
      streak.textContent = `Sequência: ${this.streak}`;
    },
    next() {
      if (this.ended) return finish();
      this.index += 1;
      this.answered = false;
      this.question = generateQuestion(settings);
      renderQuestion(questionRoot, this.question, this);
      this.sync();
    },
  };
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const finish = async () => {
    if (game.finishing) return;
    game.finishing = true;
    const result = { score: game.score, correct: game.correct, incorrect: game.incorrect, largestStreak: game.largestStreak, totalQuestions: game.correct + game.incorrect, settings };
    const button = questionRoot.querySelector("[data-next-calculation]");
    try {
      if (button) setButtonLoading(button, true);
      await onFinished?.(result);
      close();
      showToast(`Partida concluída: ${game.correct} acertos e ${game.score} pontos.`);
    } catch (error) {
      game.finishing = false;
      if (button) setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar esta partida.", "error");
    }
  };
  const requestClose = () => {
    if (modalRoot.querySelector("[data-calculations-game-exit]")) return;
    modalRoot.insertAdjacentHTML("beforeend", exitGameModal());
    const exitModal = modalRoot.querySelector("[data-calculations-game-exit]");
    exitModal.querySelector("[data-resume-calculations-game]").addEventListener("click", () => exitModal.remove());
    exitModal.querySelector("[data-abandon-calculations-game]").addEventListener("click", close);
  };
  const onKeydown = () => {};
  modalRoot.querySelector("[data-close-calculations-game]").addEventListener("click", requestClose);
  game.question = generateQuestion(settings);
  renderQuestion(questionRoot, game.question, game);
  game.sync();
}

export function bindCalculations(root, { onStart } = {}) {
  root.querySelector("[data-start-calculations]")?.addEventListener("click", () => openCalculationsSetup({ onStart }));
}
