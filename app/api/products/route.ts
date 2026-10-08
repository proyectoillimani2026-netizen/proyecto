import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { readDb, updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { parseProduct } from "@/lib/products";
import type { Product } from "@/lib/types";

export async function GET(request: Request) {
  const db = await readDb();
  const all = new URL(request.url).searchParams.get("all") === "1";
  const session = await getSession();
  const products = all && session?.role === "admin" ? db.products : db.products.filter((product) => product.available);
  return Response.json({ products, restaurant: db.restaurant });
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
    const body = (await request.json()) as Partial<Product>;
    const product = await updateDb((db) => {
      const next = { id: randomUUID(), ...parseProduct(body) };
      db.products.unshift(next);
      return next;
    });
    return Response.json({ product });
  } catch (error) {
    return jsonError(error);
  }
}
