import { getSession } from "@/lib/auth";
import { readDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ user: null });
  if (session.role !== "customer") {
    return Response.json({ user: { id: session.sub, name: session.name, role: session.role } });
  }
  const db = await readDb();
  const customer = db.customers.find((entry) => entry.id === session.sub);
  return Response.json({
    user: {
      id: session.sub,
      name: customer?.name || session.name,
      role: session.role,
      email: customer?.email || "",
      phone: customer?.phone || "",
      latitude: customer?.latitude,
      longitude: customer?.longitude,
      locationLabel: customer?.locationLabel || "",
    },
  });
}
