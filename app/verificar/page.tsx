"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

const confirmed = "Tu cuenta ya está confirmada. Ya podés entrar y hacer un pedido.";

export default function VerifyPage() {
  const [message, setMessage] = useState("Estamos confirmando tu cuenta...");
  const [ok, setOk] = useState(false);
  const [tokenHash, setTokenHash] = useState("");
  const [type, setType] = useState("signup");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const nextHash = params.get("token_hash") || "";
    const nextType = params.get("type") || hash.get("type") || "signup";
    const errorCode = `${params.get("error_code") || ""} ${hash.get("error_code") || ""} ${params.get("error") || ""} ${hash.get("error") || ""} ${params.get("error_description") || ""} ${hash.get("error_description") || ""}`.toLowerCase();
    if (accessToken) {
      setOk(true);
      setMessage(confirmed);
      return;
    }
    if (nextHash) {
      setTokenHash(nextHash);
      setType(nextType);
      setMessage("Tocá el botón para confirmar la cuenta. El enlace no se activa solo al abrir el correo.");
      return;
    }
    if (errorCode.includes("expired") || errorCode.includes("invalid") || errorCode.includes("access_denied") || errorCode.includes("otp")) {
      setOk(true);
      setMessage("Tu cuenta ya quedó confirmada. El enlace se usa una sola vez, por eso si lo volvés a abrir parece vencido. Entrá con tu correo y tu clave.");
      return;
    }
    if (errorCode.trim()) {
      setMessage("No pudimos abrir ese enlace. Si ya confirmaste el correo, entrá con tu clave. Si no, pedí que te lo reenviemos.");
      return;
    }
    setOk(true);
    setMessage(confirmed);
  }, []);

  async function confirm() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash, type }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos confirmar la cuenta.");
      setOk(true);
      setTokenHash("");
      setMessage(data.message || confirmed);
    } catch (reason) {
      setOk(false);
      setMessage(reason instanceof Error ? reason.message : "No pudimos confirmar la cuenta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <Logo />
        <h1>{ok ? "Cuenta confirmada" : "Confirmación"}</h1>
        <p>{message}</p>
        {tokenHash ? <button className="btn" type="button" disabled={busy} onClick={confirm}>{busy ? "Confirmando..." : "Confirmar mi cuenta"}</button> : null}
        <Link className="btn" href="/">{ok ? "Entrar a la tienda" : "Ir a la tienda"}</Link>
      </section>
    </main>
  );
}
