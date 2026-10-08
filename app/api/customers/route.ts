import { getSession } from "@/lib/auth";
import { readDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
  const db = await readDb();
  const customers = db.customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    confirmed: customer.emailVerified !== false,
    locationLabel: customer.locationLabel || "",
    createdAt: customer.createdAt || "",
  }));
  return Response.json({ customers });
}
