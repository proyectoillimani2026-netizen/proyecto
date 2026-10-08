import { getSession } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { HttpError } from "@/lib/orders";

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function GET() {
  const db = await readDb();
  const session = await getSession();
  return Response.json({
    restaurant: db.restaurant,
    mercadopago: session?.role === "admin" ? Boolean(process.env.MP_ACCESS_TOKEN) : undefined,
  });
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
    const body = (await request.json()) as Record<string, unknown>;
    const restaurant = await updateDb((db) => {
      const fee = Math.round(Number(body.deliveryFee));
      const freeFrom = Math.round(Number(body.freeDeliveryFrom));
      const pricePerKm = Math.round(Number(body.pricePerKm));
      if (!Number.isFinite(fee) || fee < 0) throw new HttpError(400, "El costo de envío no es válido.");
      if (!Number.isFinite(freeFrom) || freeFrom < 0) throw new HttpError(400, "El mínimo para envío gratis no es válido.");
      if (!Number.isFinite(pricePerKm) || pricePerKm < 0) throw new HttpError(400, "El precio por kilómetro no es válido.");
      db.restaurant = {
        name: clean(body.name, 60) || db.restaurant.name,
        tagline: clean(body.tagline, 160),
        address: clean(body.address, 80) || db.restaurant.address,
        city: clean(body.city, 60) || db.restaurant.city,
        country: clean(body.country, 40) || db.restaurant.country,
        cuisine: clean(body.cuisine, 40) || db.restaurant.cuisine,
        hours: clean(body.hours, 80),
        phone: clean(body.phone, 30),
        deliveryFee: fee,
        freeDeliveryFrom: freeFrom,
        pricePerKm,
        latitude: Number(body.latitude) || db.restaurant.latitude,
        longitude: Number(body.longitude) || db.restaurant.longitude,
        etaDelivery: clean(body.etaDelivery, 40) || db.restaurant.etaDelivery,
        etaPickup: clean(body.etaPickup, 40) || db.restaurant.etaPickup,
        banner: clean(body.banner, 400) || db.restaurant.banner || "",
      };
      return db.restaurant;
    });
    return Response.json({ restaurant });
  } catch (error) {
    return jsonError(error);
  }
}
