import { updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { fetchPayment } from "@/lib/mercadopago";
import { applyPaymentResult, HttpError } from "@/lib/orders";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { orderId?: string; paymentId?: string };
    const orderId = String(body.orderId || "");
    const paymentId = String(body.paymentId || "");
    if (!orderId || !paymentId) throw new HttpError(400, "Faltan datos del pago.");
    const payment = await fetchPayment(paymentId);
    if (payment.external_reference !== orderId) throw new HttpError(400, "El pago no corresponde a este pedido.");
    const order = await updateDb((db) => {
      const current = db.orders.find((entry) => entry.id === orderId);
      if (!current) throw new HttpError(404, "No encontramos ese pedido.");
      return applyPaymentResult(current, payment.status, paymentId);
    });
    return Response.json({ order });
  } catch (error) {
    return jsonError(error);
  }
}
