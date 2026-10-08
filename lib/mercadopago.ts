import type { Order } from "./types";

type Preference = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

function appOrigin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

async function postPreference(token: string, body: unknown) {
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Preference & { message?: string; cause?: { description?: string }[] };
  if (!response.ok) {
    const detail = data.cause?.[0]?.description || data.message || "Mercado Pago rechazó la preferencia.";
    throw new Error(detail);
  }
  return data;
}

export async function createCheckout(order: Order, request: Request) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Falta MP_ACCESS_TOKEN. Cargalo en .env.local para cobrar con Mercado Pago.");
  }

  const origin = appOrigin(request);
  const items = [
    ...order.items.map((item) => ({
      title: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      currency_id: "ARS",
    })),
    ...(order.deliveryFee > 0
      ? [{ title: "Envío", quantity: 1, unit_price: order.deliveryFee, currency_id: "ARS" }]
      : []),
  ];

  const base = {
    items,
    payer: {
      name: order.customerName,
      email: order.email || undefined,
      phone: { number: order.phone },
    },
    external_reference: order.id,
    statement_descriptor: "ILLIMANI",
    ...(origin.startsWith("https://") ? { notification_url: `${origin}/api/payments/webhook` } : {}),
    back_urls: {
      success: `${origin}/pago/exito?order=${order.id}`,
      failure: `${origin}/pago/error?order=${order.id}`,
      pending: `${origin}/pago/pendiente?order=${order.id}`,
    },
  };

  let preference: Preference;
  try {
    preference = await postPreference(token, { ...base, auto_return: "approved" });
  } catch {
    preference = await postPreference(token, base);
  }

  const checkoutUrl = token.startsWith("TEST-")
    ? preference.sandbox_init_point || preference.init_point
    : preference.init_point || preference.sandbox_init_point;

  if (!checkoutUrl) throw new Error("Mercado Pago no devolvió un link de pago.");
  return { preferenceId: preference.id, checkoutUrl };
}

export async function fetchPayment(paymentId: string) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MP_ACCESS_TOKEN.");
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json()) as {
    id?: number;
    status?: string;
    external_reference?: string;
    message?: string;
  };
  if (!response.ok) throw new Error(data.message || "No pudimos verificar el pago.");
  return data;
}
