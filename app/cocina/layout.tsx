import { StaffGate } from "@/components/StaffGate";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffGate roles={["admin", "kitchen"]} next="/cocina">
      {children}
    </StaffGate>
  );
}
