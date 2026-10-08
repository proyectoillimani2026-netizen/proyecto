import { StaffGate } from "@/components/StaffGate";

export default async function WaiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffGate roles={["admin", "waiter"]} next="/mozo">
      {children}
    </StaffGate>
  );
}
