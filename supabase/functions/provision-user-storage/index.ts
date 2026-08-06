// AKADEMO: função protegida para criar um bucket privado por e-mail.
// A SUPABASE_SERVICE_ROLE_KEY só existe nos secrets da Edge Function, nunca no front-end.
import { createClient } from "npm:@supabase/supabase-js@2";
// Mantém os headers sincronizados com o cliente Supabase atual (inclui headers novos de Functions).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function fileExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Método não permitido" }, { status: 405, headers: corsHeaders });

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Sessão ausente.");
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(projectUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const token = authorization.slice(7);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user?.email) throw new Error("Sessão inválida.");

    const user = authData.user;
    // O e-mail vem exclusivamente do JWT validado, nunca do corpo da requisição.
    const bucketId = user.email.toLowerCase();
    const { data: existingBucket } = await admin.storage.getBucket(bucketId);
    if (!existingBucket) {
      const { error: bucketError } = await admin.storage.createBucket(bucketId, {
        public: false,
        fileSizeLimit: "5MB",
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
      });
      // Duas requisições simultâneas podem tentar criar o mesmo bucket; isso é seguro.
      if (bucketError && !/already exists|duplicate/i.test(bucketError.message)) throw bucketError;
    }

    let photoPath: string | null = null;
    // Para Google, replica com segurança apenas avatares hospedados pelo próprio Google.
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
    if (user.app_metadata?.provider === "google" && avatarUrl) {
      // Uma falha ao obter a imagem do provedor jamais bloqueia o login nem a criação do bucket.
      try {
        const parsed = new URL(avatarUrl);
        const isGoogleImage = parsed.hostname === "googleusercontent.com" || parsed.hostname.endsWith(".googleusercontent.com");
        if (isGoogleImage) {
          const imageResponse = await fetch(parsed);
          const contentType = (imageResponse.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
          const contentLength = Number(imageResponse.headers.get("content-length") || 0);
          const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
          if (imageResponse.ok && acceptedTypes.includes(contentType) && contentLength <= 5 * 1024 * 1024) {
            const image = new Uint8Array(await imageResponse.arrayBuffer());
            if (image.byteLength <= 5 * 1024 * 1024) {
              photoPath = `foto_perfil_akademo.${fileExtension(contentType)}`;
              const { error: uploadError } = await admin.storage.from(bucketId).upload(photoPath, image, { upsert: true, contentType, cacheControl: "3600" });
              if (uploadError) throw uploadError;
              const { error: profileError } = await admin.from("users").update({ foto_perfil_path: `${bucketId}/${photoPath}` }).eq("id", user.id);
              if (profileError) throw profileError;
            }
          }
        }
      } catch (avatarError) {
        console.warn("Não foi possível replicar o avatar do Google", avatarError);
      }
    }
    return Response.json({ bucketId, photoPath }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível preparar o armazenamento.";
    return Response.json({ error: message }, { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
