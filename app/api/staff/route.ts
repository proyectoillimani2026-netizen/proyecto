import { randomUUID } from "crypto";
import { getSession, hashPassword, openPassword, sealPassword } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { HttpError } from "@/lib/orders";
import type { PublicUser, Role, StaffUser } from "@/lib/types";

function publicUser(user: StaffUser): PublicUser {
  return { id: user.id, name: user.name, username: user.username, role: user.role };
}

export async function GET() {
  const session = await getSession();
  if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
  const db = await readDb();
  return Response.json({
    users: db.users.map((user) => ({ ...publicUser(user), password: openPassword(user.passwordSeal) })),
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
    const body = (await request.json()) as { name?: string; username?: string; password?: string; role?: Role };
    const name = String(body.name || "").trim().slice(0, 60);
    const username = String(body.username || "").trim().toLowerCase().slice(0, 30);
    const password = String(body.password || "");
    const role = body.role;
    if (name.length < 2) throw new HttpError(400, "Falta el nombre.");
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new HttpError(400, "El usuario tiene que tener 3 a 30 letras o números.");
    if (password.length < 6) throw new HttpError(400, "La clave tiene que tener al menos 6 caracteres.");
    if (role !== "admin" && role !== "kitchen" && role !== "delivery" && role !== "waiter") throw new HttpError(400, "Elegí un rol.");

    const user = await updateDb((db) => {
      if (db.users.some((entry) => entry.username === username)) {
        throw new HttpError(400, "Ese usuario ya existe.");
      }
      const next: StaffUser = { id: randomUUID(), name, username, passwordHash: hashPassword(password), passwordSeal: sealPassword(password), role };
      db.users.push(next);
      return publicUser(next);
    });
    return Response.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}
