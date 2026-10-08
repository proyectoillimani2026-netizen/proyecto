import { getSession } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { HttpError, saveCourierSpot } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "delivery") return Response.json({ error: "No autorizado" }, { status: 401 });
    const body = (await request.json()) as { lat?: unknown; lng?: unknown };
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new HttpError(400, "La ubicación no es válida.");
    }
    const updated = await updateDb((db) => saveCourierSpot(db, session, lat, lng));
    return Response.json({ ok: true, updated });
  } catch (error) {
    return jsonError(error);
  }
}
