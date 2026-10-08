import { getSession, hashPassword, sealPassword } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { HttpError } from "@/lib/orders";
import type { Role } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

const roles: Role[] = ["admin", "kitchen", "delivery", "waiter"];

export async function PATCH(request: Request, context: Context) {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
    const { id } = await context.params;
    const body = (await request.json()) as { name?: string; username?: string; password?: string; role?: Role };
    const name = String(body.name || "").trim().slice(0, 60);
    const username = String(body.username || "").trim().toLowerCase().slice(0, 30);
    const password = String(body.password || "");
    const role = body.role;
    if (name.length < 2) throw new HttpError(400, "Falta el nombre.");
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new HttpError(400, "El usuario tiene que tener 3 a 30 letras o números.");
    if (password && password.length < 6) throw new HttpError(400, "La clave tiene que tener al menos 6 caracteres.");
    if (!role || !roles.includes(role)) throw new HttpError(400, "Elegí un rol.");
    const user = await updateDb((db) => {
      const current = db.users.find((entry) => entry.id === id);
      if (!current) throw new HttpError(404, "No encontramos esa persona.");
      if (db.users.some((entry) => entry.id !== current.id && entry.username === username)) {
        throw new HttpError(400, "Ese usuario ya existe.");
      }
      if (current.id === session.sub && role !== current.role) throw new HttpError(400, "No podés cambiar tu propio rol.");
      const admins = db.users.filter((entry) => entry.role === "admin");
      if (current.role === "admin" && role !== "admin" && admins.length <= 1) {
        throw new HttpError(400, "Tiene que quedar al menos un administrador.");
      }
      current.name = name;
      current.username = username;
      current.role = role;
      if (password) {
        current.passwordHash = hashPassword(password);
        current.passwordSeal = sealPassword(password);
      }
      return { id: current.id, name: current.name, username: current.username, role: current.role };
    });
    return Response.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
    const { id } = await context.params;
    await updateDb((db) => {
      const user = db.users.find((entry) => entry.id === id);
      if (!user) throw new HttpError(404, "No encontramos esa persona.");
      if (user.id === session.sub) throw new HttpError(400, "No podés borrar tu propio usuario.");
      const admins = db.users.filter((entry) => entry.role === "admin");
      if (user.role === "admin" && admins.length <= 1) throw new HttpError(400, "Tiene que quedar al menos un administrador.");
      db.users = db.users.filter((entry) => entry.id !== id);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
