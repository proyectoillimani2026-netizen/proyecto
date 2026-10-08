import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/OrderTracker";
import { getSession } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/db";
import { deliveryPinDue, ensureDeliveryPin, withoutCourierSpot, withoutDeliveryPin } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  const found = db.orders.find((entry) => entry.id === id);
  if (!found) notFound();
  const session = await getSession();
  const owns = session?.role === "customer" && session.sub === found.customerId;
  const stored = owns && deliveryPinDue(found)
    ? await updateDb((current) => {
        const order = current.orders.find((entry) => entry.id === id);
        if (!order) return found;
        ensureDeliveryPin(order);
        return order;
      })
    : found;
  const order = owns ? stored : withoutCourierSpot(withoutDeliveryPin(stored));
  return <OrderTracker initial={order} />;
}
