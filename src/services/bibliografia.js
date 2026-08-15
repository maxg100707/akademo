import { extensionFromFile } from "../utils/formatters.js";
import { requireSupabase } from "./supabase.js";
import { provisionUserStorage } from "./users.js";

const MAX_BIBLIOGRAPHY_SIZE = 20 * 1024 * 1024; // 20 MB
const optional = (value) => String(value || "").trim() || null;

function association(values) {
  const links = [
    ["aula", values.lessonId],
    ["prova", values.examId],
    ["apresentacao", values.presentationId],
  ].filter(([, value]) => Boolean(value));
  if (links.length > 1) {
    throw new Error("Escolha somente uma aula, prova ou apresentação para a bibliografia.");
  }
  return Object.fromEntries(
    ["aula", "prova", "apresentacao"].map((key) => [
      key,
      links.find(([kind]) => kind === key)?.[1] || null,
    ]),
  );
}

function externalUrl(value) {
  const source = String(value || "").trim();
  try {
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error("Informe um link de bibliografia válido, iniciado por http:// ou https://.");
  }
}

function bibliographyPath(profileId, file) {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
  const extension = extensionFromFile(file) || "pdf";
  return `bibliografia/${profileId}/${Date.now()}-${random}.${extension}`;
}

function details(values) {
  const titulo = String(values.title || values.titulo || "").trim();
  const tipo = String(values.type || values.tipo || "").trim();
  const autor = String(values.author || values.autor || "").trim();
  const descricao = optional(values.description ?? values.descricao);
  const disciplina = optional(values.disciplineId ?? values.disciplina);

  if (!titulo) throw new Error("Informe o título da bibliografia.");
  if (titulo.length > 180) throw new Error("O título deve ter no máximo 180 caracteres.");

  const validTypes = ['Livro', 'Artigo', 'Tese', 'Dissertação', 'Noticia', 'Relatorio', 'Lei/decreto', 'outros'];
  if (!validTypes.includes(tipo)) {
    throw new Error("Selecione um tipo de bibliografia válido.");
  }

  if (!autor) throw new Error("Informe o autor da bibliografia.");
  if (autor.length > 120) throw new Error("O nome do autor deve ter no máximo 120 caracteres.");

  if (descricao && descricao.length > 5000) {
    throw new Error("A descrição deve ter no máximo 5.000 caracteres.");
  }

  const links = association(values);
  if (!disciplina && Object.values(links).some(Boolean)) {
    throw new Error("Selecione a disciplina antes de vincular a bibliografia a uma atividade.");
  }

  return { titulo, tipo, autor, descricao, disciplina, ...links };
}

export async function getBibliography(profileId) {
  const { data, error } = await requireSupabase()
    .from("bibliografia")
    .select("*")
    .eq("perfil", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createBibliography(user, profile, values) {
  const metadata = details(values);
  const file = values.file?.size ? values.file : null;
  const link = String(values.link || "").trim();
  if (file && link) throw new Error("Escolha um link ou um arquivo, não os dois.");
  if (!file && !link) throw new Error("Informe um link ou selecione um arquivo.");

  const client = requireSupabase();
  let objectPath = null;
  let arquivo = false;

  if (file) {
    if (file.size > MAX_BIBLIOGRAPHY_SIZE) throw new Error("O arquivo deve ter no máximo 20 MB.");
    try {
      await provisionUserStorage();
    } catch (error) {
      console.error("Falha ao preparar o bucket para bibliografia", error);
      throw new Error("Não foi possível preparar seu espaço para arquivos. Publique a Edge Function provision-user-storage atualizada.");
    }
    objectPath = bibliographyPath(profile.id, file);
    const { error: uploadError } = await client.storage.from(user.email).upload(objectPath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      throw uploadError;
    }
    arquivo = true;
  }

  const { data, error } = await client
    .from("bibliografia")
    .insert({
      email_user: user.email,
      perfil: profile.id,
      ...metadata,
      link: objectPath || externalUrl(link),
      arquivo,
    })
    .select()
    .single();
  if (error) {
    if (objectPath) await client.storage.from(user.email).remove([objectPath]);
    throw error;
  }
  return data;
}

export async function updateBibliography(bibliographyId, user, profile, values) {
  const metadata = details(values);
  const file = values.file?.size ? values.file : null;
  const link = String(values.link || "").trim();

  // If there's an existing file or link we need to check if it has been replaced
  const client = requireSupabase();
  
  // Get original to know if we need to remove old file
  const { data: original, error: fetchError } = await client
    .from("bibliografia")
    .select("*")
    .eq("id", bibliographyId)
    .single();
  if (fetchError) throw fetchError;

  let objectPath = null;
  let arquivo = false;

  if (file) {
    if (file.size > MAX_BIBLIOGRAPHY_SIZE) throw new Error("O arquivo deve ter no máximo 20 MB.");
    try {
      await provisionUserStorage();
    } catch (error) {
      throw new Error("Não foi possível preparar o espaço para arquivos.");
    }
    objectPath = bibliographyPath(profile.id, file);
    const { error: uploadError } = await client.storage.from(user.email).upload(objectPath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) throw uploadError;
    arquivo = true;
  } else if (link) {
    arquivo = false;
  } else {
    // preserve old link/file type if neither is sent
    arquivo = original.arquivo;
    objectPath = original.link;
  }

  const { data, error } = await client
    .from("bibliografia")
    .update({
      ...metadata,
      link: objectPath || (link ? externalUrl(link) : original.link),
      arquivo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bibliographyId)
    .select()
    .single();

  if (error) {
    if (objectPath && objectPath !== original.link) {
      await client.storage.from(user.email).remove([objectPath]);
    }
    throw error;
  }

  // Clean up old file if it was replaced
  if (original.arquivo && (file || !arquivo) && original.link !== data.link) {
    await client.storage.from(user.email).remove([original.link]);
  }

  return data;
}

export async function getBibliographyUrl(user, record) {
  if (!record?.arquivo) return externalUrl(record?.link);
  const { data, error } = await requireSupabase()
    .storage.from(user.email)
    .createSignedUrl(record.link, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteBibliography(user, record) {
  const client = requireSupabase();
  if (record?.arquivo) {
    const { error: storageError } = await client.storage.from(user.email).remove([record.link]);
    if (storageError) throw storageError;
  }
  const { error } = await client.from("bibliografia").delete().eq("id", record.id);
  if (error) throw error;
}
