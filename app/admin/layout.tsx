import { StaffGate } from "@/components/StaffGate";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffGate roles={["admin"]} next="/admin">{children}</StaffGate>;
}
