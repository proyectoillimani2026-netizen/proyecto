"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { roleLabel } from "@/lib/format";
import type { Role } from "@/lib/types";
import { Logo } from "./Logo";

const homes: Record<Role, string> = { admin: "/admin", kitchen: "/cocina", delivery: "/delivery", waiter: "/mozo", customer: "/" };

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Role | "">("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setCurrent(data.user?.role || ""));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "No se pudo ingresar.");
      return;
    }
    const role = data.user.role as Role;
    sessionStorage.setItem("ie_role", role);
    const fallback = homes[role];
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
    router.push(target);
    router.refresh();
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <Logo />
        <h1>Ingreso del equipo</h1>
        <p className="muted">Cocina, delivery, mozo y administración entran por acá. Los clientes se registran en la tienda.</p>
        {current ? <p className="banner">Ya tenés una sesión de {roleLabel[current]}. <a href={homes[current]}>Ir al panel</a></p> : null}
        <div className="form">
          <label>Usuario<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
          <label>Clave<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn" type="submit">Entrar</button>
        </div>
        <table className="creds">
          <tbody>
            <tr><td>Administración</td><td>admin</td><td>admin123</td></tr>
            <tr><td>Olga · Cocina</td><td>cocina</td><td>illimani-cocina</td></tr>
            <tr><td>Juan · Delivery</td><td>delivery</td><td>illimani-delivery</td></tr>
            <tr><td>Pepe · Mozo</td><td>mozo</td><td>mozo123</td></tr>
          </tbody>
        </table>
        <a href="/">Volver a la tienda</a>
      </form>
    </main>
  );
}
