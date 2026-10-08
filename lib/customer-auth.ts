import { readDb, updateDb } from "./db";
import { HttpError } from "./orders";
import type { Customer } from "./types";

type AuthUser = {
  id?: string;
  email?: string;
  identities?: unknown[];
  user_metadata?: Record<string, unknown>;
};

type AuthBody = {
  id?: string;
  email?: string;
  identities?: unknown[];
  error?: string;
  error_code?: string;
  error_description?: string;
  msg?: string;
  message?: string;
  user?: AuthUser;
};

function settings() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new HttpError(503, "Falta la configuración de Supabase.");
  return { url: url.replace(/\/$/, ""), key };
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function redirectTo() {
  return `${appUrl()}/verificar`;
}

async function authRequest(path: string, body: unknown) {
  const { url, key } = settings();
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as AuthBody;
  return { response, data };
}

function readUser(data: AuthBody): AuthUser | undefined {
  if (data.user?.id || data.user?.email || Array.isArray(data.user?.identities)) return data.user;
  if (data.id || data.email || Array.isArray(data.identities)) {
    return { id: data.id, email: data.email, identities: data.identities };
  }
  return undefined;
}

export function spanishAuthError(status: number, data: AuthBody) {
  const code = String(data.error_code || data.error || "").toLowerCase();
  const text = `${code} ${data.msg || ""} ${data.message || ""} ${data.error_description || ""}`.toLowerCase();
  if (text.includes("not authorized") || code.includes("email_address_not_authorized")) {
    return new HttpError(400, "Ese correo todavía no puede recibir la confirmación. Supabase, en el plan gratuito, solo se la envía a las cuentas del equipo hasta conectar un correo propio.");
  }
  if (text.includes("already") || code.includes("user_already_exists")) {
    return new HttpError(400, "Ese email ya está registrado.");
  }
  if (text.includes("rate") || code.includes("over_email_send_rate_limit")) {
    return new HttpError(429, "Se alcanzó el límite de correos de Supabase. Probá de nuevo dentro de una hora.");
  }
  if (text.includes("not confirmed") || code.includes("email_not_confirmed")) {
    return new HttpError(403, "Confirmá tu correo antes de entrar. Revisá la bandeja de entrada.");
  }
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return new HttpError(401, "Usuario o clave incorrectos.");
  }
  return new HttpError(status >= 400 && status < 500 ? status : 400, "No pudimos completar el ingreso. Revisá el correo y la clave.");
}

export async function signUpCustomer(input: { name: string; email: string; phone: string; password: string; lat?: number; lng?: number; label?: string }) {
  const db = await readDb();
  const existing = db.customers.find((entry) => entry.email === input.email);
  if (existing && existing.passwordHash !== "supabase" && existing.emailVerified !== false) {
    throw new HttpError(400, "Ese email ya está registrado.");
  }
  const dataPayload: Record<string, unknown> = { name: input.name, phone: input.phone };
  if (input.label && Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
    dataPayload.lat = input.lat;
    dataPayload.lng = input.lng;
    dataPayload.label = input.label;
  }
  const { response, data } = await authRequest(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo())}`, {
    email: input.email,
    password: input.password,
    data: dataPayload,
  });
  if (!response.ok) throw spanishAuthError(response.status, data);
  const created = readUser(data);
  if (Array.isArray(created?.identities) && created.identities.length === 0) {
    throw new HttpError(400, "Ese email ya está registrado. Si no confirmaste el correo, pedí que te lo reenviemos.");
  }
  const id = created?.id;
  if (!id) throw new HttpError(502, "No pudimos crear la cuenta.");
  const hasPlace = input.label && Number.isFinite(input.lat) && Number.isFinite(input.lng);
  await updateDb((current) => {
    let customer = current.customers.find((entry) => entry.email === input.email || entry.id === id);
    if (!customer) {
      customer = {
        id,
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: "supabase",
        emailVerified: false,
        createdAt: new Date().toISOString(),
      };
      current.customers.push(customer);
    }
    customer.name = input.name;
    customer.phone = input.phone;
    customer.passwordHash = "supabase";
    customer.emailVerified = false;
    if (hasPlace) {
      customer.latitude = input.lat;
      customer.longitude = input.lng;
      customer.locationLabel = input.label;
    }
  });
}

export async function confirmSignup(tokenHash: string, type = "signup") {
  const { response, data } = await authRequest("/auth/v1/verify", { token_hash: tokenHash, type });
  if (!response.ok) {
    const text = `${data.error_code || ""} ${data.msg || ""} ${data.error_description || ""} ${data.message || ""}`.toLowerCase();
    if (text.includes("expired") || text.includes("invalid") || text.includes("already")) return { already: true };
    throw spanishAuthError(response.status, data);
  }
  const user = readUser(data);
  if (user?.email || user?.id) {
    await updateDb((db) => {
      const customer = db.customers.find((entry) => entry.id === user.id || entry.email === user.email);
      if (customer) customer.emailVerified = true;
    });
  }
  return { already: false };
}

export async function resendConfirmation(email: string) {
  const { response, data } = await authRequest(`/auth/v1/resend?redirect_to=${encodeURIComponent(redirectTo())}`, {
    type: "signup",
    email,
  });
  if (!response.ok) throw spanishAuthError(response.status, data);
}

export async function signInCustomer(email: string, password: string) {
  const { response, data } = await authRequest("/auth/v1/token?grant_type=password", { email, password });
  if (!response.ok) throw spanishAuthError(response.status, data);
  const user = readUser(data);
  if (!user?.id || !user.email) throw new HttpError(401, "Usuario o clave incorrectos.");
  const meta = user.user_metadata || {};
  const name = String(meta.name || "").trim() || "Cliente";
  const phone = String(meta.phone || "").trim();
  const label = String(meta.label || "").trim();
  const lat = Number(meta.lat);
  const lng = Number(meta.lng);
  return updateDb((db) => {
    let customer = db.customers.find((entry) => entry.id === user.id || entry.email === user.email);
    if (!customer) {
      customer = {
        id: user.id as string,
        name,
        email: user.email as string,
        phone,
        passwordHash: "supabase",
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };
      db.customers.push(customer);
    }
    customer.emailVerified = true;
    customer.name = name || customer.name;
    if (phone) customer.phone = phone;
    if (Number.isFinite(lat) && Number.isFinite(lng) && label) {
      customer.latitude = lat;
      customer.longitude = lng;
      customer.locationLabel = label;
    }
    return customer;
  });
}

export function isSupabaseCustomer(customer: Customer) {
  return customer.passwordHash === "supabase";
}
