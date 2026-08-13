import { escapeHtml } from "../utils/formatters.js";
import { icon } from "../utils/icons.js";
import { closeModal, confirmModal, setButtonLoading, showToast } from "./components.js";

const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function recordFor(video, references) {
  const discipline = references.disciplines.find((item) => item.id === video.disciplina);
  const activity = video.aula
    ? references.lessons.find((item) => item.id === video.aula)
    : video.prova
      ? references.exams.find((item) => item.id === video.prova)
      : video.apresentacao
        ? references.presentations.find((item) => item.id === video.apresentacao)
        : null;
  const activityLabel = video.aula ? "Aula" : video.prova ? "Prova" : video.apresentacao ? "Apresentação" : "Vídeo do perfil";
  const activityName = video.aula
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
  if (scope.type === "lesson") return { back: "Aula", label: "VÍDEOS DA AULA", title: scope.record.tema || "Aula registrada", description: "Assista e registre os vídeos ligados a esta aula." };
  if (scope.type === "exam") return { back: "Prova", label: "VÍDEOS DA PROVA", title: scope.record.titulo || "Prova", description: "Reúna aulas, revisões e explicações para esta prova." };
  return { back: "Apresentação", label: "VÍDEOS DA APRESENTAÇÃO", title: scope.record.titulo || "Apresentação", description: "Mantenha os vídeos de apoio desta apresentação." };
}

function videoCard(video, references) {
  const meta = recordFor(video, references);
  const search = normalize([video.nome, video.descricao, meta.discipline?.nome_disciplina, meta.activityName, meta.activityLabel, video.link, video.arquivo_no_bucket ? "arquivo enviado video" : "link externo video"].filter(Boolean).join(" "));
  return `<article class="video-card" data-open-video="${escapeHtml(video.id)}" data-video-search="${escapeHtml(search)}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(video.nome)}"><div class="video-card__cover"><span>${icon("video", 26)}</span><em>${video.arquivo_no_bucket ? "ARQUIVO" : "LINK"}</em><i>${icon("arrowRight", 18)}</i></div><div class="video-card__body"><strong>${escapeHtml(video.nome)}</strong><p>${escapeHtml(video.descricao || "Sem descrição adicionada.")}</p><small>${escapeHtml(meta.discipline?.nome_disciplina || "Perfil geral")}</small>${meta.activityName ? `<b>${escapeHtml(meta.activityLabel)} · ${escapeHtml(meta.activityName)}</b>` : ""}</div><button class="icon-button icon-button--danger video-card__delete" data-delete-video="${escapeHtml(video.id)}" aria-label="Apagar ${escapeHtml(video.nome)}" title="Apagar vídeo">${icon("trash", 17)}</button></article>`;
}

function empty(scope) {
  return `<section class="videos-empty"><span>${icon("video", 30)}</span><h2>${scope ? "Nenhum vídeo neste espaço" : "Sua videoteca começa aqui"}</h2><p>${scope ? "Adicione uma explicação, gravação ou revisão relacionada a esta atividade." : "Salve links ou envie vídeos para acessar seu material em um só lugar."}</p><button class="button button--secondary" data-add-video>${icon("plus", 16)} Adicionar vídeo</button></section>`;
}

export function videosView({ videos, references, scope }) {
  const scopedVideos = scope ? videos.filter((video) => video[scope.field] === scope.record.id) : videos;
  const copy = scopeText(scope);
  return `<section class="page videos-page">${copy ? `<button class="back-link" data-videos-back>${icon("arrowLeft", 18)} ${copy.back}</button><header class="videos-context"><span>${icon("video", 19)}</span><div><small>${copy.label}</small><h1>${escapeHtml(copy.title)}</h1><p>${copy.description}</p></div></header>` : ""}<div class="page-heading page-heading--row"><div><span class="eyebrow">BIBLIOTECA DE VÍDEOS</span><h1>Vídeos</h1><p>Assista e organize as gravações, aulas e explicações do perfil.</p></div><button class="button button--primary" data-add-video>${icon("plus", 17)} Salvar vídeo</button></div><section class="videos-toolbar"><label class="field videos-search"><span class="field__control">${icon("search", 17)}<input data-videos-search autocomplete="off" placeholder="Buscar por nome, descrição, disciplina, aula, prova, apresentação ou link" /></span></label><p><span>${icon("video", 16)}</span><strong data-videos-count>${scopedVideos.length}</strong> ${scopedVideos.length === 1 ? "vídeo salvo" : "vídeos salvos"}</p></section><div class="videos-grid" data-videos-grid>${scopedVideos.length ? scopedVideos.map((video) => videoCard(video, references)).join("") : empty(scope)}</div><p class="videos-search-empty" data-videos-search-empty hidden>Nenhum vídeo combina com esta busca.</p></section>`;
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

function youtubeEmbedUrl(source) {
  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";
    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
      else if (["embed", "shorts", "live"].includes(parts[0])) videoId = parts[1] || "";
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`
      : null;
  } catch {
    return null;
  }
}

function createModal(references, scope) {
  const scoped = Boolean(scope);
  const scopeData = scoped ? `<div class="video-create__scope"><span>${icon("book", 16)}</span><div><small>VÍNCULO AUTOMÁTICO</small><strong>${escapeHtml(scope.type === "lesson" ? "Aula" : scope.type === "exam" ? "Prova" : "Apresentação")}</strong><p>${escapeHtml(scope.type === "lesson" ? scope.record.tema || "Aula registrada" : scope.record.titulo)}</p></div></div>` : `<div class="video-create__links"><label class="field"><span>Disciplina <em>opcional</em></span><span class="field__control">${icon("book", 17)}<select name="disciplineId" data-video-discipline><option value="">Sem disciplina</option>${references.disciplines.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.nome_disciplina)}</option>`).join("")}</select></span></label><label class="field"><span>Vincular a <em>opcional</em></span><span class="field__control">${icon("calendar", 17)}<select name="activityType" data-video-activity-type disabled><option value="">Nenhuma atividade</option><option value="lesson">Aula</option><option value="exam">Prova</option><option value="presentation">Apresentação</option></select></span></label><label class="field video-activity-choice" hidden><span data-video-activity-label>Atividade</span><span class="field__control">${icon("file", 17)}<select name="activityId" data-video-activity-id disabled><option value="">Selecione primeiro uma atividade</option></select></span></label></div>`;
  return `<div class="modal-backdrop" data-video-create-backdrop><section class="modal modal--video-create" role="dialog" aria-modal="true" aria-labelledby="video-create-title"><form class="video-create" data-video-create-form novalidate><header><div><span class="eyebrow">${scoped ? "NOVO VÍDEO VINCULADO" : "NOVO VÍDEO"}</span><h2 id="video-create-title">Salvar vídeo</h2><p>Adicione um link de vídeo — inclusive do YouTube — ou envie um arquivo privado para o seu espaço AKADEMO.</p></div><button class="icon-button" type="button" data-close-video-create aria-label="Fechar">${icon("close", 19)}</button></header>${scoped ? scopeData : ""}<div class="video-create__fields"><label class="field"><span>Nome do vídeo</span><span class="field__control">${icon("video", 17)}<input name="name" maxlength="180" required autofocus placeholder="Ex.: Revisão de cálculo - limites" /></span></label><label class="field"><span>Descrição <em>opcional</em></span><textarea class="field__textarea" name="description" maxlength="5000" placeholder="O que este vídeo explica ou em que ele ajuda?" ></textarea></label><div class="video-source"><div><strong>Fonte do vídeo</strong><small>Preencha um link (YouTube é suportado) ou envie um arquivo de vídeo.</small></div><label class="field"><span>Link do vídeo <em>opcional</em></span><span class="field__control">${icon("arrowRight", 17)}<input type="url" name="link" placeholder="https://..." inputmode="url" /></span></label><div class="video-source__or"><span>ou</span></div><label class="video-source__file"><input type="file" name="file" accept="video/*" data-video-file/><span>${icon("upload", 20)}</span><div><strong>Selecionar arquivo de vídeo</strong><small data-video-file-label>MP4, WebM, MOV e outros formatos de vídeo · até 50 MB</small></div></label></div></div>${!scoped ? scopeData : ""}<footer><button class="button button--ghost" type="button" data-close-video-create>Cancelar</button><button class="button button--primary" type="submit">${icon("save", 16)} Salvar vídeo</button></footer></form></section></div>`;
}

export function openVideoCreate({ references, scope, onCreate }) {
  const modalRoot = document.querySelector("#modal-root");
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKeydown);
    closeModal();
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKeydown);
  modalRoot.innerHTML = createModal(references, scope);
  const closeAll = close;
  modalRoot.querySelectorAll("[data-close-video-create]").forEach((button) => button.addEventListener("click", closeAll));
  modalRoot.querySelector("[data-video-create-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeAll(); });
  const discipline = modalRoot.querySelector("[data-video-discipline]");
  const activityType = modalRoot.querySelector("[data-video-activity-type]");
  const activityField = modalRoot.querySelector(".video-activity-choice");
  const activityId = modalRoot.querySelector("[data-video-activity-id]");
  const activityLabel = modalRoot.querySelector("[data-video-activity-label]");
  const syncActivities = () => {
    if (!discipline || !activityType || !activityId) return;
    activityType.disabled = !discipline.value;
    if (!discipline.value) activityType.value = "";
    const type = activityType.value;
    activityField.hidden = !type;
    activityId.disabled = !type;
    activityId.innerHTML = type ? activityOptions(type, discipline.value, references) : "<option value=\"\">Selecione primeiro uma atividade</option>";
    if (activityLabel && type) activityLabel.textContent = type === "lesson" ? "Aula" : type === "exam" ? "Prova" : "Apresentação";
  };
  discipline?.addEventListener("change", syncActivities);
  activityType?.addEventListener("change", syncActivities);
  const file = modalRoot.querySelector("[data-video-file]");
  file?.addEventListener("change", () => {
    const selected = file.files?.[0];
    const label = modalRoot.querySelector("[data-video-file-label]");
    if (label && selected) label.textContent = `${selected.name} · ${Math.max(1, Math.ceil(selected.size / 1024 / 1024))} MB`;
  });
  modalRoot.querySelector("[data-video-create-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const type = data.get("activityType");
    const activityId = String(data.get("activityId") || "");
    const values = {
      name: data.get("name"), description: data.get("description"), link: data.get("link"), file: data.get("file"), disciplineId: data.get("disciplineId"),
      lessonId: scope?.type === "lesson" ? scope.record.id : type === "lesson" ? activityId : "",
      examId: scope?.type === "exam" ? scope.record.id : type === "exam" ? activityId : "",
      presentationId: scope?.type === "presentation" ? scope.record.id : type === "presentation" ? activityId : "",
    };
    if (scope) values.disciplineId = scope.disciplineId;
    const button = form.querySelector("[type=submit]");
    try {
      setButtonLoading(button, true);
      await onCreate(values);
      closeAll();
    } catch (error) {
      setButtonLoading(button, false);
      showToast(error.message || "Não foi possível salvar o vídeo.", "error");
    }
  });
}

export function openVideoPlayer({ video, source, references }) {
  const modalRoot = document.querySelector("#modal-root");
  const meta = recordFor(video, references);
  const description = video.descricao || "Nenhuma descrição foi adicionada para este vídeo.";
  const youtubeSource = !video.arquivo_no_bucket && youtubeEmbedUrl(source);
  const player = youtubeSource
    ? `<iframe src="${escapeHtml(youtubeSource)}" title="${escapeHtml(video.nome)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`
    : `<video controls playsinline preload="metadata" src="${escapeHtml(source)}">Seu navegador não oferece suporte a vídeos HTML5.</video>`;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-video-player-backdrop><section class="modal modal--video-player" role="dialog" aria-modal="true" aria-labelledby="video-player-title"><header class="video-player__head"><div><span class="eyebrow">REPRODUTOR AKADEMO</span><h2 id="video-player-title">${escapeHtml(video.nome)}</h2></div><button class="icon-button" data-close-video-player aria-label="Fechar reprodutor">${icon("close", 20)}</button></header><div class="video-player__frame">${player}</div><section class="video-player__details"><p>${escapeHtml(description)}</p><div><span>${icon("book", 15)} ${escapeHtml(meta.discipline?.nome_disciplina || "Perfil geral")}</span>${meta.activityName ? `<span>${icon("calendar", 15)} ${escapeHtml(meta.activityLabel)} · ${escapeHtml(meta.activityName)}</span>` : ""}</div></section></section></div>`;
  const modal = modalRoot.querySelector(".modal--video-player");
  const frame = modalRoot.querySelector(".video-player__frame");
  const fitFrame = () => {
    if (!modal || !frame) return;
    const computed = window.getComputedStyle(modal);
    const verticalPadding = Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom);
    const horizontalPadding = Number.parseFloat(computed.paddingLeft) + Number.parseFloat(computed.paddingRight);
    const header = modal.querySelector(".video-player__head");
    const details = modal.querySelector(".video-player__details");
    const headerMargin = Number.parseFloat(window.getComputedStyle(header).marginBottom) || 0;
    const viewportPadding = window.innerWidth <= 760 ? 16 : 40;
    const availableWidth = Math.max(1, modal.clientWidth - horizontalPadding);
    const availableHeight = Math.max(1, window.innerHeight - viewportPadding - verticalPadding - header.offsetHeight - headerMargin - details.offsetHeight);
    const width = Math.min(availableWidth, availableHeight * (16 / 9));
    frame.style.width = `${Math.floor(width)}px`;
    frame.style.height = `${Math.floor(width * (9 / 16))}px`;
  };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", fitFrame);
    closeModal();
  };
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", fitFrame, { passive: true });
  window.requestAnimationFrame(fitFrame);
  modalRoot.querySelectorAll("[data-close-video-player]").forEach((button) => button.addEventListener("click", close));
  modalRoot.querySelector("[data-video-player-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
}

export function bindVideosCatalog(root, { videos, references, scope, onBack, onCreate, onOpen, onDelete }) {
  root.querySelector("[data-videos-back]")?.addEventListener("click", onBack);
  root.querySelectorAll("[data-add-video]").forEach((button) => button.addEventListener("click", () => openVideoCreate({ references, scope, onCreate })));
  root.querySelectorAll("[data-open-video]").forEach((card) => {
    const open = (event) => {
      if (event?.target?.closest("[data-delete-video]")) return;
      const video = videos.find((item) => item.id === card.dataset.openVideo);
      if (video) onOpen(video);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(event); }
    });
  });
  root.querySelectorAll("[data-delete-video]").forEach((button) => button.addEventListener("click", async () => {
    const video = videos.find((item) => item.id === button.dataset.deleteVideo);
    if (!video || !await confirmModal({ title: "Apagar este vídeo?", message: video.arquivo_no_bucket ? `“${video.nome}” e o arquivo privado serão removidos.` : `“${video.nome}” será removido da sua biblioteca.`, confirmLabel: "Apagar vídeo", tone: "danger" })) return;
    await onDelete(video);
  }));
  const search = root.querySelector("[data-videos-search]");
  const empty = root.querySelector("[data-videos-search-empty]");
  const count = root.querySelector("[data-videos-count]");
  search?.addEventListener("input", () => {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    root.querySelectorAll("[data-open-video]").forEach((card) => {
      const matches = terms.every((term) => card.dataset.videoSearch.includes(term));
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    if (count) count.textContent = String(visible);
    if (empty) empty.hidden = visible > 0 || !terms.length;
  });
}
