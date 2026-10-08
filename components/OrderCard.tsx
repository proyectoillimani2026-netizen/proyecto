"use client";

import { formatWhen, money, orderMoment, paymentLabel, roleLabel, statusLabel, argentinaPhone, whatsappHref } from "@/lib/format";
import type { Order, Role } from "@/lib/types";

export type OrderAction = { action: string; label: string; tone?: "danger" };

export function actionsFor(order: Order, role: Role): OrderAction[] {
  const actions: OrderAction[] = [];
  const confirmed = order.paymentStatus === "approved" || (order.paymentMethod === "cash" && order.status !== "pending_payment" && order.status !== "cancelled");
  const floor = role === "kitchen" || role === "admin" || role === "waiter";
  if ((role === "waiter" || role === "admin") && order.paymentMethod === "cash" && !confirmed && order.status !== "cancelled" && order.status !== "delivered") {
    actions.push({ action: "confirm_payment", label: "Confirmar pago" });
  }
  if ((role === "kitchen" || role === "admin") && confirmed && order.status === "received") actions.push({ action: "preparing", label: "Aceptar y preparar" });
  if ((role === "kitchen" || role === "admin") && confirmed && order.status === "preparing") actions.push({ action: "ready", label: "Marcar listo" });
  if (floor && confirmed && order.mode === "pickup" && order.status === "ready") actions.push({ action: "delivered", label: "Marcar retirado" });
  if (role === "delivery" && confirmed && order.mode === "delivery" && !order.courierId && (order.status === "received" || order.status === "preparing")) {
    actions.push({ action: "take", label: "Tomar pedido" });
  }
  if ((role === "delivery" || role === "admin") && confirmed && order.mode === "delivery" && order.status === "ready") {
    actions.push({ action: "collect", label: "Recoger" });
  }
  if ((role === "admin" || role === "delivery") && order.status === "out_for_delivery") {
    actions.push({ action: "delivered", label: "Marcar entregado" });
  }
  if (role === "admin" && order.status !== "delivered" && order.status !== "cancelled") {
    actions.push({ action: "cancel", label: "Cancelar", tone: "danger" });
  }
  return actions;
}

export function OrderCard({
  order,
  actions,
  canTalk,
  role,
  talkPlaceholder = "Mensaje para cocina y delivery",
  notice = "",
  onAction,
}: {
  order: Order;
  actions: OrderAction[];
  canTalk?: boolean;
  role?: Role;
  talkPlaceholder?: string;
  notice?: string;
  onAction: (action: string, text?: string) => void;
}) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  const items = order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ");
  const place = order.mode === "pickup" ? `para retirar en ${order.address}` : `en ${order.address}`;
  const whatsapp = whatsappHref(order.phone, `Hola, tu pedido es ${items} ${place}.`);
  const messages = order.messages || [];
  const kitchen = role === "kitchen";
  const delivery = role === "delivery";
  const times = [
    ...(kitchen || !delivery ? [
      ["Aceptado", orderMoment(order, "acceptedAt", "preparing")],
      ["Preparado y listo", orderMoment(order, "readyAt", "ready")],
    ] : []),
    ...(delivery || !kitchen ? [
      ["Tomado", orderMoment(order, "takenAt", "take")],
      ["Recogido", orderMoment(order, "collectedAt", "collect")],
      ["Entregado", orderMoment(order, "deliveredAt", "delivered")],
    ] : []),
  ].filter((entry) => entry[1]);
  const pickedUp = order.mode === "delivery" && order.status !== "delivered" && order.status !== "cancelled" && (order.status === "out_for_delivery" || Boolean(order.collectedAt));
  const waiterPill = role === "waiter" && pickedUp
    ? { tone: "out_for_delivery", label: "En camino" }
    : role === "waiter" && order.status === "ready"
      ? { tone: "ready", label: "Listo" }
      : { tone: order.status, label: statusLabel[order.status] };
  return (
    <article className="ticket">
      <header>
        <strong>{order.code}</strong>
        <span className={`pill ${waiterPill.tone}`}>{waiterPill.label}</span>
      </header>
      <div>
        <b>{order.customerName}</b>
        <p>{formatWhen(order.createdAt)} · {order.mode === "delivery" ? "Delivery" : "Retiro"}{kitchen ? "" : ` · ${order.paymentMethod === "cash" ? "Efectivo" : "Mercado Pago"} · ${paymentLabel[order.paymentStatus]}`}</p>
      </div>
      <p><a href={whatsapp} target="_blank" rel="noreferrer">{argentinaPhone(order.phone)}</a></p>
      {order.mode === "delivery" ? <p><a href={maps} target="_blank" rel="noreferrer">{order.address}</a></p> : <p>{order.address}</p>}
      <ul>
        {order.items.map((item) => <li key={`${item.productId}-${item.name}`}>{item.quantity} × {item.name}</li>)}
      </ul>
      {order.notes ? <p>Nota: {order.notes}</p> : null}
      {order.courierName ? <p>Repartidor: {order.courierName}</p> : null}
      {times.length > 0 ? (
        <ul className="times">
          {times.map(([label, at]) => <li key={label}><b>{label}</b> · {formatWhen(at)}</li>)}
        </ul>
      ) : null}
      {!kitchen && order.distanceKm ? <p>{order.distanceKm.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km desde el local</p> : null}
      {kitchen ? null : <div className="cart-line"><span>Total</span><b>{money(order.total)}</b></div>}
      {messages.length > 0 ? (
        <div className="thread">
          {messages.map((message) => (
            <p key={message.id}><b>{message.authorName}</b> · {roleLabel[message.role]}<br />{message.text}</p>
          ))}
        </div>
      ) : null}
      {canTalk ? (
        <form className="talk" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const text = String(new FormData(form).get("text") || "");
          form.reset();
          onAction("message", text);
        }}>
          <input name="text" placeholder={talkPlaceholder} aria-label={talkPlaceholder} required maxLength={400} />
          <button className="btn" type="submit">Enviar</button>
        </form>
      ) : null}
      {actions.length > 0 ? (
        <div className="actions">
          {actions.map((action) => (
            action.action === "delivered" && order.mode === "delivery" ? (
              <form key="delivered" className="talk deliver-code" onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const code = String(new FormData(form).get("code") || "");
                onAction("delivered", code);
              }}>
                <input name="code" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" placeholder="Código de 4 números" aria-label="Código de 4 números" aria-invalid={Boolean(notice)} required />
                <button className="btn" type="submit">Entregar</button>
                {notice ? <p className="error">{notice}</p> : null}
              </form>
            ) : (
              <button key={action.action} className={action.tone === "danger" ? "btn danger" : "btn"} type="button" onClick={() => onAction(action.action)}>
                {action.label}
              </button>
            )
          ))}
        </div>
      ) : null}
    </article>
  );
}

export async function sendOrderAction(id: string, action: string, text?: string) {
  const response = await fetch(`/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action === "delivered" ? { action, code: text || "" } : { action, text }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "No se pudo actualizar el pedido.");
}
