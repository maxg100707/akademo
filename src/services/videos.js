import { extensionFromFile } from "../utils/formatters.js";
import { requireSupabase } from "./supabase.js";
import { provisionUserStorage } from "./users.js";

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const optional = (value) => String(value || "").trim() || null;

function association(values) {
  const links = [
    ["aula", values.lessonId],
    ["prova", values.examId],
    ["apresentacao", values.presentationId],
  ].filter(([, value]) => Boolean(value));
  if (links.length > 1) {
    throw new Error("Escolha somente uma aula, prova ou apresentação para o vídeo.");
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
    throw new Error("Informe um link de vídeo válido, iniciado por http:// ou https://.");
  }
}

function videoPath(profileId, file) {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
  const extension = extensionFromFile(file) || "mp4";
  return `videos/${profileId}/${Date.now()}-${random}.${extension}`;
}

function details(values) {
  const nome = String(values.name || values.nome || "").trim();
  const descricao = optional(values.description ?? values.descricao);
  const disciplina = optional(values.disciplineId ?? values.disciplina);
  if (!nome) throw new Error("Informe o nome do vídeo.");
  if (nome.length > 180) throw new Error("O nome do vídeo deve ter no máximo 180 caracteres.");
  if (descricao && descricao.length > 5000) throw new Error("A descrição deve ter no máximo 5.000 caracteres.");
  const links = association(values);
  if (!disciplina && Object.values(links).some(Boolean)) {
    throw new Error("Selecione a disciplina antes de vincular o vídeo a uma atividade.");
  }
  return { nome, descricao, disciplina, ...links };
}

function isVideoFile(file) {
  return Boolean(file?.type?.startsWith("video/"));
}

export async function getVideos(profileId) {
  const { data, error } = await requireSupabase()
    .from("videos")
    .select("*")
    .eq("perfil", profileId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createVideo(user, profile, values) {
  const metadata = details(values);
  const file = values.file?.size ? values.file : null;
  const link = String(values.link || "").trim();
  if (file && link) throw new Error("Escolha um link ou um arquivo de vídeo, não os dois.");
  if (!file && !link) throw new Error("Informe um link ou selecione um arquivo de vídeo.");

  const client = requireSupabase();
  let objectPath = null;
  let arquivoNoBucket = false;
  if (file) {
    if (!isVideoFile(file)) throw new Error("Selecione um arquivo de vídeo válido.");
    if (file.size > MAX_VIDEO_SIZE) throw new Error("O vídeo deve ter no máximo 50 MB.");
    try {
      await provisionUserStorage();
    } catch (error) {
      console.error("Falha ao preparar o bucket para vídeo", error);
      throw new Error("Não foi possível preparar seu espaço para vídeos. Publique a Edge Function provision-user-storage atualizada e tente novamente.");
    }
    objectPath = videoPath(profile.id, file);
    const { error: uploadError } = await client.storage.from(user.email).upload(objectPath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      if (Number(uploadError.statusCode) === 400) {
        throw new Error("O bucket ainda não está preparado para vídeos. Publique a versão atualizada da Edge Function provision-user-storage e tente novamente.");
      }
      throw uploadError;
    }
    arquivoNoBucket = true;
  }

  const { data, error } = await client
    .from("videos")
    .insert({
      email_user: user.email,
      perfil: profile.id,
      ...metadata,
      link: objectPath || externalUrl(link),
      arquivo_no_bucket: arquivoNoBucket,
    })
    .select()
    .single();
  if (error) {
    if (objectPath) await client.storage.from(user.email).remove([objectPath]);
    throw error;
  }
  return data;
}

export async function getVideoUrl(user, video) {
  if (!video?.arquivo_no_bucket) return externalUrl(video?.link);
  const { data, error } = await requireSupabase()
    .storage.from(user.email)
    .createSignedUrl(video.link, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteVideo(user, video) {
  const client = requireSupabase();
  if (video?.arquivo_no_bucket) {
    const { error: storageError } = await client.storage.from(user.email).remove([video.link]);
    if (storageError) throw storageError;
  }
  const { error } = await client.from("videos").delete().eq("id", video.id);
  if (error) throw error;
}
