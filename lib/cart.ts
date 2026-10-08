export const CART_KEY = "illimani-cart-v1";
export const MODE_KEY = "illimani-mode";
export const LAST_ORDER_KEY = "illimani-last-order";
export const DESTINATION_KEY = "illimani-destination";

export type CartMap = Record<string, number>;
export type Destination = { query: string; label: string; lat: number; lng: number };

export function readCart(): CartMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "{}") as CartMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export function writeCart(cart: CartMap) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function readDestination(): Destination | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(DESTINATION_KEY) || "null") as Destination | null;
    if (!parsed || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDestination(destination: Destination | null) {
  if (!destination) localStorage.removeItem(DESTINATION_KEY);
  else localStorage.setItem(DESTINATION_KEY, JSON.stringify(destination));
}
