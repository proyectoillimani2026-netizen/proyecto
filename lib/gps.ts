export type GpsPlace = { lat: number; lng: number; label: string; short: string };

function once(highAccuracy: boolean, timeout: number) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout,
      maximumAge: 120000,
    });
  });
}

export function locationError(error: { code?: number }) {
  if (error.code === 1) {
    return "El navegador bloqueó la ubicación de este sitio. En el candado de la barra, permití Ubicación para localhost y volvé a intentar.";
  }
  return "Esta notebook no tiene GPS de celular. Windows la ubica por Wi-Fi, pero el servicio de ubicación está apagado. En Configuración, Privacidad, Ubicación, activá el servicio de ubicación.";
}

export async function readCoordinates() {
  if (!navigator.geolocation) throw Object.assign(new Error(locationError({})), { code: 0 });
  try {
    const position = await once(false, 20000);
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (error) {
    const failure = error as GeolocationPositionError;
    if (failure.code === 1) throw failure;
    const position = await once(true, 10000);
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  }
}

export async function readGps(): Promise<GpsPlace> {
  const { lat, lng } = await readCoordinates().catch((error) => {
    throw new Error(locationError(error));
  });
  const response = await fetch(`/api/geo?lat=${lat}&lng=${lng}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No pudimos nombrar esa ubicación.");
  return { lat, lng, label: data.place.label as string, short: data.place.short as string };
}
