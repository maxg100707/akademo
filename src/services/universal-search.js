const TYPE_LABELS = {
  module: "Módulo",
  setting: "Configuração",
  profile: "Perfil de estudo",
  discipline: "Disciplina",
  teacher: "Professor",
  contact: "Contato",
  schedule: "Horário",
  chronogram: "Cronograma",
  lesson: "Aula",
  file: "Arquivo",
  task: "Tarefa",
  exam: "Prova",
  examTopic: "Tema de prova",
  presentation: "Apresentação",
  mindMap: "Mapa mental",
  note: "Anotação",
  summaries: "Resumo",
  glossary: "Termo do glossário",
  flashcards: "Conjunto de flashcards",
  video: "Vídeo",
  bibliography: "Bibliografia",
};

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const MODULES = [
  ["dashboard", "Dashboard", "Acompanhe sua rotina acadêmica, próximos compromissos e atalhos.", "dashboard"],
  ["profiles", "Perfis de estudo", "Crie e organize períodos, cursos e semestres.", "graduation"],
  ["disciplines", "Disciplinas", "Organize matérias, resumos e professores.", "book"],
  ["contacts", "Contatos", "Professores e contatos importantes do seu perfil.", "users"],
  ["schedules", "Horários", "Veja a grade semanal das suas aulas.", "calendar"],
  ["lessons", "Aulas", "Registre aulas, resumos, materiais e recursos de estudo.", "book"],
  ["files", "Arquivos", "Gerencie todos os materiais e conteúdos do perfil.", "folder"],
  ["tasks", "Tarefas", "Acompanhe prazos, entregas e atividades.", "check"],
  ["exams", "Provas", "Planeje avaliações, temas e materiais de revisão.", "exam"],
  ["presentations", "Apresentações", "Prepare instruções, links e conteúdos para apresentações.", "presentation"],
  ["chronogram", "Cronograma", "Planeje temas, feriados, provas e apresentações de cada aula.", "file"],
  ["mindmaps", "Mapas mentais", "Crie mapas mentais visuais para relacionar ideias.", "mindMap"],
  ["notes", "Anotações", "Escreva e consulte páginas de anotações organizadas.", "note"],
  ["summaries", "Resumos", "Escreva e consulte páginas de resumos de estudo sobre suas disciplinas.", "note"],
  ["flashcards", "Flashcards", "Crie conjuntos de cards para revisar conceitos de estudo.", "flashcards"],
  ["glossary", "Glossário", "Guarde termos, definições e exemplos importantes.", "glossary"],
  ["videos", "Vídeos", "Salve e assista vídeos de estudo e explicações.", "video"],
  ["bibliography", "Bibliografia", "Consulte referências, livros, artigos e materiais de estudo.", "book"],
  ["settings", "Configurações", "Ajuste usuário, dashboard, aparência e tema do AKADEMO.", "settings"],
];

const SETTINGS = [
  ["settings", "Configurações", "Encontre e ajuste todas as configurações do AKADEMO.", "settings"],
  ["settings-user", "Configurações de usuário", "Nome, foto de perfil e informações pessoais.", "userRound"],
  ["settings-dashboard", "Configurações do dashboard", "Widgets, atalhos favoritos, ordem e visualização do dashboard.", "dashboard"],
  ["settings-personalization", "Personalização", "Tema claro ou escuro e as temáticas Floresta, Chamas e Cosmic.", "sparkles"],
];

export function normalizeSearch(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function textFromValue(value, seen = new WeakSet()) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).replace(/<[^>]*>/g, " ");
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => textFromValue(item, seen)).join(" ");
  return Object.entries(value)
    .filter(([key]) => !["id", "email_user", "perfil", "user_id"].includes(key))
    .map(([key, item]) => `${key} ${textFromValue(item, seen)}`)
    .join(" ");
}

function dateText(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return [
    date.toISOString(),
    date.toLocaleDateString("pt-BR"),
    date.toLocaleString("pt-BR"),
  ].join(" ");
}

function find(items, id) {
  return (items || []).find((item) => String(item?.id) === String(id)) || null;
}

function activityLabel(item, refs) {
  const discipline = find(refs.disciplines, item?.disciplina);
  const lesson = find(refs.lessons, item?.aula);
  const exam = find(refs.exams, item?.prova);
  const presentation = find(refs.presentations, item?.apresentacao);
  const parts = [discipline?.nome_disciplina];
  if (lesson) parts.push(`Aula: ${lesson.tema || "Sem tema"}`);
  else if (exam) parts.push(`Prova: ${exam.titulo || "Sem título"}`);
  else if (presentation) parts.push(`Apresentação: ${presentation.titulo || "Sem título"}`);
  return parts.filter(Boolean).join(" · ");
}

function entry({ type, title, subtitle = "", iconName, route, data, extra = "" }) {
  const typeLabel = TYPE_LABELS[type] || type;
  const allText = [typeLabel, title, subtitle, extra, textFromValue(data)].join(" ");
  return {
    id: `${type}:${data?.id || route?.view || title}`,
    recordId: data?.id || "",
    type,
    typeLabel,
    title: String(title || typeLabel),
    subtitle: String(subtitle || ""),
    iconName: iconName || "search",
    route,
    haystack: normalizeSearch(allText),
    titleSearch: normalizeSearch(`${title} ${typeLabel}`),
    primarySearch: normalizeSearch(title),
    secondarySearch: normalizeSearch([typeLabel, subtitle, extra, textFromValue(data)].join(" ")),
  };
}

function scopeRoute(view, item) {
  if (item?.aula) return { view, scope: "lesson", scopeId: item.aula };
  if (item?.prova) return { view, scope: "exam", scopeId: item.prova };
  if (item?.apresentacao) return { view, scope: "presentation", scopeId: item.apresentacao };
  return { view };
}

export function buildUniversalSearchIndex(data = {}) {
  const profiles = data.profiles || [];
  const refs = {
    disciplines: data.disciplines || [],
    lessons: data.lessons || [],
    exams: data.exams || [],
    presentations: data.presentations || [],
  };
  const teachers = data.teachers || [];
  const contacts = data.contacts || [];
  const schedules = data.schedules || [];
  const chronograms = data.chronograms || [];
  const tasks = data.tasks || [];
  const contents = data.contents || [];
  const mindMaps = data.mindMaps || [];
  const notes = data.notes || [];
  const summaries = data.summaries || [];
  const glossaryTerms = data.glossaryTerms || [];
  const flashcardCollections = data.flashcardCollections || [];
  const videos = data.videos || [];
  const bibliography = data.bibliography || [];
  const examTopics = data.examTopics || [];
  const indexed = [];

  MODULES.forEach(([view, title, description, iconName]) => {
    indexed.push(entry({ type: "module", title, subtitle: description, iconName, route: { view }, extra: `${view} menu navegação` }));
  });
  SETTINGS.forEach(([view, title, description, iconName]) => {
    indexed.push(entry({ type: "setting", title, subtitle: description, iconName, route: { view }, extra: data.settings }));
  });
  if (data.record) {
    indexed.push(entry({
      type: "setting",
      title: data.record.nome || "Sua conta",
      subtitle: data.record.email || "Informações pessoais",
      iconName: "userRound",
      route: { view: "settings-user" },
      data: data.record,
      extra: "usuário conta nome foto perfil informações pessoais",
    }));
  }

  profiles.forEach((profile) => {
    indexed.push(entry({
      type: "profile",
      title: profile.curso || "Perfil de estudo",
      subtitle: [profile.instituicao, profile.semestre ? `${profile.semestre}º semestre` : ""].filter(Boolean).join(" · "),
      iconName: "graduation",
      route: { view: "profiles" },
      data: profile,
      extra: `${dateText(profile.data_inicio)} ${dateText(profile.data_fim)}`,
    }));
  });

  refs.disciplines.forEach((discipline) => {
    const teacher = find(teachers, discipline.professor_id);
    indexed.push(entry({
      type: "discipline",
      title: discipline.nome_disciplina || "Disciplina",
      subtitle: teacher?.nome_professor ? `Professor: ${teacher.nome_professor}` : "Disciplina do perfil ativo",
      iconName: "book",
      route: { view: "disciplines" },
      data: discipline,
      extra: teacher ? textFromValue(teacher) : "",
    }));
  });

  teachers.forEach((teacher) => {
    const teaches = refs.disciplines.filter((discipline) => String(discipline.professor_id) === String(teacher.id)).map((discipline) => discipline.nome_disciplina).join(" · ");
    indexed.push(entry({
      type: "teacher",
      title: teacher.nome_professor || "Professor",
      subtitle: teaches || teacher.email_professor || "Professor do perfil ativo",
      iconName: "users",
      route: { view: "contacts" },
      data: teacher,
      extra: teaches,
    }));
  });

  contacts.forEach((contact) => {
    indexed.push(entry({
      type: "contact",
      title: contact.nome || "Contato",
      subtitle: contact.email || contact.telefone || "Contato do perfil ativo",
      iconName: "users",
      route: { view: "contacts" },
      data: contact,
    }));
  });

  schedules.forEach((schedule) => {
    const discipline = find(refs.disciplines, schedule.disciplina);
    const weekday = WEEKDAYS[Number(schedule.dia_semana)] || `Dia ${Number(schedule.dia_semana)}`;
    indexed.push(entry({
      type: "schedule",
      title: discipline?.nome_disciplina || "Horário de aula",
      subtitle: `${weekday} · ${String(schedule.hora_inicio || "").slice(0, 5)}–${String(schedule.hora_fim || "").slice(0, 5)}`,
      iconName: "calendar",
      route: { view: "schedules" },
      data: schedule,
      extra: discipline ? textFromValue(discipline) : "",
    }));
  });

  chronograms.forEach((chronogram) => {
    const discipline = find(refs.disciplines, chronogram.disciplina);
    const kind = chronogram.feriado ? "Feriado" : chronogram.prova ? "Prova" : chronogram.apresentacao ? "Apresentação" : "Aula";
    indexed.push(entry({
      type: "chronogram",
      title: chronogram.tema || `${kind} planejada`,
      subtitle: [discipline?.nome_disciplina, kind, dateText(chronogram.data_hora)].filter(Boolean).join(" · "),
      iconName: "file",
      route: chronogram.aula
        ? { view: "lesson-detail", lesson: chronogram.aula, chronogram: chronogram.id, discipline: chronogram.disciplina, at: chronogram.data_hora }
        : { view: "chronogram", discipline: chronogram.disciplina },
      data: chronogram,
      extra: discipline ? textFromValue(discipline) : "",
    }));
  });

  refs.lessons.forEach((lesson) => {
    const discipline = find(refs.disciplines, lesson.disciplina);
    const chronogram = find(chronograms, lesson.cronograma);
    indexed.push(entry({
      type: "lesson",
      title: lesson.tema || "Aula registrada",
      subtitle: [discipline?.nome_disciplina, dateText(chronogram?.data_hora)].filter(Boolean).join(" · "),
      iconName: "book",
      route: { view: "lesson-detail", lesson: lesson.id, chronogram: lesson.cronograma, discipline: lesson.disciplina, at: chronogram?.data_hora || "" },
      data: lesson,
      extra: `${textFromValue(chronogram)} ${discipline ? textFromValue(discipline) : ""}`,
    }));
  });

  contents.forEach((content) => {
    const context = activityLabel(content, refs);
    indexed.push(entry({
      type: "file",
      title: content.titulo || String(content.path || "").split("/").pop() || "Arquivo",
      subtitle: context || "Arquivo do perfil ativo",
      iconName: "folder",
      route: { view: "files", q: content.titulo || "" },
      data: content,
      extra: `${String(content.path || "").split(".").pop() || ""} ${dateText(content.created_at)}`,
    }));
  });

  tasks.forEach((task) => {
    const context = activityLabel(task, refs);
    indexed.push(entry({
      type: "task",
      title: task.titulo || "Tarefa",
      subtitle: [context, task.completa ? "Concluída" : "Pendente", dateText(task.prazo)].filter(Boolean).join(" · "),
      iconName: "check",
      route: { view: "tasks", discipline: task.disciplina || "" },
      data: task,
    }));
  });

  refs.exams.forEach((exam) => {
    const discipline = find(refs.disciplines, exam.disciplina);
    indexed.push(entry({
      type: "exam",
      title: exam.titulo || "Prova",
      subtitle: [discipline?.nome_disciplina, dateText(exam.data)].filter(Boolean).join(" · "),
      iconName: "exam",
      route: { view: "exam-detail", exam: exam.id },
      data: exam,
      extra: discipline ? textFromValue(discipline) : "",
    }));
  });

  examTopics.forEach((topic) => {
    const exam = find(refs.exams, topic.prova);
    const discipline = find(refs.disciplines, topic.disciplina || exam?.disciplina);
    indexed.push(entry({
      type: "examTopic",
      title: topic.tema || "Tema de prova",
      subtitle: [exam?.titulo, discipline?.nome_disciplina].filter(Boolean).join(" · "),
      iconName: "exam",
      route: exam ? { view: "exam-topic", exam: exam.id, topic: topic.id } : { view: "exams" },
      data: topic,
      extra: `${textFromValue(exam)} ${textFromValue(discipline)}`,
    }));
  });

  refs.presentations.forEach((presentation) => {
    const discipline = find(refs.disciplines, presentation.disciplina);
    indexed.push(entry({
      type: "presentation",
      title: presentation.titulo || "Apresentação",
      subtitle: [discipline?.nome_disciplina, dateText(presentation.data)].filter(Boolean).join(" · "),
      iconName: "presentation",
      route: { view: "presentation-detail", presentation: presentation.id },
      data: presentation,
      extra: discipline ? textFromValue(discipline) : "",
    }));
  });

  mindMaps.forEach((map) => {
    const context = activityLabel(map, refs);
    indexed.push(entry({
      type: "mindMap",
      title: map.tema || "Mapa mental",
      subtitle: context || map.descricao || "Mapa mental do perfil ativo",
      iconName: "mindMap",
      route: { ...scopeRoute("mindmap-editor", map), map: map.id },
      data: map,
    }));
  });

  notes.forEach((note) => {
    const context = activityLabel(note, refs);
    indexed.push(entry({
      type: "note",
      title: note.titulo || "Anotação",
      subtitle: context || "Anotação do perfil ativo",
      iconName: "note",
      route: scopeRoute("notes", note),
      data: note,
    }));
  });

  summaries.forEach((summary) => {
    const context = activityLabel(summary, refs);
    indexed.push(entry({
      type: "summaries",
      title: summary.titulo || "Resumo",
      subtitle: context || "Resumo do perfil ativo",
      iconName: "note",
      route: scopeRoute("summaries", summary),
      data: summary,
    }));
  });

  glossaryTerms.forEach((term) => {
    const context = activityLabel(term, refs);
    indexed.push(entry({
      type: "glossary",
      title: term.termo || "Termo do glossário",
      subtitle: context || term.definicao || "Glossário do perfil ativo",
      iconName: "glossary",
      route: scopeRoute("glossary", term),
      data: term,
    }));
  });

  flashcardCollections.forEach((collection) => {
    const context = activityLabel(collection, refs);
    // Deliberately omit `cards`: front and back are private review prompts and are not universal-search content.
    indexed.push(entry({
      type: "flashcards",
      title: collection.tema_colecao || "Conjunto de flashcards",
      subtitle: context || collection.descricao || "Flashcards do perfil ativo",
      iconName: "flashcards",
      route: scopeRoute("flashcards", collection),
      data: {
        id: collection.id,
        tema_colecao: collection.tema_colecao,
        descricao: collection.descricao,
        disciplina: collection.disciplina,
        aula: collection.aula,
        prova: collection.prova,
        apresentacao: collection.apresentacao,
      },
      extra: `${Array.isArray(collection.cards) ? collection.cards.length : 0} cards ${context}`,
    }));
  });

  videos.forEach((video) => {
    const context = activityLabel(video, refs);
    indexed.push(entry({
      type: "video",
      title: video.nome || "Vídeo",
      subtitle: context || video.descricao || "Vídeo do perfil ativo",
      iconName: "video",
      route: scopeRoute("videos", video),
      data: video,
    }));
  });

  bibliography.forEach((bib) => {
    const context = activityLabel(bib, refs);
    indexed.push(entry({
      type: "bibliography",
      title: bib.titulo || "Bibliografia",
      subtitle: [bib.tipo, bib.autor, context].filter(Boolean).join(" · "),
      iconName: "book",
      route: scopeRoute("bibliography", bib),
      data: bib,
    }));
  });

  return indexed;
}

export function searchUniversalIndex(index, query, limit = 28) {
  const normalized = normalizeSearch(query);
  const terms = normalized.split(" ").filter(Boolean);
  if (!terms.length) return [];

  const variantsFor = (term) => {
    const variants = [term];
    if (term.endsWith("oes")) variants.push(`${term.slice(0, -3)}ao`);
    if (term.endsWith("ao")) variants.push(`${term.slice(0, -2)}oes`);
    if (term.endsWith("al")) variants.push(`${term.slice(0, -2)}ais`);
    if (term.endsWith("es")) variants.push(term.slice(0, -2));
    if (term.endsWith("s")) variants.push(term.slice(0, -1));
    return [...new Set(variants.filter(Boolean))];
  };

  const isCompleteWord = (haystack, needle) => {
    if (!haystack || !needle) return false;
    const escaped = needle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    return regex.test(haystack);
  };

  const isContained = (haystack, needle) => {
    if (!haystack || !needle) return false;
    return haystack.includes(needle);
  };

  const getTermMatchValue = (item, term) => {
    const variants = variantsFor(term);
    let bestVal = 0;
    for (const variant of variants) {
      let val = 0;
      if (isCompleteWord(item.primarySearch, variant)) {
        val = 4;
      } else if (isCompleteWord(item.secondarySearch, variant)) {
        val = 3;
      } else if (isContained(item.primarySearch, variant)) {
        val = 2;
      } else if (isContained(item.secondarySearch, variant)) {
        val = 1;
      }
      if (val > bestVal) {
        bestVal = val;
      }
    }
    return bestVal;
  };

  return index
    .map((item) => {
      const termVals = terms.map(term => getTermMatchValue(item, term));
      const minVal = Math.min(...termVals);

      if (minVal === 0) return null;

      const title = item.titleSearch;
      const subScore = terms.reduce((total, term) => total
        + (title === term ? 180 : 0)
        + (title.startsWith(term) ? 70 : 0)
        + (title.includes(term) ? 30 : 0)
        + (item.haystack.indexOf(term) >= 0 ? Math.max(0, 12 - item.haystack.indexOf(term) / 180) : 0), 0);

      const score = minVal * 100000 + subScore;
      return { ...item, score };
    })
    .filter(Boolean)
    .sort((first, second) => second.score - first.score || first.title.localeCompare(second.title, "pt-BR"))
    .slice(0, limit);
}
