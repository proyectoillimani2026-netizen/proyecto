import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { toWebp } from "@/lib/images";
import { uploadWebp } from "@/lib/storage";

export async function POST(request: Request) {
  const session = await getSession();
  if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Elegí una imagen." }, { status: 400 });
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return Response.json({ error: "Subí una foto JPG, PNG o WebP." }, { status: 400 });
  }
  if (file.size > 8_000_000) return Response.json({ error: "La imagen puede pesar hasta 8 MB." }, { status: 400 });

  try {
    const original = Buffer.from(await file.arrayBuffer());
    const [thumb, large] = await Promise.all([toWebp(original, 256), toWebp(original, 720)]);
    const id = `${Date.now()}-${randomBytes(4).toString("hex")}`;
    await uploadWebp(`menu/${id}-256.webp`, thumb);
    const url = await uploadWebp(`menu/${id}-720.webp`, large);
    return Response.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos convertir esa imagen.";
    return Response.json({ error: message }, { status: 400 });
  }
}
