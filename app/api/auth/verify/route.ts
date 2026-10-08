import { confirmSignup } from "@/lib/customer-auth";
import { updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { hashToken } from "@/lib/mail";
import { HttpError } from "@/lib/orders";

const confirmed = "Tu cuenta ya está confirmada. Ya podés entrar y hacer un pedido.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; token_hash?: string; type?: string };
    const tokenHash = String(body.token_hash || "").trim();
    const token = String(body.token || "").trim();
    if (tokenHash) {
      const result = await confirmSignup(tokenHash, String(body.type || "signup"));
      return Response.json({
        ok: true,
        message: result.already
          ? "Tu cuenta ya estaba confirmada. Entrá con tu correo y tu clave."
          : confirmed,
      });
    }
    if (token.length < 20) throw new HttpError(400, "El enlace de confirmación no es válido.");
    const hash = hashToken(token);
    await updateDb((db) => {
      const customer = db.customers.find((entry) => entry.verifyTokenHash === hash);
      if (!customer || !customer.verifyExpires || customer.verifyExpires < Date.now()) {
        throw new HttpError(400, "El enlace venció o ya se usó. Si la cuenta ya quedó confirmada, entrá con tu correo y tu clave.");
      }
      customer.emailVerified = true;
      delete customer.verifyTokenHash;
      delete customer.verifyExpires;
    });
    return Response.json({ ok: true, message: confirmed });
  } catch (error) {
    return jsonError(error);
  }
}
