import { getSession } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { argentinaPhone } from "@/lib/format";
import { jsonError } from "@/lib/http";
import { HttpError } from "@/lib/orders";

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "customer") return Response.json({ error: "No autorizado" }, { status: 401 });
    const body = (await request.json()) as { lat?: number; lng?: number; label?: string; name?: string; phone?: string; email?: string };
    const profile = body.name != null || body.phone != null || body.email != null;

    const customer = await updateDb((db) => {
      const current = db.customers.find((entry) => entry.id === session.sub);
      if (!current) throw new HttpError(404, "No encontramos la cuenta.");
      if (profile) {
        const name = clean(body.name, 80);
        const phone = argentinaPhone(clean(body.phone, 30));
        const email = clean(body.email, 80).toLowerCase();
        if (name.length < 2) throw new HttpError(400, "Decinos tu nombre.");
        if (phone.length < 6) throw new HttpError(400, "Dejá un teléfono válido.");
        if (!email.includes("@")) throw new HttpError(400, "El email no es válido.");
        const taken = db.customers.some((entry) => entry.id !== current.id && entry.email.toLowerCase() === email);
        if (taken) throw new HttpError(400, "Ese email ya está en otra cuenta.");
        current.name = name;
        current.phone = phone;
        current.email = email;
      }
      if (body.lat != null || body.lng != null || body.label != null) {
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        const label = clean(body.label, 180);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, "La ubicación no es válida.");
        if (label.length < 3) throw new HttpError(400, "Falta el nombre de la calle.");
        current.latitude = lat;
        current.longitude = lng;
        current.locationLabel = label;
      }
      return {
        name: current.name,
        phone: current.phone,
        email: current.email,
        lat: current.latitude,
        lng: current.longitude,
        label: current.locationLabel || "",
      };
    });
    return Response.json({ profile: customer });
  } catch (error) {
    return jsonError(error);
  }
}
