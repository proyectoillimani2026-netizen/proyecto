"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function PaymentReturn({ result, orderId, paymentId }: { result: string; orderId: string; paymentId: string }) {
  const [message, setMessage] = useState("Estamos confirmando el pago...");
  const [href, setHref] = useState(orderId ? `/pedido/${orderId}` : "/");

  useEffect(() => {
    if (!orderId) {
      setMessage("Volviste de Mercado Pago, pero no encontramos el pedido.");
      return;
    }
    if (!paymentId) {
      setMessage(result === "pendiente" ? "El pago quedó pendiente." : result === "error" ? "El pago no se completó. Podés intentarlo de nuevo desde el pedido." : "Todavía no llegó la confirmación del pago.");
      return;
    }
    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, paymentId }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data.order) {
          setMessage(data.error || "No pudimos confirmar el pago.");
          return;
        }
        if (data.order.paymentStatus === "approved") {
          const pin = data.order.mode === "delivery" ? data.order.deliveryPin : "";
          setMessage(pin
            ? `Pago aprobado. El pedido ${data.order.code} ya está en cocina. Tu código para el repartidor es ${pin}.`
            : `Pago aprobado. El pedido ${data.order.code} ya está en cocina.`);
        }
        else if (data.order.paymentStatus === "rejected") setMessage("El pago fue rechazado. Podés intentar otra vez desde el pedido.");
        else setMessage("El pago sigue pendiente. La cocina lo va a ver cuando se acredite.");
      })
      .catch(() => setMessage("No pudimos confirmar el pago."));
  }, [orderId, paymentId, result]);

  return (
    <main className="narrow">
      <article className="panel">
        <p className="eyebrow">Mercado Pago</p>
        <h1>{result === "exito" ? "Volviste del pago" : result === "pendiente" ? "Pago pendiente" : "Pago no completado"}</h1>
        <p>{message}</p>
        <Link className="btn" href={href}>Ver el pedido</Link>
      </article>
    </main>
  );
}
