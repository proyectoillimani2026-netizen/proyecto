"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceKm, formatKm } from "@/lib/format";
import { locationError, readCoordinates } from "@/lib/gps";
import type { Order } from "@/lib/types";
import { MiniMap } from "./MiniMap";

type Spot = { lat: number; lng: number };
type Leg = { distance: number; duration: number };

function minutes(seconds: number) {
  const total = Math.max(1, Math.round(seconds / 60));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function takenOrders(orders: Order[], userId: string) {
  if (!userId) return [];
  return orders.filter((order) => order.mode === "delivery" && order.courierId === userId && order.status !== "delivered" && order.status !== "cancelled" && order.status !== "pending_payment");
}

export function DeliveryRoute({ orders, userId }: { orders: Order[]; userId: string }) {
  const open = useMemo(() => takenOrders(orders, userId), [orders, userId]);
  const preferred = open.find((order) => order.status === "out_for_delivery") || open[0];
  const [orderId, setOrderId] = useState("");
  const [here, setHere] = useState<Spot | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [asking, setAsking] = useState(false);
  const [shop, setShop] = useState<Spot | null>(null);
  const [destination, setDestination] = useState<Spot | null>(null);
  const [path, setPath] = useState<Spot[]>([]);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [approximate, setApproximate] = useState(false);
  const [routeError, setRouteError] = useState("");

  const selected = open.find((order) => order.id === orderId) || preferred;

  useEffect(() => {
    if (preferred && !orderId) setOrderId(preferred.id);
  }, [preferred, orderId]);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const place = data.restaurant;
        if (place && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
          setShop({ lat: place.latitude, lng: place.longitude });
        }
      })
      .catch(() => setRouteError("No pudimos ubicar el local."));
  }, []);

  useEffect(() => {
    if (!selected || selected.mode !== "delivery") {
      setDestination(null);
      return;
    }
    if (Number.isFinite(selected.destinationLat) && Number.isFinite(selected.destinationLng)) {
      setDestination({ lat: selected.destinationLat as number, lng: selected.destinationLng as number });
      return;
    }
    let gone = false;
    setDestination(null);
    fetch(`/api/geo?q=${encodeURIComponent(selected.address)}`)
      .then((response) => response.json())
      .then((data) => {
        if (gone || !data.place) return;
        setDestination({ lat: data.place.lat, lng: data.place.lng });
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, [selected]);

  function locate() {
    setAsking(true);
    setGpsError("");
    readCoordinates()
      .then((spot) => setHere(spot))
      .catch((error) => {
        setHere(null);
        setGpsError(locationError(error));
      })
      .finally(() => setAsking(false));
  }

  useEffect(() => {
    locate();
  }, []);

  useEffect(() => {
    if (!here || !userId || open.length === 0) return;
    const send = () => {
      fetch("/api/courier/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(here),
      }).catch(() => undefined);
    };
    send();
    const timer = setInterval(send, 15000);
    return () => clearInterval(timer);
  }, [here, userId, open.length]);

  useEffect(() => {
    if (!here || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setHere((current) => (current && distanceKm(current.lat, current.lng, next.lat, next.lng) < 0.03 ? current : next));
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 60000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [Boolean(here)]);

  const carrying = selected?.status === "out_for_delivery";
  const stops = here && shop
    ? carrying && destination
      ? [here, destination]
      : destination
        ? [here, shop, destination]
        : [here, shop]
    : [];
  const stopKey = stops.map((stop) => `${stop.lat.toFixed(3)},${stop.lng.toFixed(3)}`).join(";");

  useEffect(() => {
    if (!stopKey) return;
    let gone = false;
    fetch(`/api/route?points=${encodeURIComponent(stopKey)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (gone) return;
        if (!responseOk(data)) {
          setRouteError(data.error || "No pudimos armar la ruta.");
          return;
        }
        setPath(data.path || []);
        setLegs(data.legs || []);
        setApproximate(Boolean(data.approximate));
        setRouteError("");
      })
      .catch(() => {
        if (!gone) setRouteError("No pudimos armar la ruta.");
      });
    return () => {
      gone = true;
    };
  }, [stopKey]);

  const split = splitRoute(path.length > 1 ? path : stops, shop, carrying);
  const points = [
    ...(here ? [{ ...here, color: "#1d4e89" }] : []),
    ...(shop ? [{ ...shop, color: "#9b2335" }] : []),
    ...(destination ? [{ ...destination, color: "#1c7a49" }] : []),
  ];
  const toShop = !carrying && legs[0] ? legs[0] : null;
  const toDrop = carrying ? legs[0] : legs[1];

  return (
    <section className="hero-route delivery-map">
      <h2>Mapa</h2>
      {gpsError ? (
        <div className="gps-ask">
          <p>{gpsError}</p>
          <button className="btn" type="button" onClick={locate} disabled={asking}>{asking ? "Buscando GPS..." : "Activar ubicación"}</button>
        </div>
      ) : null}
      {!gpsError && !here ? <p className="muted">{asking ? "Buscando tu GPS..." : "Hace falta el GPS para armar la ruta."}</p> : null}
      {here && points.length > 0 ? (
        <MiniMap points={points} path={split.toShop} dropPath={split.toClient} ratio={0.62} maxHeight={320} minHeight={220} interactive />
      ) : null}
      {here ? (
        <p className="map-key">
          <span><i style={{ background: "#1d4e89" }} /> Vos</span>
          <span><i style={{ background: "#9b2335" }} /> Local</span>
          {destination ? <span><i style={{ background: "#1c7a49" }} /> Destino</span> : null}
        </p>
      ) : null}
      {toShop ? <p><b>{minutes(toShop.duration)}</b> hasta el local · {formatKm(toShop.distance / 1000)}</p> : null}
      {toDrop ? <p><b>{minutes(toDrop.duration)}</b> {carrying ? "hasta el destino" : "del local al destino"} · {formatKm(toDrop.distance / 1000)}</p> : null}
      {here && !selected ? <p className="muted">Cuando tomes un pedido, aparece el destino.</p> : null}
      {selected ? <p className="muted">{selected.code} · {selected.address}</p> : null}
      {open.length > 1 ? (
        <label>
          Pedido en el mapa
          <select value={selected?.id || ""} onChange={(event) => setOrderId(event.target.value)}>
            {open.map((order) => <option key={order.id} value={order.id}>{order.code} · {order.address}</option>)}
          </select>
        </label>
      ) : null}
      {approximate ? <small>Tiempo aproximado. La ruta sigue las calles cuando el servicio responde.</small> : here && path.length > 1 ? <small>Mejor ruta en auto. Mapa © OpenStreetMap</small> : null}
      {routeError ? <p className="error">{routeError}</p> : null}
    </section>
  );
}

function responseOk(data: { path?: Spot[]; error?: string }) {
  return Array.isArray(data.path);
}

function splitRoute(path: Spot[], shop: Spot | null, carrying: boolean) {
  if (carrying || !shop || path.length < 2) return { toShop: carrying ? [] : path, toClient: carrying ? path : [] };
  let nearest = 0;
  let nearestKm = Number.POSITIVE_INFINITY;
  path.forEach((point, index) => {
    const km = distanceKm(point.lat, point.lng, shop.lat, shop.lng);
    if (km < nearestKm) {
      nearest = index;
      nearestKm = km;
    }
  });
  return { toShop: path.slice(0, nearest + 1), toClient: path.slice(nearest) };
}
