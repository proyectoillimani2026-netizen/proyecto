import { clearSessionCookie, encodeSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { isSupabaseCustomer, signInCustomer } from "@/lib/customer-auth";
import { readDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { HttpError } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const db = await readDb();
    const user = db.users.find((entry) => entry.username === username);
    if (user && verifyPassword(password, user.passwordHash)) {
      await setSessionCookie(encodeSession(user));
      return Response.json({
        user: { id: user.id, name: user.name, username: user.username, role: user.role },
      });
    }
    if (username.includes("@")) {
      try {
        const customer = await signInCustomer(username, password);
        await setSessionCookie(encodeSession({ id: customer.id, name: customer.name, role: "customer" }));
        return Response.json({ user: { id: customer.id, name: customer.name, role: "customer" } });
      } catch (error) {
        if (error instanceof HttpError && error.status === 403) {
          return Response.json({ error: error.message, code: "unverified" }, { status: 403 });
        }
        if (!(error instanceof HttpError) || error.status !== 401) throw error;
      }
    }
    const customer = db.customers.find((entry) => entry.email === username);
    if (!customer || isSupabaseCustomer(customer) || !verifyPassword(password, customer.passwordHash)) {
      return Response.json({ error: "Usuario o clave incorrectos." }, { status: 401 });
    }
    if (customer.emailVerified === false) {
      return Response.json({ error: "Confirmá tu correo antes de entrar. Revisá la bandeja de entrada.", code: "unverified" }, { status: 403 });
    }
    await setSessionCookie(encodeSession({ id: customer.id, name: customer.name, role: "customer" }));
    return Response.json({ user: { id: customer.id, name: customer.name, role: "customer" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
