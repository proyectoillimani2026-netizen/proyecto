export async function uploadWebp(path: string, bytes: Buffer) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  const secret = process.env.SUPABASE_UPLOAD_SECRET || "";
  if (!supabaseUrl || !anonKey || !secret) {
    throw new Error("Falta la configuración de Supabase Storage.");
  }
  const response = await fetch(`${supabaseUrl}/functions/v1/upload-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
      "x-upload-secret": secret,
    },
    body: JSON.stringify({ path, base64: bytes.toString("base64") }),
  });
  const data = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !data.url) {
    throw new Error(data.error || "No se pudo guardar la imagen.");
  }
  return data.url;
}
