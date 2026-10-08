import { createHash, randomBytes } from "crypto";
import { HttpError } from "./orders";

const DAY = 24 * 60 * 60 * 1000;

export function newVerifyToken() {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    verifyTokenHash: hashToken(token),
    verifyExpires: Date.now() + DAY,
  };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function sendVerificationEmail(input: { to: string; name: string; token: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new HttpError(503, "Falta configurar el envío de correos para confirmar las cuentas.");
  }
  const link = `${appUrl()}/verificar?token=${encodeURIComponent(input.token)}`;
  const from = process.env.MAIL_FROM || "Illimani Eats <onboarding@resend.dev>";
  const subject = "Confirmá tu cuenta en Illimani Eats";
  const text = [
    `Hola ${input.name},`,
    "",
    "Para crear tu cuenta de cliente en Illimani Eats, confirmá este correo abriendo el enlace:",
    link,
    "",
    "El enlace vence en 24 horas. Si no pediste esta cuenta, podés ignorar este mensaje.",
    "",
    "Illimani Eats",
    "General Paz 59, Ciudad de Mendoza",
  ].join("\n");
  const html = `<p>Hola ${escapeHtml(input.name)},</p>
<p>Para crear tu cuenta de cliente en Illimani Eats, confirmá este correo.</p>
<p><a href="${link}">Confirmar mi cuenta</a></p>
<p>El enlace vence en 24 horas. Si no pediste esta cuenta, podés ignorar este mensaje.</p>
<p>Illimani Eats<br>General Paz 59, Ciudad de Mendoza</p>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.to], subject, html, text }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("No se pudo enviar el correo de confirmación.", response.status, detail);
    throw new HttpError(502, "No pudimos enviar el correo de confirmación. Probá de nuevo en unos minutos.");
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}
