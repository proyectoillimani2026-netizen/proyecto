import { randomInt, randomUUID } from "crypto";
import { quoteFee, argentinaPhone, unitPrice } from "./format";
import type { DB, DiningMode, Order, OrderEvent, OrderStatus, PaymentMethod, Role, Session } from "./types";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type CreateOrderInput = {
  customerName: string;
  phone: string;
  email?: string;
  mode: DiningMode;
  address?: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  items: { productId: string; quantity: number }[];
  distanceKm?: number;
  destinationLat?: number;
  destinationLng?: number;
  customerId?: string;
};

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function createOrder(db: DB, input: CreateOrderInput) {
  const name = clean(input.customerName || "", 80);
  const phone = argentinaPhone(clean(input.phone || "", 30));
  const email = clean(input.email || "", 80);
  const notes = clean(input.notes || "", 300);
  const mode = input.mode === "pickup" ? "pickup" : "delivery";
  const address = mode === "pickup" ? `${db.restaurant.address}, ${db.restaurant.city}` : clean(input.address || "", 240);

  if (name.length < 2) throw new HttpError(400, "Decinos tu nombre.");
  if (phone.length < 6) throw new HttpError(400, "Dejá un teléfono para el pedido.");
  if (mode === "delivery" && address.length < 5) throw new HttpError(400, "Falta la dirección de entrega.");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new HttpError(400, "El pedido está vacío.");
  if (input.items.length > 30) throw new HttpError(400, "Hay demasiados productos distintos.");

  const items = input.items.map((item) => {
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 30) {
      throw new HttpError(400, "La cantidad de un producto no es válida.");
    }
    const product = db.products.find((entry) => entry.id === item.productId);
    if (!product || !product.available || product.soldOut) throw new HttpError(400, "Un producto ya no está disponible.");
    const limited = product.stock > 0;
    if (limited && product.stock < quantity) {
      throw new HttpError(400, `No hay stock suficiente de ${product.name}. Quedan ${product.stock}.`);
    }
    if (limited) product.stock -= quantity;
    const price = unitPrice(product.price, product.discountPercent);
    return {
      productId: product.id,
      name: product.name,
      quantity,
      basePrice: product.price,
      discountPercent: product.discountPercent,
      unitPrice: price,
      limitedStock: limited,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.basePrice * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discountTotal = subtotal - totalItems;
  const distanceKm = mode === "delivery" ? Number(input.distanceKm) : 0;
  if (mode === "delivery" && (!Number.isFinite(distanceKm) || distanceKm < 0)) {
    throw new HttpError(400, "No pudimos calcular la distancia hasta tu dirección.");
  }
  const deliveryFee = quoteFee(distanceKm, db.restaurant.pricePerKm || 0, totalItems, db.restaurant.freeDeliveryFrom, mode);
  const paymentMethod = input.paymentMethod === "mercadopago" ? "mercadopago" : "cash";

  db.orderSeq += 1;
  const now = new Date().toISOString();
  const order: Order = {
    id: randomUUID(),
    code: `IE-${String(db.orderSeq).padStart(4, "0")}`,
    customerId: input.customerId,
    customerName: name,
    phone,
    email,
    mode,
    address,
    notes,
    items,
    subtotal,
    discountTotal,
    deliveryFee,
    distanceKm: mode === "delivery" ? distanceKm : 0,
    destinationLat: mode === "delivery" && Number.isFinite(input.destinationLat) ? input.destinationLat : undefined,
    destinationLng: mode === "delivery" && Number.isFinite(input.destinationLng) ? input.destinationLng : undefined,
    total: totalItems + deliveryFee,
    paymentMethod,
    paymentStatus: "pending",
    status: paymentMethod === "cash" ? "received" : "pending_payment",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  ensureDeliveryPin(order);
  db.orders.unshift(order);
  return order;
}

export function restoreStock(db: DB, order: Order) {
  if (order.status === "cancelled") return;
  for (const item of order.items) {
    const product = db.products.find((entry) => entry.id === item.productId);
    if (product && item.limitedStock !== false && product.stock > 0) product.stock += item.quantity;
  }
}

export function cancelOrder(db: DB, order: Order) {
  if (order.status === "cancelled") return order;
  if (order.status === "delivered") throw new HttpError(400, "Ese pedido ya se entregó.");
  restoreStock(db, order);
  order.status = "cancelled";
  order.updatedAt = new Date().toISOString();
  return order;
}

function personName(db: DB, userId: string | undefined, fallback: string) {
  if (!userId) return fallback;
  return db.users.find((user) => user.id === userId)?.name || fallback;
}

function logEvent(db: DB, order: Order, actor: { sub?: string; name: string; role: Role }, kind: string, text: string, at = new Date().toISOString()) {
  if (!order.events) {
    order.events = (order.messages || []).filter((message) => message.role !== "customer").map((message) => ({
      id: message.id,
      at: message.createdAt,
      kind: "message",
      text: message.text,
      userId: message.authorId,
      userName: personName(db, message.authorId, message.authorName),
      role: message.role,
    }));
  }
  const event: OrderEvent = {
    id: randomUUID(),
    at,
    kind,
    text,
    userId: actor.sub,
    userName: personName(db, actor.sub, actor.name),
    role: actor.role,
  };
  order.events.push(event);
}

const kitchenNext: Partial<Record<OrderStatus, OrderStatus>> = {
  received: "preparing",
  preparing: "ready",
};

function paid(order: Order) {
  return order.paymentStatus === "approved";
}

function kitchenOwnerId(order: Order) {
  if (order.kitchenId) return order.kitchenId;
  return order.events?.find((event) => event.kind === "preparing" && event.role !== "customer")?.userId;
}

function assertKitchenOwner(order: Order, session: Session) {
  if (session.role !== "kitchen") return;
  const owner = kitchenOwnerId(order);
  if (owner && owner !== session.sub) throw new HttpError(401, "Este pedido lo tomó otra persona de cocina.");
}

function inProgress(order: Order) {
  if (paid(order)) return true;
  return order.paymentMethod === "cash" && order.status !== "pending_payment" && order.status !== "cancelled";
}

export function deliveryPinDue(order: Order) {
  if (order.mode !== "delivery" || order.deliveryPin) return false;
  if (order.status === "cancelled" || order.status === "pending_payment") return false;
  if (order.paymentMethod === "mercadopago" && order.paymentStatus !== "approved") return false;
  return true;
}

export function ensureDeliveryPin(order: Order) {
  if (!deliveryPinDue(order)) return false;
  order.deliveryPin = String(randomInt(0, 10000)).padStart(4, "0");
  return true;
}

export function withoutDeliveryPin(order: Order) {
  if (!order.deliveryPin) return order;
  const copy = { ...order };
  delete copy.deliveryPin;
  return copy;
}

export function withoutCourierSpot(order: Order) {
  if (order.courierLat == null && order.courierLng == null && !order.courierAt) return order;
  const copy = { ...order };
  delete copy.courierLat;
  delete copy.courierLng;
  delete copy.courierAt;
  return copy;
}

export function saveCourierSpot(db: DB, session: Session, lat: number, lng: number) {
  if (session.role !== "delivery") throw new HttpError(401, "Solo delivery comparte su ubicación.");
  const now = new Date().toISOString();
  let updated = 0;
  for (const order of db.orders) {
    if (order.courierId !== session.sub || order.mode !== "delivery") continue;
    if (order.status === "delivered" || order.status === "cancelled" || order.status === "pending_payment") continue;
    order.courierLat = lat;
    order.courierLng = lng;
    order.courierAt = now;
    updated += 1;
  }
  return updated;
}

export function applyOrderAction(db: DB, orderId: string, action: string, session: Session, text = "", code = "") {
  const order = db.orders.find((entry) => entry.id === orderId);
  if (!order) throw new HttpError(404, "No encontramos ese pedido.");

  const now = new Date().toISOString();
  const staff = session.role === "admin" || session.role === "kitchen" || session.role === "delivery" || session.role === "waiter";

  if (action === "message") {
    if (!staff) throw new HttpError(401, "No autorizado.");
    if (session.role === "kitchen" && (order.status !== "preparing" || !order.courierId)) {
      throw new HttpError(400, "El mensaje se envía cuando el pedido se está preparando y un delivery ya lo tomó.");
    }
    assertKitchenOwner(order, session);
    const note = clean(text, 400);
    if (note.length < 1) throw new HttpError(400, "Escribí el mensaje.");
    logEvent(db, order, session, "message", note, now);
    order.messages = order.messages || [];
    order.messages.push({ id: randomUUID(), authorId: session.sub, authorName: personName(db, session.sub, session.name), role: session.role, text: note, createdAt: now });
    order.updatedAt = now;
    return order;
  }

  if (action === "confirm_payment") {
    if (session.role !== "waiter" && session.role !== "admin") throw new HttpError(401, "El mozo o administración confirman el pago.");
    if (order.paymentMethod !== "cash") throw new HttpError(400, "El pago con Mercado Pago se confirma solo cuando se acredita.");
    if (order.status === "cancelled" || order.status === "delivered") throw new HttpError(400, "Ese pedido ya está cerrado.");
    order.paymentStatus = "approved";
    if (order.status === "pending_payment") order.status = "received";
    ensureDeliveryPin(order);
    logEvent(db, order, session, "confirm_payment", "Confirmó el pago", now);
    order.updatedAt = now;
    return order;
  }

  if (order.paymentMethod === "mercadopago" && !paid(order) && action !== "cancel") {
    throw new HttpError(400, "Este pedido todavía no tiene el pago aprobado.");
  }
  if (!inProgress(order) && action !== "cancel" && action !== "confirm_payment") {
    throw new HttpError(400, "Este pedido se confirma cuando el pago está acreditado.");
  }

  if (action === "cancel") {
    if (session.role !== "admin") throw new HttpError(401, "Solo administración puede cancelar.");
    const wasCancelled = order.status === "cancelled";
    const cancelled = cancelOrder(db, order);
    if (!wasCancelled) logEvent(db, order, session, "cancel", "Canceló el pedido", order.updatedAt);
    return cancelled;
  }

  if (action === "preparing" || action === "ready") {
    if (session.role !== "admin" && session.role !== "kitchen") throw new HttpError(401, "No autorizado.");
    const expected = action === "preparing" ? "received" : "preparing";
    if (order.status !== expected) throw new HttpError(400, "Ese pedido no está en esa etapa.");
    if (action === "ready") assertKitchenOwner(order, session);
    order.status = kitchenNext[order.status] as OrderStatus;
    if (action === "preparing" || !order.kitchenId) {
      order.kitchenId = session.sub;
      order.kitchenName = personName(db, session.sub, session.name);
    }
    if (action === "preparing") order.acceptedAt = order.acceptedAt || now;
    if (action === "ready") order.readyAt = order.readyAt || now;
    logEvent(db, order, session, action, action === "preparing" ? "Aceptó el pedido y empezó a prepararlo" : "Lo dejó preparado y listo", now);
    order.updatedAt = now;
    return order;
  }

  if (action === "take") {
    if (session.role !== "delivery") throw new HttpError(401, "Solo delivery puede tomar un pedido.");
    if (order.mode !== "delivery") throw new HttpError(400, "Este pedido es para retirar en el local.");
    if (order.status !== "received" && order.status !== "preparing") {
      throw new HttpError(400, "Este pedido ya no se puede tomar.");
    }
    if (order.courierId && order.courierId !== session.sub && session.role !== "admin") {
      throw new HttpError(400, "Otro repartidor ya tomó este pedido.");
    }
    order.courierId = session.sub;
    order.courierName = personName(db, session.sub, session.name);
    order.takenAt = order.takenAt || now;
    logEvent(db, order, session, "take", "Tomó el pedido", now);
    order.updatedAt = now;
    return order;
  }

  if (action === "collect") {
    if (session.role !== "delivery" && session.role !== "admin") throw new HttpError(401, "No autorizado.");
    if (order.mode !== "delivery") throw new HttpError(400, "Este pedido es para retirar en el local.");
    if (order.status !== "ready") throw new HttpError(400, "Cocina todavía no lo marcó como preparado.");
    if (order.courierId && order.courierId !== session.sub && session.role !== "admin") {
      throw new HttpError(400, "Otro repartidor ya tomó este pedido.");
    }
    order.courierId = session.sub;
    order.courierName = personName(db, session.sub, session.name);
    order.status = "out_for_delivery";
    order.collectedAt = order.collectedAt || now;
    logEvent(db, order, session, "collect", "Recogió el pedido", now);
    order.updatedAt = now;
    return order;
  }

  if (action === "delivered") {
    const pickupDone = order.mode === "pickup" && order.status === "ready" && (session.role === "kitchen" || session.role === "waiter" || session.role === "admin");
    const deliveryDone =
      order.mode === "delivery" &&
      order.status === "out_for_delivery" &&
      (session.role === "admin" || (session.role === "delivery" && order.courierId === session.sub));
    if (!pickupDone && !deliveryDone) throw new HttpError(400, "Este pedido todavía no se puede cerrar.");
    if (order.mode === "delivery") {
      const entered = code.replace(/\D/g, "");
      if (!order.deliveryPin) throw new HttpError(400, "Este pedido todavía no tiene código. El cliente lo ve en su pedido cuando el pago está confirmado.");
      if (!/^\d{4}$/.test(entered) || entered !== order.deliveryPin) {
        throw new HttpError(400, "El código no coincide. Pedile los 4 números al cliente.");
      }
    }
    order.status = "delivered";
    if (order.paymentMethod === "cash") order.paymentStatus = "approved";
    order.deliveredAt = order.deliveredAt || now;
    delete order.courierLat;
    delete order.courierLng;
    delete order.courierAt;
    logEvent(db, order, session, "delivered", order.mode === "pickup" ? "Lo marcó retirado" : "Lo entregó con el código del cliente", now);
    order.updatedAt = now;
    return order;
  }

  throw new HttpError(400, "Acción desconocida.");
}

export function applyPaymentResult(order: Order, status: string | undefined, paymentId: string) {
  order.mpPaymentId = paymentId;
  if (status === "approved") {
    order.paymentStatus = "approved";
    if (order.status === "pending_payment") order.status = "received";
    ensureDeliveryPin(order);
  } else if (status === "rejected" || status === "cancelled") {
    order.paymentStatus = "rejected";
  } else {
    order.paymentStatus = "pending";
  }
  order.updatedAt = new Date().toISOString();
  return order;
}

export function ordersFor(db: DB, session: Session) {
  if (session.role === "admin" || session.role === "waiter") return db.orders;
  if (session.role === "kitchen") {
    return db.orders.filter((order) => {
      if (order.status === "pending_payment") return false;
      if (order.status === "received") return true;
      return kitchenOwnerId(order) === session.sub;
    });
  }
  if (session.role === "customer") {
    return db.orders.filter((order) => order.customerId === session.sub);
  }
  if (session.role !== "delivery") return [];
  return db.orders.filter((order) => {
    if (order.mode !== "delivery" || order.status === "pending_payment" || order.status === "cancelled") return false;
    if (!order.courierId) return inProgress(order) && ["received", "preparing", "ready"].includes(order.status);
    if (order.courierId !== session.sub) return false;
    return ["received", "preparing", "ready", "out_for_delivery", "delivered"].includes(order.status);
  });
}
