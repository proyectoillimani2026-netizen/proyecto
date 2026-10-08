import { distanceKm } from "@/lib/format";

type Stop = { lat: number; lng: number };

function parseStops(value: string): Stop[] | null {
  const stops = value.split(";").map((part) => {
    const [lat, lng] = part.split(",").map(Number);
    return { lat, lng };
  });
  if (stops.length < 2 || stops.length > 4) return null;
  if (stops.some((stop) => !Number.isFinite(stop.lat) || !Number.isFinite(stop.lng))) return null;
  if (stops.some((stop) => Math.abs(stop.lat) > 90 || Math.abs(stop.lng) > 180)) return null;
  return stops;
}

function fallback(stops: Stop[]) {
  const legs = [];
  for (let index = 1; index < stops.length; index += 1) {
    const km = distanceKm(stops[index - 1].lat, stops[index - 1].lng, stops[index].lat, stops[index].lng);
    legs.push({ distance: km * 1000, duration: Math.max(60, (km / 25) * 3600) });
  }
  return { path: stops, legs, approximate: true };
}

export async function GET(request: Request) {
  const stops = parseStops(new URL(request.url).searchParams.get("points") || "");
  if (!stops) return Response.json({ error: "La ruta no es válida." }, { status: 400 });

  const coords = stops.map((stop) => `${stop.lng},${stop.lat}`).join(";");
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`, {
      headers: { "User-Agent": "IllimaniEats/1.0 (delivery local, Mendoza)" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (!response.ok || !Array.isArray(coordinates) || !route.legs) {
      return Response.json(fallback(stops));
    }
    return Response.json({
      path: coordinates.map((pair: number[]) => ({ lng: pair[0], lat: pair[1] })),
      legs: route.legs.map((leg: { distance: number; duration: number }) => ({
        distance: leg.distance,
        duration: leg.duration,
      })),
      approximate: false,
    });
  } catch {
    return Response.json(fallback(stops));
  }
}
