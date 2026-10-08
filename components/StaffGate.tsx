"use client";

import { useEffect, useState } from "react";
import { StaffShell } from "./StaffShell";
import type { Role, Session } from "@/lib/types";

export function StaffGate({ children, roles, next }: { children: React.ReactNode; roles: Role[]; next: string }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const role = sessionStorage.getItem("ie_role");
    if (!role || !roles.includes(role as Role)) {
      window.location.replace("/?cuenta=1");
      return;
    }
    let gone = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (gone) return;
        if (!data.user || !roles.includes(data.user.role)) {
          window.location.replace("/?cuenta=1");
          return;
        }
        setSession({ sub: data.user.id, name: data.user.name, role: data.user.role, exp: 0 });
      })
      .catch(() => {
        if (!gone) window.location.replace("/?cuenta=1");
      });
    return () => {
      gone = true;
    };
  }, [next, roles.join("|")]);

  if (!session) return <main className="staff-main"><p>Entrando...</p></main>;
  return <StaffShell session={session}>{children}</StaffShell>;
}
