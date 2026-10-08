import { resendConfirmation } from "@/lib/customer-auth";
import { jsonError } from "@/lib/http";
import { HttpError } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = String(body.email || "").trim().toLowerCase().slice(0, 80);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "El email no es válido.");
    await resendConfirmation(email);
    return Response.json({ ok: true, message: "Si ese correo tiene una cuenta pendiente, te reenviamos la confirmación." });
  } catch (error) {
    return jsonError(error);
  }
}
