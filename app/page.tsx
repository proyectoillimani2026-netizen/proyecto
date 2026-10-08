import { Storefront } from "@/components/Storefront";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await readDb();
  return <Storefront restaurant={db.restaurant} products={db.products.filter((product) => product.available)} />;
}
