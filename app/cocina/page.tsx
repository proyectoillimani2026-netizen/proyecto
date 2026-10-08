import { OrderBoard } from "@/components/OrderBoard";

export default function KitchenPage() {
  return (
    <OrderBoard
      role="kitchen"
      title="Cocina"
      intro="Los pedidos en efectivo entran solos. Los de Mercado Pago aparecen cuando el pago se acredita. Aceptalos, preparalos y marcalos listos."
    />
  );
}
