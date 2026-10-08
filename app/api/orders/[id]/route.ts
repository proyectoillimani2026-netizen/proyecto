import { getSession } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { applyOrderAction, deliveryPinDue, ensureDeliveryPin, HttpError, withoutCourierSpot, withoutDeliveryPin } from "@/lib/orders";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const db = await readDb();
  const order = db.orders.find((entry) => entry.id === id);
  if (!order) return Response.json({ error: "No encontramos ese pedido." }, { status: 404 });
  const session = await getSession();
  const owns = session?.role === "customer" && session.sub === order.customerId;
  if (owns) {
    const saved = deliveryPinDue(order)
      ? await updateDb((current) => {
          const found = current.orders.find((entry) => entry.id === id);
          if (!found) throw new HttpError(404, "No encontramos ese pedido.");
          ensureDeliveryPin(found);
          return found;
        })
      : order;
    const { messages: _messages, events: _events, ...publicOrder } = saved;
    return Response.json({ order: publicOrder });
  }
  const staff = session && session.role !== "customer";
  if (staff) return Response.json({ order: withoutDeliveryPin(order) });
  const { messages: _messages, events: _events, deliveryPin: _pin, ...publicOrder } = order;
  return Response.json({ order: withoutCourierSpot(publicOrder) });
}

export async function PATCH(request: Request, context: Context) {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: "No autorizado" }, { status: 401 });
    const { id } = await context.params;
    const body = (await request.json()) as { action?: string; text?: string; code?: string };
    if (!body.action) throw new HttpError(400, "Falta la acción.");
    const order = await updateDb((db) => applyOrderAction(db, id, body.action || "", session, body.text || "", body.code || ""));
    const visible = session.role === "customer" && session.sub === order.customerId ? order : withoutDeliveryPin(order);
    return Response.json({ order: visible });
  } catch (error) {
    return jsonError(error);
  }
}
