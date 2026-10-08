"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LAST_ORDER_KEY, MODE_KEY, readCart, readDestination, writeCart, writeDestination, type Destination } from "@/lib/cart";
import { distanceKm, money, quoteFee, unitPrice } from "@/lib/format";
import type { DiningMode, PaymentMethod, Product, Restaurant } from "@/lib/types";
import { Logo } from "./Logo";

type Draft = {
  customerName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  paymentMethod: PaymentMethod;
};

const empty: Draft = { customerName: "", phone: "", email: "", address: "", notes: "", paymentMethod: "cash" };

export function Checkout() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<DiningMode>("delivery");
  const [draft, setDraft] = useState<Draft>(empty);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [sending, setSending] = useState(false);
  const [customer, setCustomer] = useState<{ name: string } | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === "pickup" || stored === "delivery") setMode(stored);
    const place = readDestination();
    setDestination(place);
    if (place) setDraft((current) => ({ ...current, address: place.query }));
    setCart(readCart());
    fetch("/api/products")
      .then((response) => response.json())
      .then((data) => {
        setProducts(data.products || []);
        setRestaurant(data.restaurant || null);
      })
      .catch(() => setError("No pudimos cargar el menú."));
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (data.user?.role === "customer") {
          setCustomer({ name: data.user.name });
          setDraft((current) => ({
            ...current,
            customerName: data.user.name || current.customerName,
            phone: data.user.phone || current.phone,
            email: data.user.email || current.email,
            address: current.address || data.user.locationLabel || "",
          }));
          if (!place && data.user.latitude && data.user.longitude && data.user.locationLabel) {
            const saved = { query: data.user.locationLabel as string, label: data.user.locationLabel as string, lat: data.user.latitude as number, lng: data.user.longitude as number };
            setDestination(saved);
            writeDestination(saved);
            setDraft((current) => ({ ...current, address: saved.query }));
          }
        }
      })
      .finally(() => setAuthReady(true));
  }, []);

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => ({ product: products.find((product) => product.id === productId), quantity }))
        .filter((line) => line.quantity > 0),
    [cart, products],
  );
  const missing = lines.some((line) => !line.product || !line.product.available || line.product.soldOut || (line.product.stock > 0 && line.quantity > line.product.stock));
  const merchandise = lines.reduce((sum, line) => {
    if (!line.product) return sum;
    return sum + unitPrice(line.product.price, line.product.discountPercent) * line.quantity;
  }, 0);
  const km = restaurant && destination ? distanceKm(restaurant.latitude, restaurant.longitude, destination.lat, destination.lng) : 0;
  const fee = restaurant && (mode === "pickup" || destination)
    ? quoteFee(km, restaurant.pricePerKm, merchandise, restaurant.freeDeliveryFrom, mode)
    : 0;
  const feeKnown = mode === "pickup" || Boolean(destination);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "delivery" && !destination) {
      setError("Calculá el envío con tu dirección antes de confirmar.");
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          mode,
          items: lines.filter((line) => line.product).map((line) => ({ productId: line.product!.id, quantity: line.quantity })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear el pedido.");
      writeCart({});
      localStorage.setItem(LAST_ORDER_KEY, data.order.id);
      window.location.href = data.checkoutUrl || `/pedido/${data.order.id}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el pedido.");
      setSending(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <Link href="/"><Logo /></Link>
      </header>
      <main className="narrow checkout">
        <form className="panel form" onSubmit={submit}>
          <h1>Checkout</h1>
          <p className="muted">{mode === "delivery" ? "Te lo llevamos a domicilio." : `Retirás en ${restaurant ? `${restaurant.address}, ${restaurant.city}` : "el local"}.`}</p>
          {!authReady ? <p className="muted">Cargando tu cuenta...</p> : null}
          {authReady && !customer ? (
            <div className="stack">
              <p>Registrate o entrá para confirmar el pedido y verlo después en tu historial.</p>
              <div className="mode-switch">
                <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>Iniciar sesión</button>
                <button className={authMode === "register" ? "active" : ""} type="button" onClick={() => setAuthMode("register")}>Registrarse</button>
              </div>
              <div className="form">
                {authMode === "register" ? <label>Nombre<input name="name" required /></label> : null}
                <label>Email<input name="email" type="email" required /></label>
                {authMode === "register" ? <label>Teléfono<input name="phone" required /></label> : null}
                <label>Clave<input name="password" type="password" required minLength={6} /></label>
                {authMode === "register" ? <p className="muted">Te enviamos un correo para confirmar la cuenta antes de poder comprar.</p> : null}
                <button className="btn" type="button" onClick={async (event) => {
                  const box = event.currentTarget.parentElement;
                  if (!box) return;
                  const value = (name: string) => (box.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value || "";
                  setError("");
                  const response = await fetch(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(authMode === "register"
                      ? { name: value("name"), email: value("email"), phone: value("phone"), password: value("password"), lat: destination?.lat, lng: destination?.lng, label: destination?.query }
                      : { username: value("email"), password: value("password") }),
                  });
                  const data = await response.json();
                  if (data.pending) {
                    setError("");
                    setCanResend(false);
                    setNotice(data.message);
                    return;
                  }
                  if (!response.ok) {
                    setNotice("");
                    setCanResend(data.code === "unverified");
                    setError(data.error || "No se pudo ingresar.");
                    return;
                  }
                  sessionStorage.setItem("ie_role", "customer");
                  const me = await fetch("/api/auth/me").then((item) => item.json());
                  const user = me.user || data.user;
                  if (!user || user.role !== "customer") {
                    setError("Esta cuenta es del equipo. Entrá por el ingreso del equipo.");
                    await fetch("/api/auth/logout", { method: "POST", headers: { "x-ie-role": "customer" } });
                    sessionStorage.removeItem("ie_role");
                    return;
                  }
                  setCustomer({ name: user.name });
                  setDraft((current) => ({
                    ...current,
                    customerName: user.name || current.customerName,
                    phone: user.phone || value("phone") || current.phone,
                    email: user.email || value("email") || current.email,
                  }));
                }}>{authMode === "register" ? "Crear cuenta" : "Entrar"}</button>
                {notice ? <p className="banner">{notice}</p> : null}
                {canResend ? (
                  <button className="btn ghost" type="button" onClick={async (event) => {
                    const box = event.currentTarget.parentElement;
                    const email = (box?.querySelector("[name=email]") as HTMLInputElement | null)?.value || "";
                    setError("");
                    const response = await fetch("/api/auth/resend", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email }),
                    });
                    const data = await response.json();
                    if (!response.ok) setError(data.error || "No pudimos reenviar el correo.");
                    else setNotice(data.message);
                  }}>Reenviar correo</button>
                ) : null}
              </div>
            </div>
          ) : null}
          {customer ? <p className="banner">Pedís como <b>{customer.name}</b>. El pedido queda en <Link href="/cuenta">Mis pedidos</Link>.</p> : null}
          <div className="choices">
            <button className={mode === "delivery" ? "choice active" : "choice"} type="button" onClick={() => { setMode("delivery"); localStorage.setItem(MODE_KEY, "delivery"); }}>Entrega</button>
            <button className={mode === "pickup" ? "choice active" : "choice"} type="button" onClick={() => { setMode("pickup"); localStorage.setItem(MODE_KEY, "pickup"); }}>Retiro</button>
          </div>
          {customer && draft.customerName.trim().length >= 2 && draft.phone.trim().length >= 6 && draft.email.includes("@") ? (
            <p className="muted">Usamos el nombre, el teléfono y el email de tu cuenta. Para cambiarlos, abrí el menú y entrá a Configuración.</p>
          ) : null}
          {customer && draft.customerName.trim().length < 2 ? <label>Nombre<input required value={draft.customerName} onChange={(event) => set("customerName", event.target.value)} /></label> : null}
          {customer && draft.phone.trim().length < 6 ? <label>Teléfono<input required value={draft.phone} onChange={(event) => set("phone", event.target.value)} placeholder="+549261..." /></label> : null}
          {customer && !draft.email.includes("@") ? <label>Email<input type="email" required value={draft.email} onChange={(event) => set("email", event.target.value)} /></label> : null}
          {mode === "delivery" ? (
            <label>Dirección de entrega
              <input required value={draft.address} onChange={(event) => { set("address", event.target.value); setDestination(null); writeDestination(null); }} placeholder="Calle, número, barrio" />
            </label>
          ) : null}
          {mode === "delivery" ? (
            <button className="btn ghost" type="button" onClick={async () => {
              setError("");
              const response = await fetch(`/api/geo?q=${encodeURIComponent(draft.address)}`);
              const data = await response.json();
              if (!response.ok) {
                setError(data.error || "No encontramos esa dirección.");
                return;
              }
              const next = { query: draft.address.trim(), label: data.place.label as string, lat: data.place.lat as number, lng: data.place.lng as number };
              setDestination(next);
              writeDestination(next);
            }}>Calcular envío</button>
          ) : null}
          <label>Notas<textarea rows={3} value={draft.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Piso, timbre, sin cebolla..." /></label>
          <div className="choices">
            <button className={draft.paymentMethod === "cash" ? "choice active" : "choice"} type="button" onClick={() => set("paymentMethod", "cash")}>Efectivo al recibir</button>
            <button className={draft.paymentMethod === "mercadopago" ? "choice active" : "choice"} type="button" onClick={() => set("paymentMethod", "mercadopago")}>Mercado Pago</button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn wide" disabled={!customer || sending || lines.length === 0 || missing || (mode === "delivery" && !feeKnown)} type="submit">
            {sending ? "Enviando..." : `Confirmar · ${money(merchandise + (feeKnown ? fee : 0))}`}
          </button>
        </form>
        <aside className="panel">
          <h2>Resumen</h2>
          {lines.length === 0 ? <p>El pedido está vacío. <Link href="/"><b>Volver al menú</b></Link></p> : null}
          {lines.map((line) => (
            <div key={line.product?.id || line.quantity} className="total-row">
              <span>{line.quantity} × {line.product?.name || "Producto no disponible"}</span>
              <b>{line.product ? money(unitPrice(line.product.price, line.product.discountPercent) * line.quantity) : ""}</b>
            </div>
          ))}
          {missing ? <p className="error">Hay un producto sin stock. Volvé al menú y ajustá el pedido.</p> : null}
          <div className="total-row"><span>Envío</span><b>{!feeKnown ? "A calcular" : fee === 0 ? "Gratis" : money(fee)}</b></div>
          <div className="total-row grand"><span>Total</span><b>{money(merchandise + (feeKnown ? fee : 0))}</b></div>
        </aside>
      </main>
    </>
  );
}
