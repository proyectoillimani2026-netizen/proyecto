"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { formatWhen, money, argentinaPhone, categoryOrder, roleLabel } from "@/lib/format";
import { menuSources } from "@/lib/image-src";
import { unlimitedStock } from "@/lib/products";
import type { Product, PublicUser, Restaurant, Role } from "@/lib/types";
import { ConfirmDelete } from "./ConfirmDelete";
import { OrderBoard } from "./OrderBoard";
import { StaffHistory } from "./StaffHistory";

type Tab = "pedidos" | "historial" | "productos" | "local" | "equipo" | "clientes";
type PublicCustomer = { id: string; name: string; email: string; phone: string; confirmed: boolean; locationLabel: string; createdAt: string };
type Draft = {
  name: string;
  description: string;
  category: string;
  price: string;
  discountPercent: string;
  stock: string;
  image: string;
  available: boolean;
};

const blank: Draft = {
  name: "",
  description: "",
  category: "Empanadas",
  price: "",
  discountPercent: "0",
  stock: "10",
  image: "",
  available: true,
};

export function AdminPanel() {
  const [tab, setTab] = useState<Tab>("pedidos");
  const [products, setProducts] = useState<Product[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [customers, setCustomers] = useState<PublicCustomer[]>([]);
  const [mercadopago, setMercadopago] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [meId, setMeId] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState<string | null>(null);
  const categoryBox = useRef<HTMLLabelElement>(null);

  async function loadCatalog() {
    const response = await fetch("/api/products?all=1", { cache: "no-store" });
    const data = await response.json();
    setProducts(data.products || []);
    setRestaurant(data.restaurant || null);
    const settings = await fetch("/api/settings", { cache: "no-store" }).then((item) => item.json());
    setMercadopago(Boolean(settings.mercadopago));
  }

  async function loadStaff() {
    const response = await fetch("/api/staff", { cache: "no-store" });
    const data = await response.json();
    setUsers(data.users || []);
  }

  async function loadCustomers() {
    const response = await fetch("/api/customers", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudieron cargar los clientes.");
    setCustomers(data.customers || []);
  }

  useEffect(() => {
    loadCatalog().catch(() => setError("No se pudo cargar el catálogo."));
    loadStaff().catch(() => setError("No se pudo cargar el equipo."));
    loadCustomers().catch(() => setError("No se pudieron cargar los clientes."));
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setMeId(data.user?.id || ""))
      .catch(() => setMeId(""));
  }, []);

  useEffect(() => {
    if (!categoryOpen) return;
    function close(event: MouseEvent) {
      if (!categoryBox.current?.contains(event.target as Node)) setCategoryOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [categoryOpen]);

  function edit(product?: Product) {
    setEditing(product?.id || null);
    setFile(null);
    setDraft(
      product
        ? {
            name: product.name,
            description: product.description,
            category: product.category,
            price: String(product.price),
            discountPercent: String(product.discountPercent),
            stock: String(product.stock),
            image: product.image,
            available: product.available,
          }
        : blank,
    );
    setTab("productos");
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      let image = draft.image;
      if (file) {
        const form = new FormData();
        form.set("file", file);
        const upload = await fetch("/api/upload", { method: "POST", body: form });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded.error || "No se pudo subir la imagen.");
        image = uploaded.url;
      }
      const payload = {
        ...draft,
        image,
        price: Number(draft.price),
        discountPercent: Number(draft.discountPercent),
        stock: Number(draft.stock),
      };
      const response = await fetch(editing ? `/api/products/${editing}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
      setNoteFor("product");
      setMessage(editing ? "Producto actualizado." : "Producto publicado en la tienda.");
      setEditing(null);
      setDraft(blank);
      setFile(null);
      await loadCatalog();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
    }
  }

  async function patchProduct(id: string, body: Partial<Product>, ok: string) {
    setError("");
    const response = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "No se pudo actualizar el producto.");
      return;
    }
    setMessage(ok);
    await loadCatalog();
  }

  async function removeProduct(id: string) {
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "No se pudo borrar.");
      return;
    }
    await loadCatalog();
  }

  async function savePlace(event: FormEvent) {
    event.preventDefault();
    if (!restaurant) return;
    setError("");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(restaurant),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "No se pudo guardar el local.");
      return;
    }
    setRestaurant(data.restaurant);
    setNoteFor("local");
    setMessage("Datos del local guardados.");
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError("");
    const response = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        username: form.get("username"),
        password: form.get("password"),
        role: form.get("role"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "No se pudo crear el usuario.");
      return;
    }
    formElement.reset();
    setNoteFor("staff");
    setMessage("Persona agregada al equipo.");
    await loadStaff();
  }

  async function updateUser(event: FormEvent<HTMLFormElement>, user: PublicUser) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("password") || "");
    setError("");
    const response = await fetch(`/api/staff/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        username: form.get("username"),
        role: form.get("role") || user.role,
        ...(password ? { password } : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "No se pudo guardar.");
      return;
    }
    setEditingUser(null);
    setNoteFor(user.id);
    setMessage("Datos guardados.");
    await loadStaff();
  }

  const categories = [...new Set([...categoryOrder, ...products.map((product) => product.category)])];
  const lowStock = products.filter((product) => product.available && !product.soldOut && product.stock > 0 && product.stock <= 5);
  const roleOrder: Role[] = ["kitchen", "delivery", "waiter", "admin"];

  return (
    <section>
      <h1>Administración</h1>
      <p className="muted">Productos, ofertas, stock y el recorrido de cada pedido.</p>
      {!mercadopago ? <p className="banner">Mercado Pago todavía no está configurado. Los pedidos en efectivo funcionan. Para cobrar online, cargá MP_ACCESS_TOKEN en .env.local.</p> : <p className="banner">Mercado Pago está configurado.</p>}
      {message ? <p className="banner">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="tabs">
        {(["pedidos", "historial", "productos", "local", "equipo", "clientes"] as Tab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} type="button" onClick={() => setTab(item)}>
            {item === "pedidos" ? "Pedidos" : item === "historial" ? "Historial" : item === "productos" ? "Productos" : item === "local" ? "Local" : item === "equipo" ? "Equipo" : "Clientes"}
          </button>
        ))}
      </div>

      {tab === "historial" ? <StaffHistory /> : null}

      {tab === "pedidos" ? (
        <>
          {lowStock.length > 0 ? <p className="banner">Stock bajo: {lowStock.map((product) => `${product.name} (${product.stock})`).join(", ")}</p> : null}
          <OrderBoard role="admin" title="Pedidos" intro="Los pedidos en efectivo entran confirmados. Los de Mercado Pago aparecen cuando el pago se acredita." />
        </>
      ) : null}

      {tab === "productos" ? (
        <div className="stack">
          <form className="panel form" onSubmit={saveProduct}>
            <h2>{editing ? "Editar producto" : "Nuevo producto"}</h2>
            <label>Nombre<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
            <label>Descripción<textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <div className="inline">
              <label className="category-field" ref={categoryBox}>
                Categoría
                <input
                  value={draft.category}
                  onChange={(event) => { setDraft({ ...draft, category: event.target.value }); setCategoryOpen(true); setCategoryQuery(event.target.value); }}
                  onFocus={() => { setCategoryOpen(true); setCategoryQuery(null); }}
                  onClick={() => { setCategoryOpen(true); setCategoryQuery(null); }}
                  required
                  aria-expanded={categoryOpen}
                  aria-autocomplete="list"
                />
                {categoryOpen ? (
                  <ul className="category-list" role="listbox">
                    {(categoryQuery == null ? categories : categories.filter((category) => category.toLowerCase().includes(categoryQuery.trim().toLowerCase()))).map((category) => (
                      <li key={category}>
                        <button type="button" role="option" onMouseDown={(event) => { event.preventDefault(); setDraft({ ...draft, category }); setCategoryOpen(false); }}>{category}</button>
                      </li>
                    ))}
                    {categoryQuery != null && !categories.some((category) => category.toLowerCase().includes(categoryQuery.trim().toLowerCase())) ? <li className="muted">Podés crear esa categoría al guardar.</li> : null}
                  </ul>
                ) : null}
              </label>
              <label>Precio<input type="number" min="0" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} required /></label>
              <label>% off<input type="number" min="0" max="90" value={draft.discountPercent} onChange={(event) => setDraft({ ...draft, discountPercent: event.target.value })} /></label>
              <label>Stock<input type="number" min="0" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} required /></label>
            </div>
            <p className="muted">Stock 0 es ilimitado. Para cortar las ventas usá Agotado, y para sacarlo del menú usá Ocultar.</p>
            <label>Foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
            <p className="muted">Se guardan dos WebP en Supabase: 256 px para el menú y 720 px para pantallas grandes.</p>
            <label>O URL de imagen<input value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} placeholder="https://..." /></label>
            <label className="check"><input type="checkbox" checked={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.checked })} /> Visible en la tienda</label>
            <div className="actions">
              <button className="btn" type="submit">{editing ? "Guardar cambios" : "Publicar"}</button>
              {editing ? <button className="btn ghost" type="button" onClick={() => edit()}>Cancelar</button> : null}
            </div>
            {noteFor === "product" && message ? <p className="saved-note" role="status">{message}</p> : null}
          </form>
          <div className="product-list">
            {products.map((product) => (
              <article key={product.id} className="product-row">
                <img {...menuSources(product.image, "84px")} alt="" width={84} height={84} loading="lazy" decoding="async" />
                <div>
                  <b>{product.name}</b>
                  <p className="muted">{product.category} · {money(product.price)} · {product.discountPercent}% off · {product.soldOut ? "agotado" : unlimitedStock(product.stock) ? "stock ilimitado" : `stock ${product.stock}`} · {product.available ? "visible" : "oculto"}</p>
                </div>
                <div className="actions">
                  <button className="text-btn" type="button" onClick={() => edit(product)}>Editar</button>
                  <button className="text-btn" type="button" onClick={() => patchProduct(product.id, { soldOut: !product.soldOut }, product.soldOut ? "El producto volvió a tener stock." : "Producto marcado como agotado.")}>{product.soldOut ? "Quitar agotado" : "Agotado"}</button>
                  <button className="text-btn" type="button" onClick={() => patchProduct(product.id, { available: !product.available }, product.available ? "Producto oculto en la tienda." : "Producto visible en la tienda.")}>{product.available ? "Ocultar" : "Mostrar"}</button>
                  <ConfirmDelete prompt="¿Borrar este producto?" onConfirm={() => removeProduct(product.id)} />
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "local" && restaurant ? (
        <form className="panel form" onSubmit={savePlace}>
          <h2>Datos del local</h2>
          <label>Nombre<input value={restaurant.name} onChange={(event) => setRestaurant({ ...restaurant, name: event.target.value })} /></label>
          <label>Descripción<input value={restaurant.tagline} onChange={(event) => setRestaurant({ ...restaurant, tagline: event.target.value })} /></label>
          <label>Dirección<input value={restaurant.address} onChange={(event) => setRestaurant({ ...restaurant, address: event.target.value })} /></label>
          <label>Ciudad<input value={restaurant.city} onChange={(event) => setRestaurant({ ...restaurant, city: event.target.value })} /></label>
          <label>País<input value={restaurant.country || ""} onChange={(event) => setRestaurant({ ...restaurant, country: event.target.value })} /></label>
          <label>Tipo de comida<input value={restaurant.cuisine || ""} onChange={(event) => setRestaurant({ ...restaurant, cuisine: event.target.value })} /></label>
          <label>Horario<input value={restaurant.hours} onChange={(event) => setRestaurant({ ...restaurant, hours: event.target.value })} /></label>
          <label>Teléfono<input value={restaurant.phone} onChange={(event) => setRestaurant({ ...restaurant, phone: event.target.value })} /></label>
          <div className="inline">
            <label>Precio por km $<input type="number" min="0" value={restaurant.pricePerKm || 0} onChange={(event) => setRestaurant({ ...restaurant, pricePerKm: Number(event.target.value) })} /></label>
            <label>Gratis desde $<input type="number" min="0" value={restaurant.freeDeliveryFrom} onChange={(event) => setRestaurant({ ...restaurant, freeDeliveryFrom: Number(event.target.value) })} /></label>
            <label>Tiempo delivery<input value={restaurant.etaDelivery} onChange={(event) => setRestaurant({ ...restaurant, etaDelivery: event.target.value })} /></label>
            <label>Tiempo retiro<input value={restaurant.etaPickup} onChange={(event) => setRestaurant({ ...restaurant, etaPickup: event.target.value })} /></label>
          </div>
          <button className="btn" type="submit">Guardar local</button>
          {noteFor === "local" && message ? <p className="saved-note" role="status">{message}</p> : null}
        </form>
      ) : null}

      {tab === "clientes" ? (
        <div className="stack">
          <p className="muted">Cuentas de clientes. Una cuenta confirmada ya abrió el correo de verificación.</p>
          {customers.length === 0 ? <p>Todavía no hay cuentas de clientes.</p> : null}
          <div className="product-list">
            {customers.map((customer) => (
              <article key={customer.id} className="product-row">
                <div />
                <div>
                  <b>{customer.name}</b>
                  <p className="muted">{customer.email} · {customer.phone ? argentinaPhone(customer.phone) : "sin teléfono"} · {customer.confirmed ? "correo confirmado" : "falta confirmar el correo"}{customer.locationLabel ? ` · ${customer.locationLabel}` : ""}{customer.createdAt ? ` · ${formatWhen(customer.createdAt)}` : ""}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "equipo" ? (
        <div className="stack">
          <form className="panel form" onSubmit={saveUser}>
            <h2>Nueva persona</h2>
            <p className="muted">Nombre de la persona, usuario y clave para entrar, y el rol que va a cumplir.</p>
            <div className="inline">
              <label>Nombre<input name="name" required /></label>
              <label>Usuario<input name="username" required /></label>
              <label>Clave<input name="password" type="password" required minLength={6} /></label>
              <label>Rol
                <select name="role" defaultValue="delivery">
                  <option value="kitchen">Cocina</option>
                  <option value="delivery">Delivery</option>
                  <option value="waiter">Mozo</option>
                  <option value="admin">Administración</option>
                </select>
              </label>
            </div>
            <button className="btn" type="submit">Agregar</button>
            {noteFor === "staff" && message ? <p className="saved-note" role="status">{message}</p> : null}
          </form>
          <p className="muted">Cada rol tiene su lista. Puede haber varias personas en cocina, delivery o mozo, y cada una entra con su usuario.</p>
          {roleOrder.map((role) => {
            const people = users.filter((user) => user.role === role);
            return (
              <section key={role} className="role-group">
                <h2>{roleLabel[role]}</h2>
                {people.length === 0 ? <p className="muted">Nadie en este rol todavía.</p> : (
                  <div className="role-card">
                    {people.map((user) => (
                      <div key={user.id} className="role-person">
                        <div>
                          <b>{user.name}</b>
                          {noteFor === user.id && message && editingUser !== user.id ? <p className="saved-note" role="status">{message}</p> : null}
                          {editingUser === user.id ? (
                            <form className="inline" onSubmit={(event) => updateUser(event, user)}>
                              <label>Nombre<input name="name" defaultValue={user.name} required /></label>
                              <label>Usuario<input name="username" defaultValue={user.username} required /></label>
                              <label>Clave<input name="password" className="secret-field" type="text" defaultValue={user.password || ""} minLength={6} placeholder="Escribila para guardarla" autoComplete="off" /></label>
                              <label>Rol
                                <select name="role" defaultValue={user.role} disabled={user.id === meId}>
                                  <option value="kitchen">Cocina</option>
                                  <option value="delivery">Delivery</option>
                                  <option value="waiter">Mozo</option>
                                  <option value="admin">Administración</option>
                                </select>
                              </label>
                              <button className="btn" type="submit">Guardar</button>
                              <button className="btn ghost" type="button" onClick={() => setEditingUser(null)}>Cancelar</button>
                            </form>
                          ) : null}
                        </div>
                        <div className="actions">
                          {editingUser === user.id ? null : <button className="text-btn" type="button" onClick={() => setEditingUser(user.id)}>Editar</button>}
                          <ConfirmDelete
                            prompt={`¿Borrar a ${user.name}?`}
                            onConfirm={async () => {
                              const response = await fetch(`/api/staff/${user.id}`, { method: "DELETE" });
                              const data = await response.json();
                              if (!response.ok) setError(data.error || "No se pudo borrar.");
                              else {
                                if (editingUser === user.id) setEditingUser(null);
                                await loadStaff();
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
