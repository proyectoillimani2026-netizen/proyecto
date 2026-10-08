import { HttpError } from "./orders";
import type { Product } from "./types";

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function parseProduct(body: Partial<Product>, current?: Product) {
  const name = clean(body.name ?? current?.name, 80);
  const description = clean(body.description ?? current?.description, 240);
  const category = clean(body.category ?? current?.category, 40);
  const image = clean(body.image ?? current?.image, 400);
  const price = Math.round(Number(body.price ?? current?.price));
  const discountPercent = Math.round(Number(body.discountPercent ?? current?.discountPercent ?? 0));
  const stock = Math.round(Number(body.stock ?? current?.stock ?? 0));
  const available = body.available ?? current?.available ?? true;
  const soldOut = body.soldOut ?? current?.soldOut ?? false;

  if (name.length < 2) throw new HttpError(400, "El producto necesita un nombre.");
  if (!category) throw new HttpError(400, "Elegí una categoría.");
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, "El precio no es válido.");
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 90) {
    throw new HttpError(400, "El descuento tiene que estar entre 0 y 90%.");
  }
  if (!Number.isFinite(stock) || stock < 0 || stock > 9999) throw new HttpError(400, "El stock no es válido.");

  return {
    name,
    description,
    category,
    image,
    price,
    discountPercent,
    stock,
    available: Boolean(available),
    soldOut: Boolean(soldOut),
  };
}

export function unlimitedStock(stock: number) {
  return stock <= 0;
}

export function cannotAdd(product: Pick<Product, "stock" | "soldOut">, quantity: number) {
  if (product.soldOut) return true;
  if (unlimitedStock(product.stock)) return false;
  return quantity >= product.stock;
}
