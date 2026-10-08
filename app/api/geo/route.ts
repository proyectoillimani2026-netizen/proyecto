import { geocode, reverseGeocode, searchPlaces } from "@/lib/geo";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (params.has("lat") || params.has("lng")) {
    const place = await reverseGeocode(lat, lng);
    if (!place) return Response.json({ error: "No pudimos leer esa ubicación." }, { status: 404 });
    return Response.json({ place });
  }
  const query = params.get("q") || "";
  if (params.get("suggest") === "1") {
    const places = await searchPlaces(query);
    return Response.json({ places });
  }
  const place = await geocode(query);
  if (!place) {
    return Response.json({ error: "No encontramos esa dirección. Probá con calle, número y barrio." }, { status: 404 });
  }
  return Response.json({ place });
}
