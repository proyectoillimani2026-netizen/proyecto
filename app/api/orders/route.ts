import { getSession } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/db";
import { geocode } from "@/lib/geo";
import { jsonError } from "@/lib/http";
import { distanceKm } from "@/lib/format";
import { createCheckout } from "@/lib/mercadopago";
import { cancelOrder, createOrder, deliveryPinDue, ensureDeliveryPin, HttpError, ordersFor, withoutDeliveryPin, type CreateOrderInput } from "@/lib/orders";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return Response.json({ error: "No autorizado" }, { status: 401 });
    const db = await readDb();
    let orders = ordersFor(db, session);
    if (session.role === "customer") {
      if (orders.some(deliveryPinDue)) {
        orders = await updateDb((current) => {
          const list = ordersFor(current, session);
          for (const order of list) ensureDeliveryPin(order);
          return ordersFor(current, session);
        });
      }
      return Response.json({ orders: orders.map(({ messages: _messages, events: _events, ...order }) => order) });
    }
    return Response.json({ orders: orders.map(withoutDeliveryPin) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "customer") {
      return Response.json({ error: "Registrate o iniciá sesión para hacer un pedido." }, { status: 401 });
    }
    const body = (await request.json()) as CreateOrderInput;
    if (body.mode !== "pickup") {
      const place = await geocode(String(body.address || ""));
      if (!place) {
        return Response.json({ error: "No encontramos esa dirección. Probá con calle, número y Mendoza." }, { status: 400 });
      }
      const current = await readDb();
      body.distanceKm = distanceKm(current.restaurant.latitude, current.restaurant.longitude, place.lat, place.lng);
      body.destinationLat = place.lat;
      body.destinationLng = place.lng;
    }
    const order = await updateDb((db) => createOrder(db, { ...body, customerId: session.sub }));
    if (order.paymentMethod !== "mercadopago") return Response.json({ order });

    try {
      const checkout = await createCheckout(order, request);
      const saved = await updateDb((db) => {
        const current = db.orders.find((entry) => entry.id === order.id);
        if (!current) throw new HttpError(404, "No encontramos el pedido.");
        current.mpPreferenceId = checkout.preferenceId;
        current.mpInitPoint = checkout.checkoutUrl;
        current.updatedAt = new Date().toISOString();
        return current;
      });
      return Response.json({ order: saved, checkoutUrl: checkout.checkoutUrl });
    } catch (error) {
      await updateDb((db) => {
        const current = db.orders.find((entry) => entry.id === order.id);
        if (current) cancelOrder(db, current);
      });
      const message = error instanceof Error ? error.message : "No pudimos abrir Mercado Pago.";
      return Response.json({ error: message }, { status: 502 });
    }
  } catch (error) {
    return jsonError(error);
  }
}
