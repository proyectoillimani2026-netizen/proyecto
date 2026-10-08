import { jsonError } from "@/lib/http";
import { argentinaPhone } from "@/lib/format";
import { signUpCustomer } from "@/lib/customer-auth";
import { HttpError } from "@/lib/orders";

const pendingMessage = "Te enviamos un correo para confirmar la cuenta. Revisá la bandeja de entrada y el correo no deseado. El enlace vence en 24 horas.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; phone?: string; password?: string; lat?: number; lng?: number; label?: string };
    const name = String(body.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 80);
    const phone = argentinaPhone(String(body.phone || "").replace(/\s+/g, " ").trim().slice(0, 30));
    const password = String(body.password || "");
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const label = String(body.label || "").replace(/\s+/g, " ").trim().slice(0, 180);
    if (name.length < 2) throw new HttpError(400, "Decinos tu nombre.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "El email no es válido.");
    if (phone.length < 6) throw new HttpError(400, "Dejá un teléfono.");
    if (password.length < 6) throw new HttpError(400, "La clave tiene que tener al menos 6 caracteres.");

    await signUpCustomer({
      name,
      email,
      phone,
      password,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      label,
    });
    return Response.json({ pending: true, message: pendingMessage });
  } catch (error) {
    return jsonError(error);
  }
}
