"use client";

import { useCallback, useEffect, useState } from "react";
import { DeliveryRoute } from "./DeliveryRoute";
import { OrderCard, actionsFor, sendOrderAction } from "./OrderCard";
import type { Order, Role } from "@/lib/types";

const talkPlaceholder: Partial<Record<Role, string>> = {
  kitchen: "Mensaje para delivery",
  delivery: "Mensaje para cocina",
  waiter: "Mensaje para cocina",
  admin: "Mensaje para el equipo",
};

type HistoryTab = { id: string; label: string; match: (order: Order) => boolean };

const kitchenHistory: HistoryTab[] = [
  {
    id: "orders",
    label: "Pedidos",
    match: (order) => order.status === "out_for_delivery" || order.status === "delivered",
  },
  { id: "cancelled", label: "Cancelados", match: (order) => order.status === "cancelled" },
];

const deliveryHistory: HistoryTab[] = [
  { id: "taken", label: "Tomados", match: (order) => Boolean(order.courierId) && order.status !== "delivered" && order.status !== "cancelled" },
  { id: "delivered", label: "Entregados", match: (order) => order.status === "delivered" },
];

function historyTabs(role: Role) {
  if (role === "kitchen") return kitchenHistory;
  if (role === "delivery") return deliveryHistory;
  return null;
}

function kitchenCanTalk(order: Order) {
  return order.status === "preparing" && Boolean(order.courierId);
}

function isActive(order: Order, role: Role) {
  if (role === "kitchen") return order.status === "received" || order.status === "preparing" || order.status === "ready";
  if (role === "delivery") return !order.courierId && (order.status === "received" || order.status === "preparing" || order.status === "ready");
  return true;
}

export function OrderBoard({ role, title, intro }: { role: Role; title: string; intro: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState<{ orderId: string; message: string } | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [userId, setUserId] = useState("");
  const [userRole, setUserRole] = useState<Role | "">("");
  const tabs = historyTabs(role);
  const [history, setHistory] = useState(tabs?.[0]?.id || "");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) setError(data.error || "No se pudieron cargar los pedidos.");
      else {
        setOrders(data.orders || []);
        setError("");
      }
    } catch {
      setError("No hay conexión con el servidor. Recargá la página.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setUserId(data.user?.id || "");
        setUserRole(data.user?.role || "");
      })
      .catch(() => undefined);
  }, []);

  function tookIt(order: Order) {
    if (role === "kitchen" && userRole === "kitchen") {
      if (order.status === "received") return true;
      if (!userId) return false;
      return order.kitchenId === userId || Boolean(order.events?.some((event) => event.kind === "preparing" && event.userId === userId));
    }
    if (role === "delivery" && userRole === "delivery") {
      if (!order.courierId) return order.status === "received" || order.status === "preparing" || order.status === "ready";
      if (!userId) return false;
      return order.courierId === userId;
    }
    return true;
  }

  const newest = (a: Order, b: Order) => b.createdAt.localeCompare(a.createdAt);
  const oldest = (a: Order, b: Order) => a.createdAt.localeCompare(b.createdAt);
  const mine = orders.filter(tookIt);
  const active = mine
    .filter((order) => isActive(order, role))
    .filter((order) => role === "kitchen" || role === "delivery" || showClosed || (order.status !== "delivered" && order.status !== "cancelled"))
    .sort(role === "admin" || role === "waiter" ? newest : oldest);
  const tab = tabs?.find((entry) => entry.id === history) || tabs?.[0];
  const archived = tab ? mine.filter(tab.match).sort(newest) : [];
  const incoming = active.filter((order) => order.status === "received");
  const cooking = active.filter((order) => order.status === "preparing");
  const ready = active.filter((order) => order.status === "ready");

  function cards(list: Order[], keyPrefix = "") {
    return list.map((order) => (
      <OrderCard
        key={`${keyPrefix}${order.id}-${order.updatedAt}`}
        order={order}
        actions={actionsFor(order, role)}
        role={role}
        canTalk={role === "waiter" || role === "delivery" || role === "admin" || (role === "kitchen" && kitchenCanTalk(order))}
        talkPlaceholder={talkPlaceholder[role]}
        notice={actionError?.orderId === order.id ? actionError.message : ""}
        onAction={(action, text) => act(order, action, text)}
      />
    ));
  }

  async function act(order: Order, action: string, text?: string) {
    if (action === "cancel" && !window.confirm("¿Cancelar este pedido y devolver el stock?")) return;
    setActionError(null);
    try {
      await sendOrderAction(order.id, action, text);
      setError("");
      await load();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "No se pudo actualizar.";
      if (action === "delivered") setActionError({ orderId: order.id, message });
      else setError(message);
    }
  }

  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">{intro}</p>
      {error ? <p className="error">{error}</p> : null}
      {role === "delivery" ? <DeliveryRoute orders={mine} userId={userId} /> : null}
      {role === "admin" || role === "waiter" ? (
        <p><button className="text-btn" type="button" onClick={() => setShowClosed((value) => !value)}>{showClosed ? "Ocultar cerrados" : "Ver entregados y cancelados"}</button></p>
      ) : null}
      {role === "kitchen" ? (
        <div className="kitchen-lanes">
          <section className="lane new">
            <h2>Nuevos</h2>
            <p className="muted">Para aceptar y preparar.</p>
            {incoming.length === 0 ? <p className="panel">No hay pedidos nuevos.</p> : <div className="board">{cards(incoming)}</div>}
          </section>
          <section className="lane cooking">
            <h2>Preparando</h2>
            <p className="muted">Ya están en cocina.</p>
            {cooking.length === 0 ? <p className="panel">Nada en preparación.</p> : <div className="board">{cards(cooking)}</div>}
          </section>
          <section className="lane ready">
            <h2>Listos</h2>
            <p className="muted">Esperando que delivery los recoja.</p>
            {ready.length === 0 ? <p className="panel">No hay pedidos listos.</p> : <div className="board">{cards(ready)}</div>}
          </section>
        </div>
      ) : (
        <>
          {active.length === 0 ? <p className="panel">No hay pedidos en esta bandeja.</p> : null}
          <div className="board">{cards(active)}</div>
        </>
      )}
      {tabs && tab ? (
        <div className="history">
          <h2>Historial</h2>
          <p className="muted">{role === "kitchen" ? "Solo los pedidos que tomaste. Pasan acá cuando delivery los recoge. Si se cancelan, quedan solo en Cancelados." : "Solo los pedidos que tomaste, y los que ya entregaste."}</p>
          <div className="tabs">
            {tabs.map((entry) => (
              <button key={entry.id} className={entry.id === tab.id ? "active" : ""} type="button" onClick={() => setHistory(entry.id)}>
                {entry.label} ({mine.filter(entry.match).length})
              </button>
            ))}
          </div>
          {archived.length === 0 ? <p className="panel">No hay pedidos en este historial.</p> : null}
          <div className="board">
            {archived.map((order) => (
              <OrderCard
                key={`${tab.id}-${order.id}-${order.updatedAt}`}
                order={order}
                actions={actionsFor(order, role)}
                role={role}
                canTalk={role === "delivery" || (role === "kitchen" && kitchenCanTalk(order))}
                talkPlaceholder={talkPlaceholder[role]}
                notice={actionError?.orderId === order.id ? actionError.message : ""}
                onAction={(action, text) => act(order, action, text)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
