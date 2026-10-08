"use client";

import { useCallback, useEffect, useState } from "react";
import { formatWhen, orderMoment, roleLabel, statusLabel } from "@/lib/format";
import type { Order, OrderEvent, OrderStatus, Role } from "@/lib/types";

type Trail = { id: string; userName: string; role: Role; at: string; text: string };

const accepted: OrderStatus[] = ["preparing", "ready", "out_for_delivery", "delivered"];
const prepared: OrderStatus[] = ["ready", "out_for_delivery", "delivered"];

function named(event: OrderEvent): Trail {
  return { id: event.id, userName: event.userName, role: event.role, at: event.at, text: event.text };
}

function plain(id: string, text: string, role: Role, userName = "", at = ""): Trail {
  return { id, userName, role, at, text };
}

function kitchenTrail(order: Order): Trail[] {
  const events = order.events || [];
  const took = events.find((event) => event.kind === "preparing");
  const done = events.find((event) => event.kind === "ready");
  const rows: Trail[] = [];
  if (took) rows.push(named(took));
  else if (order.acceptedAt || accepted.includes(order.status)) rows.push(plain(`${order.id}-accept`, "Aceptó el pedido", "kitchen", order.kitchenName || "", orderMoment(order, "acceptedAt", "preparing")));
  if (done) rows.push(named(done));
  else if (order.readyAt || prepared.includes(order.status)) rows.push(plain(`${order.id}-ready`, "Lo dejó preparado y listo", "kitchen", order.kitchenName || "", orderMoment(order, "readyAt", "ready")));
  return rows;
}

function deliveryTrail(order: Order): Trail[] {
  const events = order.events || [];
  const took = events.find((event) => event.kind === "take");
  const collected = events.find((event) => event.kind === "collect");
  const finished = events.find((event) => event.kind === "delivered");
  const rows: Trail[] = [];
  if (order.mode === "pickup") {
    if (finished) rows.push(named(finished));
    else if (order.status === "delivered") rows.push(plain(`${order.id}-done`, "Lo marcó retirado", "kitchen"));
    return rows;
  }
  if (took) rows.push(named(took));
  else if (order.courierName || order.takenAt) rows.push(plain(`${order.id}-take`, "Tomó el pedido", "delivery", order.courierName || "", orderMoment(order, "takenAt", "take")));
  if (collected) rows.push(named(collected));
  else if (order.collectedAt || (order.courierName && order.status === "out_for_delivery")) rows.push(plain(`${order.id}-collect`, "Recogió el pedido", "delivery", order.courierName || "", orderMoment(order, "collectedAt", "collect")));
  if (finished) rows.push(named(finished));
  else if (order.status === "delivered" || order.deliveredAt) rows.push(plain(`${order.id}-done`, "Lo entregó", "delivery", order.courierName || "", orderMoment(order, "deliveredAt", "delivered")));
  return rows;
}

function chatTrail(order: Order): Trail[] {
  return (order.messages || [])
    .filter((message) => message.role !== "customer")
    .map((message) => ({
      id: message.id,
      userName: message.authorName,
      role: message.role,
      at: message.createdAt,
      text: message.text,
    }));
}

function TrailList({ rows, empty }: { rows: Trail[]; empty: string }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <ol>
      {rows.map((row) => (
        <li key={row.id}>
          {row.userName ? (
            <>
              <b>{row.userName}</b> · {roleLabel[row.role]}
              {row.at ? ` · ${formatWhen(row.at)}` : ""}
              <br />
            </>
          ) : null}
          {row.text}
        </li>
      ))}
    </ol>
  );
}

function HistoryCard({ order }: { order: Order }) {
  const kitchen = kitchenTrail(order);
  const delivery = deliveryTrail(order);
  const chat = chatTrail(order);
  return (
    <article className="ticket">
      <header>
        <strong>{order.code}</strong>
        <span className={`pill ${order.status}`}>{statusLabel[order.status]}</span>
      </header>
      <p className="trail-label">Cocina</p>
      <TrailList rows={kitchen} empty="Nadie de cocina lo tomó." />
      <p className="trail-label">Delivery</p>
      <TrailList rows={delivery} empty={order.mode === "pickup" ? "Es para retirar en el local." : "Nadie de delivery lo tomó."} />
      <p className="trail-label">Chat</p>
      <TrailList rows={chat} empty="Sin mensajes." />
    </article>
  );
}

function byRecent(orders: Order[]) {
  return [...orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function mendozaDay(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Mendoza", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function orderDays(order: Order) {
  const stamps = [
    order.createdAt,
    order.updatedAt,
    order.acceptedAt,
    order.readyAt,
    order.takenAt,
    order.collectedAt,
    order.deliveredAt,
    ...(order.events || []).map((event) => event.at),
    ...(order.messages || []).map((message) => message.createdAt),
  ];
  return stamps.map((stamp) => mendozaDay(stamp)).filter(Boolean);
}

function inRange(order: Order, from: string, to: string) {
  if (!from && !to) return true;
  return orderDays(order).some((day) => (!from || day >= from) && (!to || day <= to));
}

export function StaffHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const today = mendozaDay(new Date().toISOString());
  const rangeFrom = todayOnly ? today : from;
  const rangeTo = todayOnly ? today : to;

  const load = useCallback(async () => {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) setError(data.error || "No se pudo cargar el historial.");
    else setOrders(data.orders || []);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  const visible = orders.filter((order) => inRange(order, rangeFrom, rangeTo));
  const lanes = [
    { key: "accepted", title: "Aceptados", hint: "Cocina ya los tomó.", className: "cooking", orders: byRecent(visible.filter((order) => order.status === "preparing")) },
    { key: "prepared", title: "Preparados", hint: "Quedaron listos.", className: "ready", orders: byRecent(visible.filter((order) => order.status === "ready" || order.status === "out_for_delivery")) },
    { key: "delivered", title: "Entregados", hint: "Ya se entregaron.", className: "done", orders: byRecent(visible.filter((order) => order.status === "delivered")) },
  ];

  return (
    <section className="activity">
      <h2>Historial</h2>
      <p className="muted">Pedidos aceptados, preparados y entregados, quién los tomó en cocina y en delivery, y el chat.</p>
      <div className="history-filters">
        <button className={todayOnly ? "active" : ""} type="button" onClick={() => setTodayOnly((value) => !value)}>Hoy</button>
        <label>Desde<input type="date" value={todayOnly ? today : from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setTodayOnly(false); }} /></label>
        <label>Hasta<input type="date" value={todayOnly ? today : to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setTodayOnly(false); }} /></label>
        {from || to || todayOnly ? <button className="text-btn" type="button" onClick={() => { setFrom(""); setTo(""); setTodayOnly(false); }}>Ver todo</button> : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="history-lanes">
        {lanes.map((lane) => (
          <section key={lane.key} className={`lane ${lane.className}`}>
            <h2>{lane.title}</h2>
            <p className="muted">{lane.hint}</p>
            {lane.orders.length === 0 ? <p className="panel">Ninguno.</p> : null}
            {lane.orders.map((order) => <HistoryCard key={order.id} order={order} />)}
          </section>
        ))}
      </div>
    </section>
  );
}
