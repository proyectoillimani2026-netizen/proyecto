export type Place = { lat: number; lng: number; label: string; short: string };

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
};

type NominatimHit = { lat: string; lon: string; display_name: string; address?: NominatimAddress };

const NORTH = -32.55;
const SOUTH = -33.25;
const WEST = -69.35;
const EAST = -68.5;
function shortName(hit: NominatimHit) {
  const address = hit.address || {};
  const street = [address.road || address.pedestrian || "", address.house_number || ""].filter(Boolean).join(" ");
  const area = address.suburb || address.neighbourhood || address.city || address.town || address.village || address.municipality || "";
  if (street && area) return `${street}, ${area}`;
  if (street) return street;
  return hit.display_name.split(",").slice(0, 2).join(",").trim();
}

function toPlace(hit: NominatimHit): Place | null {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: hit.display_name, short: shortName(hit) };
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
  };
};

function photonPlace(feature: PhotonFeature): Place | null {
  const [lng, lat] = feature.geometry?.coordinates || [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat > NORTH || lat < SOUTH || lng < WEST || lng > EAST) return null;
  const props = feature.properties || {};
  if (props.state && !/mendoza/i.test(props.state)) return null;
  const street = [props.street || props.name || "", props.housenumber || ""].filter(Boolean).join(" ");
  const area = props.locality || props.district || props.city || props.county || "";
  const short = street && area ? `${street}, ${area}` : street || area;
  if (!short) return null;
  const label = [street, area, props.city, props.county, "Mendoza, Argentina"].filter(Boolean).join(", ");
  return { lat, lng, label, short };
}

async function lookup(url: string): Promise<Place[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "IllimaniEats/1.0 (delivery local, Mendoza)",
        "Accept-Language": "es",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as NominatimHit | NominatimHit[];
    const hits = Array.isArray(data) ? data : [data];
    return hits.map(toPlace).filter((place): place is Place => place !== null);
  } catch {
    return [];
  }
}

async function search(query: string, limit: number): Promise<Place[]> {
  const text = query.replace(/\s+/g, " ").trim();
  if (text.length < 3) return [];
  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&bbox=${WEST},${SOUTH},${EAST},${NORTH}&limit=${limit}`,
      {
        headers: { "User-Agent": "IllimaniEats/1.0 (delivery local, Mendoza)", Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    return (data.features || []).flatMap((feature) => {
      const place = photonPlace(feature);
      if (!place) return [];
      const id = `${place.lat},${place.lng},${place.short}`;
      if (seen.has(id)) return [];
      seen.add(id);
      return [place];
    });
  } catch {
    return [];
  }
}

export async function searchPlaces(query: string): Promise<Place[]> {
  return search(query, 5);
}

export async function geocode(query: string): Promise<Place | null> {
  const places = await searchPlaces(query);
  return places[0] || null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const places = await lookup(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`);
  return places[0] || null;
}
