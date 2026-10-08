"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerCourierMap } from "@/components/CustomerCourierMap";
import { formatWhen, money, statusLabel } from "@/lib/format";
import type { Order } from "@/lib/types";
import { Logo } from "@/components/Logo";

function isCurrent(order: Order) {
  return order.status !== "delivered" && order.status !== "cancelled";
}

export default function AccountPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let gone = false;
    const load = () => {
      fetch("/api/orders", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Iniciá sesión para ver tus pedidos.");
          if (!gone) {
            const sorted = [...(data.orders || [])].sort((a: Order, b: Order) => b.createdAt.localeCompare(a.createdAt));
            setOrders((current) => sorted.map((order) => {
              const previous = current?.find((entry) => entry.id === order.id);
              return {
                ...order,
                deliveryPin: order.deliveryPin || previous?.deliveryPin,
                courierLat: Number.isFinite(order.courierLat) ? order.courierLat : previous?.courierLat,
                courierLng: Number.isFinite(order.courierLng) ? order.courierLng : previous?.courierLng,
                courierAt: order.courierAt || previous?.courierAt,
              };
            }));
            setError("");
          }
        })
        .catch((reason) => {
          if (!gone) setError(reason instanceof Error ? reason.message : "No se pudieron cargar los pedidos.");
        });
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      gone = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <header className="topbar">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="narrow">
        <h1>Mis pedidos</h1>
        {error ? <p className="error">{error} <Link href="/">Volver a la tienda</Link></p> : null}
        {orders && orders.length === 0 ? <p className="panel">Todavía no hiciste pedidos.</p> : null}
        {(orders || []).some(isCurrent) ? (
          <section className="current-orders">
            <h2>Pedido actual</h2>
            {(orders || []).filter(isCurrent).map((order) => (
              <article key={order.id} className="panel ticket">
                <header>
                  <strong>{order.code}</strong>
                  <span className={`pill ${order.status}`}>{statusLabel[order.status]}</span>
                </header>
                <p>{formatWhen(order.createdAt)} · {order.mode === "delivery" ? order.address : "Retiro en el local"}</p>
                {order.mode === "delivery" && !order.courierName ? <p>Cuando un delivery lo tome, vas a ver quién es y dónde está.</p> : null}
                <CustomerCourierMap order={order} />
                {order.deliveryPin ? <p className="delivery-code compact"><span>Código para el repartidor</span><strong>{order.deliveryPin}</strong></p> : null}
                <b>{money(order.total)}</b>
                <Link href={`/pedido/${order.id}`}>Ver el pedido</Link>
              </article>
            ))}
          </section>
        ) : null}
        <div className="stack">
          {(orders || []).filter((order) => !isCurrent(order)).map((order) => (
            <Link key={order.id} className="panel ticket" href={`/pedido/${order.id}`}>
              <header>
                <strong>{order.code}</strong>
                <span className={`pill ${order.status}`}>{statusLabel[order.status]}</span>
              </header>
              <p>{formatWhen(order.createdAt)} · {order.mode === "delivery" ? order.address : "Retiro en el local"}</p>
              {order.deliveryPin ? <p className="delivery-code compact"><span>Código para el repartidor</span><strong>{order.deliveryPin}</strong></p> : null}
              <b>{money(order.total)}</b>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
