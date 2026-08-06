import { icon } from "../utils/icons.js";
import { chronogramKind } from "../services/chronogram.js";
import { escapeHtml } from "../utils/formatters.js";
import { closeModal, confirmModal, setButtonLoading, showToast } from "./components.js";

const KIND_META = {
  normal: { label: "Aula normal", short: "AULA", icon: "book" },
  holiday: { label: "Feriado", short: "FERIADO", icon: "calendar" },
  exam: { label: "Prova", short: "PROVA", icon: "check" },
  presentation: { label: "Apresentação", short: "APRESENTAÇÃO", icon: "graduation" },
};

function entryValues(entry) {
  return entry ? { dateTime: entry.data_hora, topic: entry.tema || "", kind: chronogramKind(entry) } : { dateTime: "", topic: "", kind: "normal" };
}

function sameDateTime(first, second) {
  return Math.abs(new Date(first).valueOf() - new Date(second).valueOf()) < 60000;
}

function kindSwitches(selected) {
  return `<div class="chronogram-kind-switches" role="radiogroup" aria-label="Tipo de aula">${Object.entries(KIND_META).map(([kind, meta]) => `<label class="chronogram-kind-switch chronogram-kind-switch--${kind}"><input type="radio" name="kind" value="${kind}" ${selected === kind ? "checked" : ""}/><span><i></i>${icon(meta.icon, 15)}</span><strong>${meta.label}</strong></label>`).join("")}</div>`;
}

function isUsedByAnotherEntry(values, usedDates, occurrence) {
  return usedDates.some((date) => sameDateTime(date, occurrence.value))
    && !sameDateTime(values.dateTime, occurrence.value);
}

function occurrencesSelect(values, occurrences, usedDates) {
  const available = occurrences.filter((occurrence) => !isUsedByAnotherEntry(values, usedDates, occurrence));
  const selectedValue = values.dateTime || available[0]?.value || occurrences[0]?.value || "";
  return `<label class="field"><span>Data e horário da aula</span><span class="field__control">${icon("calendar", 17)}<select name="dateTime" required ${available.length ? "" : "disabled"}><option value="" disabled ${selectedValue ? "" : "selected"}>Selecione uma aula do horário</option>${occurrences.map((occurrence) => {
    const selected = sameDateTime(occurrence.value, selectedValue);
    const unavailable = isUsedByAnotherEntry(values, usedDates, occurrence);
    return `<option value="${occurrence.value}" ${selected ? "selected" : ""} ${unavailable ? "disabled" : ""}>${escapeHtml(occurrence.label)}${unavailable ? " · já registrada" : ""}</option>`;
  }).join("")}</select></span>${available.length ? "" : "<small>Não há mais aulas disponíveis para registrar neste período.</small>"}</label>`;
}

function editorModal(entry, discipline, occurrences, usedDates) {
  const editing = Boolean(entry);
  const values = entryValues(entry);
  const available = occurrences.some((occurrence) => !isUsedByAnotherEntry(values, usedDates, occurrence));
  return `<div class="modal-backdrop" data-chronogram-editor-backdrop><section class="modal modal--chronogram-editor" role="dialog" aria-modal="true" aria-labelledby="chronogram-editor-title"><form class="chronogram-editor" data-chronogram-editor novalidate>
    <div class="chronogram-editor__head"><div><span class="eyebrow">${editing ? "EDITAR AULA" : "CADASTRAR AULA"}</span><h2 id="chronogram-editor-title">${escapeHtml(discipline.nome_disciplina)}</h2><p>${editing ? "Atualize os detalhes desta aula." : "Você pode registrar várias aulas sem fechar este formulário."}</p></div><button class="icon-button" type="button" data-close-chronogram-editor aria-label="Fechar">${icon("close", 19)}</button></div>
    <input type="hidden" name="disciplineId" value="${escapeHtml(discipline.id)}"/>
    <div class="chronogram-editor__fields">${occurrencesSelect(values, occurrences, usedDates)}<label class="field"><span>Tema da aula</span><span class="field__control">${icon("book", 17)}<input name="topic" maxlength="180" value="${escapeHtml(values.topic)}" placeholder="Ex.: Derivadas e aplicações" required /></span></label><div class="field"><span>Tipo de aula</span>${kindSwitches(values.kind)}</div></div>
    <div class="chronogram-editor__actions">${editing ? `<button class="button button--danger" type="button" data-delete-chronogram>${icon("trash", 16)} Excluir</button>` : ""}<span></span><button class="button button--ghost" type="button" data-close-chronogram-editor>Cancelar</button><button class="button button--primary" type="submit" ${available ? "" : "disabled"}>${icon(editing ? "save" : "plus", 16)} ${editing ? "Salvar aula" : "Salvar e adicionar outra"}</button></div>
  </form></section></div>`;
}

function openChronogramEditor(entry, discipline, occurrences, initialUsedDates, onCreate, onUpdate, onDelete) {
  const modalRoot = document.querySelector("#modal-root");
  const usedDates = [...initialUsedDates];
  modalRoot.innerHTML = editorModal(entry, discipline, occurrences, usedDates);
  const close = () => { document.removeEventListener("keydown", onKeydown); closeModal(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.querySelectorAll("[data-close-chronogram-editor]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-chronogram-editor-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
  modalRoot.querySelector("[data-delete-chronogram]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const confirmed = await confirmModal({ title: "Excluir esta aula?", message: "O registro será removido do cronograma.", confirmLabel: "Excluir aula", tone: "danger" });
    if (!confirmed) return;
    try { setButtonLoading(button, true); await onDelete(entry); close(); }
    catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível excluir a aula.", "error"); }
  });
  modalRoot.querySelector("[data-chronogram-editor]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      const saved = entry ? await onUpdate(entry.id, values) : await onCreate(values);
      if (entry) { close(); return; }
      usedDates.push(saved.data_hora);
      const dateSelect = form.querySelector("[name=dateTime]");
      const selected = [...dateSelect.options].find((option) => option.value && sameDateTime(option.value, saved.data_hora));
      if (selected) selected.disabled = true;
      const next = [...dateSelect.options].find((option) => option.value && !option.disabled);
      form.querySelector("[name=topic]").value = "";
      form.querySelector("[name=kind][value=normal]").checked = true;
      if (next) dateSelect.value = next.value;
      else button.disabled = true;
      setButtonLoading(button, false);
      showToast("Aula adicionada. Você pode registrar outra agora.");
    } catch (error) { setButtonLoading(button, false); showToast(error.message || "Não foi possível salvar a aula.", "error"); }
  });
  modalRoot.querySelector("input[name=topic]")?.focus();
}

function disciplineCards(disciplines, entries) {
  if (!disciplines.length) return `<div class="chronogram-empty"><span>${icon("book", 28)}</span><h3>Nenhuma disciplina cadastrada</h3><p>Cadastre disciplinas antes de organizar o cronograma das aulas.</p></div>`;
  return `<div class="chronogram-disciplines">${disciplines.map((discipline, index) => {
    const count = entries.filter((entry) => entry.disciplina === discipline.id).length;
    return `<button class="chronogram-discipline-card chronogram-discipline-card--${index % 3}" data-open-chronogram-discipline="${escapeHtml(discipline.id)}"><span>${icon("book", 21)}</span><div><small>CRONOGRAMA</small><strong>${escapeHtml(discipline.nome_disciplina)}</strong><em>${count} ${count === 1 ? "aula registrada" : "aulas registradas"}</em></div>${icon("arrowRight", 18)}</button>`;
  }).join("")}</div>`;
}

function entryCard(entry) {
  const kind = chronogramKind(entry);
  const meta = KIND_META[kind];
  const date = new Date(entry.data_hora);
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(date).replace(".", "");
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `<article class="chronogram-entry chronogram-entry--${kind}"><span class="chronogram-entry__date"><strong>${date.getDate()}</strong><small>${new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "")}</small></span><div class="chronogram-entry__main"><span class="chronogram-entry__kind">${icon(meta.icon, 13)} ${meta.short}</span><h2>${escapeHtml(entry.tema)}</h2><p>${escapeHtml(day)} · ${time}</p></div><button class="icon-button" data-edit-chronogram="${escapeHtml(entry.id)}" aria-label="Editar ${escapeHtml(entry.tema)}">${icon("edit", 17)}</button></article>`;
}

function disciplineTimeline(discipline, entries, hasOccurrences) {
  return `<section class="page chronogram-detail-page"><button class="back-link" data-chronogram-back>${icon("arrowLeft", 18)} Disciplinas</button><div class="page-heading page-heading--row"><div><span class="eyebrow">PLANEJAMENTO DE AULAS</span><h1>${escapeHtml(discipline.nome_disciplina)}</h1><p>Registre temas e situações especiais de cada aula.</p></div><button class="button button--primary" data-add-chronogram ${hasOccurrences ? "" : "disabled"}>${icon("plus", 18)} Cadastrar aula</button></div>${hasOccurrences ? "" : `<div class="chronogram-needs-schedule">${icon("calendar", 18)} <span>Cadastre horários para esta disciplina e defina o período do perfil antes de criar aulas.</span></div>`}<section class="chronogram-timeline">${entries.length ? entries.map(entryCard).join("") : `<div class="chronogram-empty"><span>${icon("calendar", 28)}</span><h3>Nenhuma aula registrada</h3><p>Use o botão para criar o primeiro registro deste cronograma.</p></div>`}</section></section>`;
}

export function chronogramView({ profile, disciplines, entries, selectedDiscipline, occurrences }) {
  if (selectedDiscipline) return disciplineTimeline(selectedDiscipline, entries.filter((entry) => entry.disciplina === selectedDiscipline.id), occurrences.length > 0);
  return `<section class="page chronogram-page"><div class="page-heading"><span class="eyebrow">PLANEJAMENTO</span><h1>Cronograma</h1><p>Escolha uma disciplina para acompanhar e planejar suas aulas.</p></div>${disciplineCards(disciplines, entries)}</section>`;
}

export function bindChronogram(root, { profile, disciplines, entries, selectedDiscipline, occurrences, onOpenDiscipline, onBack, onCreate, onUpdate, onDelete }) {
  root.querySelectorAll("[data-open-chronogram-discipline]").forEach((button) => button.addEventListener("click", () => onOpenDiscipline(button.dataset.openChronogramDiscipline)));
  if (!selectedDiscipline) return;
  const disciplineEntries = entries.filter((entry) => entry.disciplina === selectedDiscipline.id);
  const usedDates = disciplineEntries.map((entry) => entry.data_hora);
  root.querySelector("[data-chronogram-back]").addEventListener("click", onBack);
  root.querySelector("[data-add-chronogram]")?.addEventListener("click", () => openChronogramEditor(null, selectedDiscipline, occurrences, usedDates, onCreate, onUpdate, onDelete));
  root.querySelectorAll("[data-edit-chronogram]").forEach((button) => button.addEventListener("click", () => {
    const entry = disciplineEntries.find((item) => item.id === button.dataset.editChronogram);
    if (entry) openChronogramEditor(entry, selectedDiscipline, occurrences, usedDates, onCreate, onUpdate, onDelete);
  }));
}
