import { StaffGate } from "@/components/StaffGate";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffGate roles={["admin", "delivery"]} next="/delivery">
      {children}
    </StaffGate>
  );
}
