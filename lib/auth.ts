import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import type { Role, Session, StaffUser } from "./types";

const LEGACY = "ie_session";
const DAY = 60 * 60 * 12;
const ROLES: Role[] = ["admin", "kitchen", "delivery", "waiter", "customer"];

export function cookieName(role: Role) {
  return `ie_${role}`;
}

function isRole(value: string | null | undefined): value is Role {
  return ROLES.includes(value as Role);
}

function secret() {
  return process.env.SESSION_SECRET || "illimani-eats-dev-secret-cambia-esto";
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

function sealKey() {
  return createHash("sha256").update(secret()).digest();
}

export function sealPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function openPassword(sealed?: string) {
  if (!sealed) return "";
  const [iv, tag, data] = sealed.split(".");
  if (!iv || !tag || !data) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(user: Pick<StaffUser, "id" | "name" | "role">) {
  const session: Session = {
    sub: user.id,
    name: user.name,
    role: user.role,
    exp: Date.now() + DAY * 1000,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token?: string | null): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    if (!session.sub || !session.role) return null;
    return session;
  } catch {
    return null;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAY,
  };
}

export async function getSession(prefer?: Role) {
  const jar = await cookies();
  const hinted = prefer || (await hintedRole());
  if (hinted) {
    const own = decodeSession(jar.get(cookieName(hinted))?.value);
    if (own?.role === hinted) return own;
    const legacy = decodeSession(jar.get(LEGACY)?.value);
    return legacy?.role === hinted ? legacy : null;
  }
  const legacy = decodeSession(jar.get(LEGACY)?.value);
  if (legacy) return legacy;
  return decodeSession(jar.get(cookieName("customer"))?.value);
}

async function hintedRole() {
  const role = (await headers()).get("x-ie-role");
  return isRole(role) ? role : undefined;
}

export async function setSessionCookie(token: string) {
  const session = decodeSession(token);
  if (!session) return;
  const jar = await cookies();
  jar.set(cookieName(session.role), token, cookieOptions());
  jar.delete(LEGACY);
}

export async function clearSessionCookie(role?: Role) {
  const jar = await cookies();
  const target = role || (await hintedRole());
  if (target) {
    jar.delete(cookieName(target));
    const legacy = decodeSession(jar.get(LEGACY)?.value);
    if (!legacy || legacy.role === target) jar.delete(LEGACY);
    return;
  }
  for (const entry of ROLES) jar.delete(cookieName(entry));
  jar.delete(LEGACY);
}

export function assertRole(session: Session | null, roles: Role[]) {
  if (!session || !roles.includes(session.role)) {
    const error = new Error("No autorizado");
    (error as Error & { status: number }).status = 401;
    throw error;
  }
  return session;
}
