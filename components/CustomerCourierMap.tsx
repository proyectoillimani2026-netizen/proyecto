"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/lib/types";
import { MiniMap } from "./MiniMap";

type Spot = { lat: number; lng: number };

function finiteSpot(lat?: number, lng?: number): Spot | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat as number, lng: lng as number };
}

function stage(order: Order) {
  if (order.status === "out_for_delivery") return "Va en camino a tu dirección.";
  if (order.status === "ready") return "El pedido está listo. Lo retira en el local.";
  return "Lo tiene tomado mientras cocina lo prepara.";
}

export function CustomerCourierMap({ order }: { order: Order }) {
  const [shop, setShop] = useState<Spot | null>(null);
  const [road, setRoad] = useState<Spot[]>([]);

  useEffect(() => {
    let gone = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const place = data.restaurant;
        if (gone || !place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return;
        setShop({ lat: place.latitude, lng: place.longitude });
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, []);

  const visible = order.mode === "delivery"
    && Boolean(order.courierName)
    && order.status !== "delivered"
    && order.status !== "cancelled"
    && order.status !== "pending_payment";
  const courier = visible ? finiteSpot(order.courierLat, order.courierLng) : null;
  const destination = visible ? finiteSpot(order.destinationLat, order.destinationLng) : null;
  const carrying = order.status === "out_for_delivery";
  const target = carrying ? destination : shop;
  const routeKey = visible && courier && target
    ? `${courier.lat.toFixed(3)},${courier.lng.toFixed(3)};${target.lat.toFixed(3)},${target.lng.toFixed(3)}`
    : "";

  useEffect(() => {
    if (!routeKey) {
      setRoad([]);
      return;
    }
    let gone = false;
    fetch(`/api/route?points=${encodeURIComponent(routeKey)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (gone || !Array.isArray(data.path)) return;
        setRoad(data.path.length > 2 ? data.path : []);
      })
      .catch(() => {
        if (!gone) setRoad([]);
      });
    return () => {
      gone = true;
    };
  }, [routeKey]);

  if (!visible) return null;

  const points = [
    ...(courier ? [{ ...courier, color: "#1d4e89" }] : []),
    ...(shop ? [{ ...shop, color: "#9b2335" }] : []),
    ...(destination ? [{ ...destination, color: "#1c7a49" }] : []),
  ];
  const path = !carrying ? road : [];
  const dropPath = carrying ? road : [];

  return (
    <div className="customer-map">
      <p><b>{order.courierName}</b> tomó tu pedido. {stage(order)}</p>
      {points.length > 0 ? (
        <MiniMap points={points} path={path} dropPath={dropPath} ratio={0.62} maxHeight={280} minHeight={200} />
      ) : (
        <p className="muted">Todavía no llega su ubicación. Cuando tenga el GPS activo, lo vas a ver en el mapa.</p>
      )}
      {!courier && shop && destination ? <p className="muted">El local y tu dirección ya están. El pin del repartidor entra cuando comparte el GPS.</p> : null}
      {points.length > 0 ? (
        <p className="map-key">
          {courier ? <span><i style={{ background: "#1d4e89" }} /> {order.courierName}</span> : null}
          {shop ? <span><i style={{ background: "#9b2335" }} /> Local</span> : null}
          {destination ? <span><i style={{ background: "#1c7a49" }} /> Tu dirección</span> : null}
        </p>
      ) : null}
    </div>
  );
}
