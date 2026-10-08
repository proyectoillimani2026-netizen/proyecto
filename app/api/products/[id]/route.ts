import { getSession } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { HttpError } from "@/lib/orders";
import { parseProduct } from "@/lib/products";
import type { Product } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
    const { id } = await context.params;
    const body = (await request.json()) as Partial<Product>;
    const product = await updateDb((db) => {
      const current = db.products.find((entry) => entry.id === id);
      if (!current) throw new HttpError(404, "No encontramos ese producto.");
      Object.assign(current, parseProduct(body, current));
      return current;
    });
    return Response.json({ product });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const session = await getSession();
    if (session?.role !== "admin") return Response.json({ error: "No autorizado" }, { status: 401 });
    const { id } = await context.params;
    await updateDb((db) => {
      const index = db.products.findIndex((entry) => entry.id === id);
      if (index === -1) throw new HttpError(404, "No encontramos ese producto.");
      db.products.splice(index, 1);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
