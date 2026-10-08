import { updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { fetchPayment } from "@/lib/mercadopago";
import { applyPaymentResult } from "@/lib/orders";

async function paymentIdFrom(request: Request) {
  const url = new URL(request.url);
  let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  const text = await request.text();
  if (!text) return paymentId;
  try {
    const body = JSON.parse(text) as { data?: { id?: string | number } };
    if (body.data?.id) paymentId = String(body.data.id);
  } catch {
    return paymentId;
  }
  return paymentId;
}

export async function POST(request: Request) {
  try {
    const paymentId = await paymentIdFrom(request);
    if (!paymentId) return Response.json({ ok: true });
    const payment = await fetchPayment(paymentId);
    if (!payment.external_reference) return Response.json({ ok: true });
    await updateDb((db) => {
      const order = db.orders.find((entry) => entry.id === payment.external_reference);
      if (order) applyPaymentResult(order, payment.status, paymentId);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
