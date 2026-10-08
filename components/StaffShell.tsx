"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { roleLabel } from "@/lib/format";
import type { Session } from "@/lib/types";
import { Logo } from "./Logo";
import { PreviewEye } from "./PreviewEye";

export function StaffShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const path = usePathname();
  const shop = session.role !== "kitchen" && session.role !== "delivery";
  const home = session.role === "kitchen" ? "/cocina" : session.role === "delivery" ? "/delivery" : "/";
  const links = [
    ...(shop ? [{ href: "/", label: "Tienda" }] : []),
    ...(session.role === "admin" || session.role === "kitchen" ? [{ href: "/cocina", label: "Cocina" }] : []),
    ...(session.role === "admin" || session.role === "delivery" ? [{ href: "/delivery", label: "Delivery" }] : []),
    ...(session.role === "admin" || session.role === "waiter" ? [{ href: "/mozo", label: "Mozo" }] : []),
    ...(session.role === "admin" ? [{ href: "/admin", label: "Administración" }] : []),
  ];

  return (
    <div>
      <header className="staff-bar">
        <Link href={home}><Logo /></Link>
        <nav>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={path === link.href ? "active" : ""}>{link.label}</Link>
          ))}
        </nav>
        {session.role === "admin" ? <PreviewEye /> : null}
        <div className="who">
          <div>
            <b>{session.name}</b>
            <small> · {roleLabel[session.role]}</small>
          </div>
          <button
            className="text-btn"
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", headers: { "x-ie-role": session.role } });
              sessionStorage.removeItem("ie_role");
              window.location.href = "/?cuenta=1";
            }}
          >
            Salir
          </button>
        </div>
      </header>
      <main className="staff-main">{children}</main>
    </div>
  );
}
