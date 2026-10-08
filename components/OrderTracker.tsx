"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerCourierMap } from "@/components/CustomerCourierMap";
import { money, paymentLabel, statusLabel } from "@/lib/format";
import type { DiningMode, Order, OrderStatus } from "@/lib/types";

function stepsFor(mode: DiningMode): OrderStatus[] {
  return mode === "delivery" ? ["received", "preparing", "ready", "out_for_delivery", "delivered"] : ["received", "preparing", "ready", "delivered"];
}

function stepName(status: OrderStatus, mode: DiningMode) {
  if (status === "ready" && mode === "pickup") return "Listo para retirar";
  if (status === "delivered" && mode === "pickup") return "Retirado";
  return statusLabel[status];
}

export function OrderTracker({ initial }: { initial: Order }) {
  const [order, setOrder] = useState(initial);

  useEffect(() => {
    if (order.status === "delivered" || order.status === "cancelled") return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
      const data = await response.json();
      if (data.order) {
        setOrder((current) => ({
          ...data.order,
          deliveryPin: data.order.deliveryPin || current.deliveryPin,
          courierLat: Number.isFinite(data.order.courierLat) ? data.order.courierLat : current.courierLat,
          courierLng: Number.isFinite(data.order.courierLng) ? data.order.courierLng : current.courierLng,
          courierAt: data.order.courierAt || current.courierAt,
        }));
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [order.id, order.status]);

  const steps = stepsFor(order.mode);
  const current = steps.indexOf(order.status);

  return (
    <main className="narrow">
      <article className="panel">
        <p><Link className="btn ghost" href="/">Volver a la tienda</Link></p>
        <p className="eyebrow">Pedido {order.code}</p>
        <h1>{order.status === "cancelled" ? "Pedido cancelado" : order.status === "pending_payment" ? "Falta el pago" : statusLabel[order.status]}</h1>
        <p className="muted">{order.customerName} · {order.mode === "delivery" ? order.address : "Retiro en el local"}</p>
        {order.status === "pending_payment" && order.mpInitPoint ? (
          <p className="banner">Mercado Pago todavía no confirmó el pago. <a href={order.mpInitPoint}><b>Pagar ahora</b></a></p>
        ) : null}
        {order.status !== "cancelled" && order.status !== "pending_payment" ? (
          <div className="timeline">
            {steps.map((step, index) => (
              <div key={step} className={index < current ? "step done" : index === current ? "step done current" : "step"}>
                <i />
                <span>{stepName(step, order.mode)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <CustomerCourierMap order={order} />
        <ul>
          {order.items.map((item) => (
            <li key={item.productId}>{item.quantity} × {item.name}</li>
          ))}
        </ul>
        {order.mode === "delivery" && order.deliveryPin ? (
          <div className="delivery-code">
            <p>Código para el repartidor</p>
            <strong>{order.deliveryPin}</strong>
            <p>Dáselo cuando te entregue el pedido. Sin estos 4 números no queda como entregado.</p>
          </div>
        ) : null}
        <div className="total-row grand"><span>Total</span><b>{money(order.total)}</b></div>
        <p className="muted">{order.paymentMethod === "cash" ? "Efectivo al recibir. El pedido ya está confirmado y se paga cuando llega." : `Mercado Pago · ${paymentLabel[order.paymentStatus]}`}</p>
        {order.notes ? <p>Nota: {order.notes}</p> : null}
        <p><Link className="btn ghost" href="/">Volver a la tienda</Link></p>
      </article>
    </main>
  );
}
