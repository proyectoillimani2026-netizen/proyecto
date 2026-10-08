import type { Order, OrderStatus, PaymentStatus, Role } from "./types";

export function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function unitPrice(price: number, discountPercent: number) {
  const discount = Math.min(100, Math.max(0, discountPercent));
  return Math.round(price * (1 - discount / 100));
}

export function orderMoment(order: Order, field: "acceptedAt" | "readyAt" | "takenAt" | "collectedAt" | "deliveredAt", kind: string) {
  return order[field] || order.events?.find((event) => event.kind === kind)?.at || "";
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function argentinaMobileDigits(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) {
    const rest = digits.slice(2).replace(/^0+/, "");
    return rest.startsWith("9") ? `54${rest}` : `549${rest}`;
  }
  digits = digits.replace(/^0+/, "");
  if (digits.startsWith("15")) digits = digits.slice(2);
  return digits ? `549${digits}` : "";
}

export function argentinaPhone(phone: string) {
  const digits = argentinaMobileDigits(phone);
  return digits ? `+${digits}` : phone;
}

export function whatsappHref(phone: string, text?: string) {
  const digits = argentinaMobileDigits(phone);
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const trialProductName = "Producto de prueba";

export const categoryOrder = [
  "Prueba",
  "Promos",
  "Empanadas",
  "Pizzas",
  "Platos",
  "Acompañamientos",
  "Bebidas",
  "Postres",
];

export function sortCategories(categories: string[]) {
  return [...categories].sort((a, b) => {
    const ia = categoryOrder.indexOf(a);
    const ib = categoryOrder.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "es");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export const statusLabel: Record<OrderStatus, string> = {
  pending_payment: "Esperando pago",
  received: "Nuevo",
  preparing: "En cocina",
  ready: "Listo",
  out_for_delivery: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: "Sin pago",
  pending: "Pago pendiente",
  approved: "Pagado",
  rejected: "Pago rechazado",
};

export const roleLabel: Record<Role, string> = {
  admin: "Administración",
  kitchen: "Cocina",
  delivery: "Delivery",
  waiter: "Mozo",
  customer: "Cliente",
};

export function deliveryFeeFor(subtotal: number, fee: number, freeFrom: number, mode: "delivery" | "pickup") {
  if (mode === "pickup") return 0;
  if (freeFrom > 0 && subtotal >= freeFrom) return 0;
  return fee;
}

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earth = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.asin(Math.min(1, Math.sqrt(arc)));
}

export function quoteFee(km: number, pricePerKm: number, subtotal: number, freeFrom: number, mode: "delivery" | "pickup") {
  return deliveryFeeFor(subtotal, Math.round(Math.max(0, km) * Math.max(0, pricePerKm)), freeFrom, mode);
}

export function formatKm(km: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(km)} km`;
}
