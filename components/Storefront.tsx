"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LAST_ORDER_KEY, MODE_KEY, readCart, readDestination, writeCart, writeDestination, type CartMap, type Destination } from "@/lib/cart";
import { distanceKm, formatKm, money, quoteFee, slug, sortCategories, trialProductName, unitPrice } from "@/lib/format";
import { cannotAdd } from "@/lib/products";
import type { Place } from "@/lib/geo";
import { readGps } from "@/lib/gps";
import type { DiningMode, Product, Restaurant, Role } from "@/lib/types";
import { Logo } from "./Logo";
import { PreviewEye } from "./PreviewEye";
import { MiniMap } from "./MiniMap";
import { bannerSources, menuSources } from "@/lib/image-src";

function brokenImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.src = "/food-fallback.svg";
}

function AddedMark() {
  return (
    <span className="add ok" aria-label="Agregado">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M5 12.5 9.2 17 19 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function FoodPhoto({ src, alt, sizes, width, height }: { src: string; alt: string; sizes: string; width: number; height: number }) {
  const image = menuSources(src, sizes);
  return (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={image.sizes}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={brokenImage}
    />
  );
}

export function Storefront({ restaurant, products }: { restaurant: Restaurant; products: Product[] }) {
  const [mode, setMode] = useState<DiningMode>("delivery");
  const [cart, setCart] = useState<CartMap>({});
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [hold, setHold] = useState<Record<string, "count" | "ok">>({});
  const holdTimer = useRef<Record<string, number>>({});
  const okTimer = useRef<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [road, setRoad] = useState<{ lat: number; lng: number }[]>([]);
  const [lastOrder, setLastOrder] = useState("");
  const [account, setAccount] = useState<{ name: string; phone?: string; email?: string; locationLabel?: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileNote, setProfileNote] = useState("");
  const [viewerRole, setViewerRole] = useState<Role | "">("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationHits, setLocationHits] = useState<Place[]>([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationSearching, setLocationSearching] = useState(false);
  const [savedPlace, setSavedPlace] = useState<Place | null>(null);
  const [placeError, setPlaceError] = useState("");
  const [destination, setDestination] = useState<Destination | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [editingPlace, setEditingPlace] = useState(false);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const locateRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const storedMode = localStorage.getItem(MODE_KEY);
    if (storedMode === "pickup" || storedMode === "delivery") setMode(storedMode);
    setCart(readCart());
    const savedPlace = readDestination();
    setDestination(savedPlace);
    if (savedPlace) setPlaceQuery(savedPlace.query);
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        const role = data.user?.role || "";
        const staffHome: Record<string, string> = { admin: "/admin", kitchen: "/cocina", delivery: "/delivery", waiter: "/mozo" };
        if (staffHome[role]) {
          window.location.replace(staffHome[role]);
          return;
        }
        setViewerRole(role);
        setAccount(role === "customer" ? data.user : null);
      })
      .catch(() => setAccount(null));
    if (new URLSearchParams(window.location.search).get("cuenta") === "1") {
      setMenuOpen(true);
      window.history.replaceState(null, "", "/");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const id = localStorage.getItem(LAST_ORDER_KEY) || "";
    if (!id) return;
    let gone = false;
    let timer = 0;
    const check = () => {
      fetch(`/api/orders/${id}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => {
          if (gone) return;
          const status = data.order?.status as string | undefined;
          const open = Boolean(status) && status !== "delivered" && status !== "cancelled";
          if (!open) {
            localStorage.removeItem(LAST_ORDER_KEY);
            setLastOrder("");
            window.clearInterval(timer);
            return;
          }
          setLastOrder(id);
        })
        .catch(() => undefined);
    };
    check();
    timer = window.setInterval(check, 8000);
    return () => {
      gone = true;
      window.clearInterval(timer);
    };
  }, []);

  function updateCart(recipe: (current: CartMap) => CartMap) {
    setCart((current) => {
      const next = recipe(current);
      writeCart(next);
      return next;
    });
  }

  function add(product: Product) {
    updateCart((current) => {
      const quantity = current[product.id] || 0;
      if (cannotAdd(product, quantity)) return current;
      return { ...current, [product.id]: quantity + 1 };
    });
  }

  function remove(productId: string) {
    updateCart((current) => {
      const quantity = current[productId] || 0;
      const next = { ...current };
      if (quantity <= 1) delete next[productId];
      else next[productId] = quantity - 1;
      return next;
    });
  }

  function clearHold(productId: string) {
    window.clearTimeout(holdTimer.current[productId]);
    window.clearTimeout(okTimer.current[productId]);
    setHold((current) => {
      if (!current[productId]) return current;
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function arm(productId: string) {
    window.clearTimeout(holdTimer.current[productId]);
    window.clearTimeout(okTimer.current[productId]);
    setHold((current) => ({ ...current, [productId]: "count" }));
    holdTimer.current[productId] = window.setTimeout(() => {
      setHold((current) => ({ ...current, [productId]: "ok" }));
      okTimer.current[productId] = window.setTimeout(() => clearHold(productId), 700);
    }, 1600);
  }

  function addAndHold(product: Product) {
    if (cannotAdd(product, cart[product.id] || 0)) return;
    add(product);
    arm(product.id);
  }

  function removeAndHold(productId: string) {
    const quantity = cart[productId] || 0;
    remove(productId);
    if (quantity <= 1) clearHold(productId);
    else arm(productId);
  }

  useEffect(() => {
    return () => {
      Object.values(holdTimer.current).forEach((timer) => window.clearTimeout(timer));
      Object.values(okTimer.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const detailClose = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!detailId) return;
    detailClose.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);

  function changeMode(next: DiningMode) {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  }

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return products.filter((product) => {
      if (!text) return true;
      return `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(text);
    });
  }, [products, query]);

  const categories = sortCategories([...new Set(visible.map((product) => product.category))]);
  const offers = products.filter((product) => product.discountPercent > 0 && !product.soldOut).slice(0, 3);
  const lines = products
    .filter((product) => cart[product.id])
    .map((product) => ({ product, quantity: cart[product.id] }));
  const merchandise = lines.reduce((sum, line) => sum + unitPrice(line.product.price, line.product.discountPercent) * line.quantity, 0);
  const discount = lines.reduce((sum, line) => sum + (line.product.price - unitPrice(line.product.price, line.product.discountPercent)) * line.quantity, 0);
  const km = destination ? distanceKm(restaurant.latitude, restaurant.longitude, destination.lat, destination.lng) : 0;
  const feeKnown = mode === "pickup" || Boolean(destination);
  const fee = mode === "pickup" ? 0 : destination ? quoteFee(km, restaurant.pricePerKm, merchandise, restaurant.freeDeliveryFrom, mode) : 0;
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const fullAddress = `${restaurant.address}, ${restaurant.city}`;
  const closeMatch = restaurant.hours.match(/a\s+(\d{1,2}:\d{2})/);
  const closeLabel = closeMatch ? `Abierto hasta las ${closeMatch[1]}` : restaurant.hours;

  useEffect(() => {
    if (!editingPlace) return;
    const text = placeQuery.trim();
    if (text.length < 3) {
      setSuggestions([]);
      setSuggesting(false);
      return;
    }
    setSuggesting(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggesting(true);
      try {
        const response = await fetch(`/api/geo?suggest=1&q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted) setSuggestions(response.ok ? data.places || [] : []);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSuggesting(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeQuery, editingPlace]);

  useEffect(() => {
    if (!editingPlace) return;
    function onPointer(event: MouseEvent) {
      if (!locateRef.current?.contains(event.target as Node)) setEditingPlace(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setEditingPlace(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [editingPlace]);

  useEffect(() => {
    if (!destination) {
      setRoad([]);
      return;
    }
    const points = `${restaurant.latitude},${restaurant.longitude};${destination.lat},${destination.lng}`;
    const controller = new AbortController();
    fetch(`/api/route?points=${encodeURIComponent(points)}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const path = Array.isArray(data.path) ? data.path : [];
        setRoad(path.length > 2 ? path : []);
      })
      .catch((reason) => {
        if ((reason as Error).name !== "AbortError") setRoad([]);
      });
    return () => controller.abort();
  }, [destination, restaurant.latitude, restaurant.longitude]);

  function applyPlace(place: Place) {
    const next = { query: place.short, label: place.label, lat: place.lat, lng: place.lng };
    setDestination(next);
    writeDestination(next);
    setPlaceQuery(place.short);
    setSuggestions([]);
    setEditingPlace(false);
    setPlaceError("");
    changeMode("delivery");
  }

  async function locate(event: FormEvent) {
    event.preventDefault();
    if (suggestions[0]) {
      applyPlace(suggestions[0]);
      return;
    }
    if (placeQuery.trim().length < 3) return;
    setSuggesting(true);
    setPlaceError("");
    try {
      const response = await fetch(`/api/geo?q=${encodeURIComponent(placeQuery)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No encontramos esa dirección.");
      applyPlace(data.place as Place);
    } catch (reason) {
      setPlaceError(reason instanceof Error ? reason.message : "No encontramos esa dirección.");
    } finally {
      setSuggesting(false);
    }
  }

  useEffect(() => {
    if (!locationOpen) return;
    const text = locationQuery.trim();
    if (text.length < 3) {
      setLocationHits([]);
      setLocationSearching(false);
      return;
    }
    setLocationSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geo?suggest=1&q=${encodeURIComponent(text)}`, { signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted) setLocationHits(response.ok ? data.places || [] : []);
      } catch (reason) {
        if ((reason as Error).name !== "AbortError") setLocationHits([]);
      } finally {
        if (!controller.signal.aborted) setLocationSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [locationQuery, locationOpen]);

  async function saveAccountPlace(place: Place) {
    setLocationBusy(true);
    setAuthError("");
    try {
      applyPlace(place);
      setSavedPlace(place);
      if (account) {
        const response = await fetch("/api/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: place.lat, lng: place.lng, label: place.short }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se pudo guardar la ubicación.");
        setAccount({ ...account, locationLabel: data.profile?.label || place.short });
        setProfileNote("Ubicación guardada.");
      }
      setLocationOpen(false);
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "No se pudo guardar la ubicación.");
    } finally {
      setLocationBusy(false);
    }
  }

  async function saveTypedLocation(event: FormEvent) {
    event.preventDefault();
    const text = locationQuery.trim();
    if (text.length < 3) {
      setAuthError("Escribí la calle y el número.");
      return;
    }
    const chosen = locationHits.find((place) => place.short.toLowerCase() === text.toLowerCase()) || locationHits[0];
    if (chosen && text.toLowerCase() === chosen.short.toLowerCase()) {
      await saveAccountPlace(chosen);
      return;
    }
    setLocationBusy(true);
    setAuthError("");
    try {
      const response = await fetch(`/api/geo?q=${encodeURIComponent(text)}`);
      const data = await response.json();
      if (!response.ok || !data.place) throw new Error(data.error || "No encontramos esa dirección.");
      await saveAccountPlace(data.place as Place);
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "No encontramos esa dirección.");
      setLocationBusy(false);
    }
  }

  async function captureGps() {
    setGpsBusy(true);
    setAuthError("");
    try {
      const place = await readGps();
      await saveAccountPlace(place);
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "No pudimos leer el GPS.");
    } finally {
      setGpsBusy(false);
    }
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setAuthError("");
    const place = savedPlace || (destination ? { lat: destination.lat, lng: destination.lng, label: destination.label, short: destination.query } : null);
    const response = await fetch(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authMode === "register"
        ? { name: form.get("name"), email: form.get("email"), phone: form.get("phone"), password: form.get("password"), lat: place?.lat, lng: place?.lng, label: place?.short }
        : { username: form.get("login"), password: form.get("password") }),
    });
    const data = await response.json();
    if (data.pending) {
      setAuthError("");
      setCanResend(false);
      setAuthNotice(data.message);
      return;
    }
    if (!response.ok) {
      setAuthNotice("");
      setCanResend(data.code === "unverified");
      setAuthError(data.error || "No se pudo ingresar.");
      return;
    }
    if (data.user.role && data.user.role !== "customer") {
      sessionStorage.setItem("ie_role", data.user.role);
      window.location.href = data.user.role === "admin" ? "/admin" : data.user.role === "kitchen" ? "/cocina" : data.user.role === "delivery" ? "/delivery" : data.user.role === "waiter" ? "/mozo" : "/";
      return;
    }
    sessionStorage.setItem("ie_role", "customer");
    const me = await fetch("/api/auth/me").then((item) => item.json());
    setAccount(me.user?.role === "customer" ? me.user : { name: data.user.name, locationLabel: place?.short || "" });
    setMenuOpen(false);
  }

  const categoryKey = categories.join("|");
  useEffect(() => {
    const names = categoryKey ? categoryKey.split("|") : [];
    if (!names.length) return;
    const onScroll = () => {
      let current = `cat-${slug(names[0])}`;
      for (const category of names) {
        const element = document.getElementById(`cat-${slug(category)}`);
        if (element && element.getBoundingClientRect().top < 170) current = element.id;
      }
      setActive((previous) => (previous === current ? previous : current));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [categoryKey]);

  const detail = products.find((product) => product.id === detailId) || null;
  const detailQuantity = detail ? cart[detail.id] || 0 : 0;
  const detailPhase = detail ? hold[detail.id] : undefined;
  const detailPrice = detail ? unitPrice(detail.price, detail.discountPercent) : 0;

  return (
    <>
      <header className="topbar">
        <button className="hamburger" type="button" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => { setMenuOpen(true); setCartOpen(false); setInfoOpen(false); }}>
          <span />
          <span />
          <span />
        </button>
        <Link className="brand" href="/" aria-label="Illimani Eats">
          <Logo />
        </Link>
        <form className="locate" ref={locateRef} onSubmit={locate}>
          <button className="locate-chip" type="button" aria-expanded={editingPlace} onClick={() => setEditingPlace((open) => !open)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 2.2v3.1M12 18.7v3.1M2.2 12h3.1M18.7 12h3.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>
              <small>Tu ubicación</small>
              <b>{destination ? destination.query : "Elegí tu calle"}</b>
            </span>
          </button>
          {editingPlace ? (
            <div className="locate-panel">
              <input
                value={placeQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setPlaceQuery(value);
                  setSuggesting(value.trim().length >= 3);
                  if (value.trim().length < 3) setSuggestions([]);
                }}
                placeholder="Calle y número"
                aria-label="Tu ubicación"
                role="combobox"
                aria-expanded={suggestions.length > 0}
                aria-autocomplete="list"
                autoFocus
              />
              {suggesting || suggestions.length > 0 || placeQuery.trim().length >= 3 ? (
                <ul className="locate-list" role="listbox">
                  {suggestions.map((place, index) => (
                    <li key={`${place.short}-${place.lat}-${place.lng}-${index}`}>
                      <button type="button" role="option" onClick={() => applyPlace(place)}>{place.short}</button>
                    </li>
                  ))}
                  {suggesting ? <li className="muted">Buscando calles...</li> : null}
                  {!suggesting && suggestions.length === 0 ? <li className="muted">No hay calles con ese nombre en Mendoza.</li> : null}
                </ul>
              ) : (
                <p className="muted">Escribí al menos 3 letras.</p>
              )}
              {placeError ? <p className="hero-error">{placeError}</p> : null}
            </div>
          ) : null}
        </form>
        <div className="header-actions">
          {account ? (
            <button className="account-link" type="button" aria-label={`Sesión iniciada, ${account.name}`} title={account.name} onClick={() => { setMenuOpen(true); setCartOpen(false); setInfoOpen(false); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3.2" fill="currentColor" />
                <path d="M5.5 19.2c1.2-3 3.4-4.4 6.5-4.4s5.3 1.4 6.5 4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
          <button className="cart-link" type="button" aria-label={`Carrito, ${ready ? count : 0} ${count === 1 ? "producto" : "productos"}`} onClick={() => { setCartOpen(true); setMenuOpen(false); setInfoOpen(false); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 7h12l-1 12H7L6 7Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 7a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <span>{ready ? count : 0}</span>
          </button>
        </div>
      </header>
      {viewerRole === "admin" ? <PreviewEye back /> : null}

      <main className="shell">
        <section className="store-intro">
          <div className="identity">
            <h1>{restaurant.name}</h1>
            <p>{restaurant.tagline}</p>
            <p>{restaurant.country} · {restaurant.cuisine}</p>
            <p className="store-address">{fullAddress}</p>
            <p><b>{closeLabel}</b></p>
            <p>{restaurant.hours}</p>
            {restaurant.phone ? <p>{restaurant.phone}</p> : null}
            <p>Entrega {restaurant.etaDelivery} · Retiro {restaurant.etaPickup}</p>
            <div className="mode-switch" role="group" aria-label="Tipo de pedido">
              <button className={mode === "delivery" ? "active" : ""} onClick={() => changeMode("delivery")} type="button">Entrega</button>
              <button className={mode === "pickup" ? "active" : ""} onClick={() => changeMode("pickup")} type="button">Retiro</button>
            </div>
            <button className="btn ghost" type="button" onClick={() => { setInfoOpen(true); setMenuOpen(false); setCartOpen(false); }}>Información del negocio</button>
          </div>
          <div className="hero">
            {restaurant.banner ? (
              <img
                className="hero-photo"
                {...bannerSources(restaurant.banner)}
                alt=""
                width={1200}
                height={800}
                fetchPriority="high"
                decoding="async"
              />
            ) : null}
          </div>
        </section>
        {destination ? (
          <div className="hero-route">
            {routeOpen ? (
              <MiniMap
                ratio={0.32}
                maxHeight={200}
                minHeight={140}
                road
                path={road}
                points={[
                  { lat: restaurant.latitude, lng: restaurant.longitude, color: "#9b2335" },
                  { lat: destination.lat, lng: destination.lng, color: "#1c7a49" },
                ]}
              />
            ) : (
              <button className="btn ghost" type="button" onClick={() => setRouteOpen(true)}>Ver mapa de la ruta</button>
            )}
            <p>
              <b>{formatKm(km)}</b> entre el local y tu dirección · envío <b>{fee === 0 ? "gratis" : money(fee)}</b>{fee === 0 ? "" : " aprox"}
            </p>
            <small>{destination.label}</small>
          </div>
        ) : null}

        {lastOrder ? (
          <p className="banner">
            Tenés un pedido en curso. <Link href={`/pedido/${lastOrder}`}><b>Ver estado</b></Link>
          </p>
        ) : null}

        <label>
          Buscar en el menú
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Empanadas, pizza, postre..." />
        </label>

        {offers.length > 0 && !query ? (
          <section>
            <h2>Ofertas</h2>
            <div className="offers">
              {offers.map((product) => (
                <button
                  key={product.id}
                  className="offer"
                  type="button"
                  onClick={() => document.getElementById(`item-${product.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                >
                  <FoodPhoto src={product.image} alt="" sizes="74px" width={74} height={74} />
                  <span>
                    <span>-{product.discountPercent}%</span>
                    <b>{product.name}</b>
                    {money(unitPrice(product.price, product.discountPercent))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <nav className="catbar" aria-label="Categorías">
          {categories.map((category) => {
            const id = `cat-${slug(category)}`;
            return (
              <button
                key={category}
                className={active === id ? "active" : ""}
                type="button"
                onClick={() => {
                  setActive(id);
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {category}
              </button>
            );
          })}
        </nav>

        <div className="layout">
          <div className="menu-card">
            {categories.length === 0 ? <p className="muted">No hay productos con esa búsqueda.</p> : null}
            {categories.map((category) => (
              <section key={category} id={`cat-${slug(category)}`} className="section">
                <h2>{category}</h2>
                {visible.filter((product) => product.category === category).map((product) => {
                  const price = unitPrice(product.price, product.discountPercent);
                  const quantity = cart[product.id] || 0;
                  const trial = product.name === trialProductName;
                  const phase = hold[product.id];
                  return (
                    <article
                      key={product.id}
                      id={`item-${product.id}`}
                      className={trial ? "item trial" : "item"}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest(".add, .stepper")) return;
                        setDetailId(product.id);
                      }}
                    >
                      <div>
                        <h3>
                          {product.name}
                          {product.discountPercent > 0 ? <span className="badge">-{product.discountPercent}%</span> : null}
                        </h3>
                        <p>{product.description}</p>
                        <div className="price">
                          <strong>{money(price)}</strong>
                          {product.discountPercent > 0 ? <s>{money(product.price)}</s> : null}
                        </div>
                      </div>
                      <div className="item-media">
                        <FoodPhoto src={product.image} alt={product.name} sizes="(max-width: 640px) 96px, 128px" width={128} height={128} />
                        {product.soldOut ? <span className="soldout">Agotado</span> : phase === "count" && quantity > 0 ? (
                          <div className="stepper">
                            <button type="button" onClick={() => removeAndHold(product.id)} aria-label={`Quitar ${product.name}`}>–</button>
                            <span>{quantity}</span>
                            <button type="button" onClick={() => addAndHold(product)} disabled={cannotAdd(product, quantity)} aria-label={`Sumar ${product.name}`}>+</button>
                          </div>
                        ) : phase === "ok" ? (
                          <AddedMark />
                        ) : (
                          <button className="add" type="button" onClick={() => addAndHold(product)} aria-label={`Agregar ${product.name}`}>+</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </div>

          <Cart
            open={cartOpen}
            lines={lines}
            mode={mode}
            discount={discount}
            fee={fee}
            feeKnown={feeKnown}
            total={merchandise + fee}
            freeFrom={restaurant.freeDeliveryFrom}
            onAdd={add}
            onRemove={remove}
            onClose={() => setCartOpen(false)}
          />
        </div>
        <footer className="site-footer">
          <span>{restaurant.name} · {fullAddress}</span>
        </footer>
      </main>

      {count > 0 ? (
        <button className="bottom-bar" type="button" onClick={() => setCartOpen(true)}>
          <span>Ver pedido · {count}</span>
          <span>{money(merchandise + fee)}</span>
        </button>
      ) : null}
      {cartOpen || menuOpen || infoOpen ? <button className="backdrop" type="button" aria-label="Cerrar panel" onClick={() => { setCartOpen(false); setMenuOpen(false); setInfoOpen(false); }} /> : null}
      {detail ? (
        <div className="product-layer">
          <button className="backdrop" type="button" aria-label="Cerrar producto" onClick={() => setDetailId(null)} />
          <article className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
            <button ref={detailClose} className="dialog-close" type="button" onClick={() => setDetailId(null)} aria-label="Cerrar">×</button>
            <FoodPhoto src={detail.image} alt={detail.name} sizes="(max-width: 640px) 92vw, 420px" width={420} height={240} />
            <div className="sheet">
              <p className="eyebrow">{detail.category}</p>
              <h2 id="product-dialog-title">
                {detail.name}
                {detail.discountPercent > 0 ? <span className="badge">-{detail.discountPercent}%</span> : null}
              </h2>
              <p>{detail.description}</p>
              <div className="sheet-add">
                <div className="price">
                  <strong>{money(detailPrice)}</strong>
                  {detail.discountPercent > 0 ? <s>{money(detail.price)}</s> : null}
                </div>
                {detail.soldOut ? <span className="soldout static">Agotado</span> : detailPhase === "count" && detailQuantity > 0 ? (
                  <div className="stepper">
                    <button type="button" onClick={() => removeAndHold(detail.id)} aria-label={`Quitar ${detail.name}`}>–</button>
                    <span>{detailQuantity}</span>
                    <button type="button" onClick={() => addAndHold(detail)} disabled={cannotAdd(detail, detailQuantity)} aria-label={`Sumar ${detail.name}`}>+</button>
                  </div>
                ) : detailPhase === "ok" ? (
                  <AddedMark />
                ) : (
                  <button className="add" type="button" onClick={() => addAndHold(detail)} aria-label={`Agregar ${detail.name}`}>+</button>
                )}
              </div>
            </div>
          </article>
        </div>
      ) : null}
      <aside className={menuOpen ? "drawer open" : "drawer"} aria-hidden={!menuOpen}>
        <div className="cart-line">
          <h2>Tu cuenta</h2>
          <button className="text-btn" type="button" onClick={() => setMenuOpen(false)}>Cerrar</button>
        </div>
        {account ? (
          <div className="account-panel">
            <div className="account-who">
              <p>Hola, <b>{account.name}</b></p>
              <p className="muted">{account.locationLabel || "Todavía no guardaste tu ubicación."}</p>
            </div>
            {authError ? <p className="error">{authError}</p> : null}
            {profileNote ? <p className="banner">{profileNote}</p> : null}
            <div className="account-actions">
              {locationOpen ? (
                <form className="form account-location" onSubmit={saveTypedLocation}>
                  <label>
                    Calle y número
                    <input
                      value={locationQuery}
                      onChange={(event) => {
                        const value = event.target.value;
                        setLocationQuery(value);
                        setLocationSearching(value.trim().length >= 3);
                        if (value.trim().length < 3) setLocationHits([]);
                      }}
                      placeholder="San Martín 450"
                      aria-label="Calle y número"
                      autoComplete="street-address"
                      autoFocus
                    />
                  </label>
                  {locationQuery.trim().length >= 3 ? (
                    <ul className="locate-list" role="listbox">
                      {locationHits.map((place, index) => (
                        <li key={`${place.short}-${place.lat}-${place.lng}-${index}`}>
                          <button type="button" role="option" onClick={() => saveAccountPlace(place)}>{place.short}</button>
                        </li>
                      ))}
                      {locationSearching ? <li className="muted">Buscando calles...</li> : null}
                      {!locationSearching && locationHits.length === 0 ? <li className="muted">No hay calles con ese nombre en Mendoza.</li> : null}
                    </ul>
                  ) : null}
                  <button className="btn" type="submit" disabled={locationBusy || gpsBusy}>{locationBusy ? "Guardando..." : "Guardar dirección"}</button>
                  <button className="btn ghost" type="button" disabled={gpsBusy || locationBusy} onClick={captureGps}>{gpsBusy ? "Buscando GPS..." : "Detectar automáticamente"}</button>
                  <button className="btn ghost" type="button" onClick={() => { setLocationOpen(false); setAuthError(""); }}>Volver</button>
                </form>
              ) : (
                <button className="btn ghost" type="button" onClick={() => { const current = account.locationLabel || ""; setLocationOpen(true); setSettingsOpen(false); setLocationQuery(current); setLocationHits([]); setLocationSearching(current.trim().length >= 3); setAuthError(""); setProfileNote(""); }}>Guardar mi ubicación</button>
              )}
              <Link className="btn ghost" href="/cuenta">Mis pedidos</Link>
              {settingsOpen ? (
                <form className="form" onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  setAuthError("");
                  setProfileNote("");
                  const response = await fetch("/api/account", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: form.get("name"), phone: form.get("phone"), email: form.get("email") }),
                  });
                  const data = await response.json();
                  if (!response.ok) {
                    setAuthError(data.error || "No se pudo guardar.");
                    return;
                  }
                  setAccount({ ...account, name: data.profile.name, phone: data.profile.phone, email: data.profile.email });
                  setProfileNote("Datos guardados.");
                  setSettingsOpen(false);
                }}>
                  <label>Nombre<input name="name" defaultValue={account.name} required /></label>
                  <label>Teléfono<input name="phone" defaultValue={account.phone || ""} required /></label>
                  <label>Email<input name="email" type="email" defaultValue={account.email || ""} required /></label>
                  <button className="btn" type="submit">Guardar datos</button>
                  <button className="btn ghost" type="button" onClick={() => setSettingsOpen(false)}>Volver</button>
                </form>
              ) : (
                <button className="btn ghost" type="button" onClick={() => { setSettingsOpen(true); setLocationOpen(false); setProfileNote(""); setAuthError(""); }}>Configuración</button>
              )}
              <button className="btn danger" type="button" onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST", headers: { "x-ie-role": "customer" } });
                sessionStorage.removeItem("ie_role");
                setAccount(null);
              }}>Cerrar sesión</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mode-switch">
              <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => setAuthMode("login")}>Iniciar sesión</button>
              <button className={authMode === "register" ? "active" : ""} type="button" onClick={() => setAuthMode("register")}>Registrarse</button>
            </div>
            <form className="form" onSubmit={submitAccount}>
              {authMode === "register" ? <label>Nombre<input name="name" required /></label> : null}
              {authMode === "login" ? (
                <label>Email o usuario<input name="login" autoComplete="username" required /></label>
              ) : (
                <label>Email<input name="email" type="email" required /></label>
              )}
              {authMode === "register" ? <label>Teléfono<input name="phone" required /></label> : null}
              <label>Clave<input name="password" type="password" required minLength={authMode === "register" ? 6 : 1} /></label>
              {authMode === "login" ? <p className="muted">Clientes entran con su email. Cocina, delivery, mozo y administración, con su usuario.</p> : null}
              {authMode === "register" ? <p className="muted">Te enviamos un correo para confirmar la cuenta antes de poder entrar.</p> : null}
              {authMode === "register" ? (
                <button className="btn ghost" type="button" disabled={gpsBusy} onClick={captureGps}>{gpsBusy ? "Buscando GPS..." : "Usar mi GPS"}</button>
              ) : null}
              {savedPlace && authMode === "register" ? <p className="muted">Ubicación: {savedPlace.short}</p> : null}
              {authNotice ? <p className="banner">{authNotice}</p> : null}
              {authError ? <p className="error">{authError}</p> : null}
              {canResend ? (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={async (event) => {
                    const email = (event.currentTarget.form?.querySelector("[name=login], [name=email]") as HTMLInputElement | null)?.value || "";
                    setAuthError("");
                    const response = await fetch("/api/auth/resend", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email }),
                    });
                    const data = await response.json();
                    if (!response.ok) setAuthError(data.error || "No pudimos reenviar el correo.");
                    else setAuthNotice(data.message);
                  }}
                >
                  Reenviar correo
                </button>
              ) : null}
              <button className="btn" type="submit">{authMode === "register" ? "Crear cuenta" : "Entrar"}</button>
            </form>
          </>
        )}
      </aside>
      {infoOpen ? (
        <aside className="info-panel">
          <div className="cart-line">
            <h2>Información del negocio</h2>
            <button className="text-btn" type="button" onClick={() => setInfoOpen(false)}>Cerrar</button>
          </div>
          <MiniMap points={[{ lat: restaurant.latitude, lng: restaurant.longitude, color: "#9b2335" }]} />
          <p className="map-note">Mapa © OpenStreetMap</p>
          <h3>{restaurant.name}</h3>
          <p>{fullAddress}</p>
          <p><b>{closeLabel}</b></p>
          <p className="muted">{restaurant.hours}</p>
        </aside>
      ) : null}
    </>
  );
}

function Cart({
  open,
  lines,
  mode,
  discount,
  fee,
  feeKnown,
  total,
  freeFrom,
  onAdd,
  onRemove,
  onClose,
}: {
  open: boolean;
  lines: { product: Product; quantity: number }[];
  mode: DiningMode;
  discount: number;
  fee: number;
  feeKnown: boolean;
  total: number;
  freeFrom: number;
  onAdd: (product: Product) => void;
  onRemove: (productId: string) => void;
  onClose: () => void;
}) {
  return (
    <aside className={open ? "cart open" : "cart"}>
      <div className="cart-line">
        <h2>Tu pedido</h2>
        <button className="text-btn" type="button" onClick={onClose}>Cerrar</button>
      </div>
      {lines.length === 0 ? <p className="muted">Todavía no agregaste nada. Elegí algo del menú.</p> : null}
      {lines.map(({ product, quantity }) => (
        <div key={product.id} className="cart-line">
          <div>
            <strong>{quantity} × {product.name}</strong>
            <p>{money(unitPrice(product.price, product.discountPercent) * quantity)}</p>
          </div>
          <div className="stepper" style={{ position: "static" }}>
            <button type="button" onClick={() => onRemove(product.id)} aria-label="Quitar">–</button>
            <span>{quantity}</span>
            <button type="button" onClick={() => onAdd(product)} disabled={cannotAdd(product, quantity)} aria-label="Sumar">+</button>
          </div>
        </div>
      ))}
      {lines.length > 0 ? (
        <>
          <div className="totals">
            {discount > 0 ? <div className="total-row"><span>Ahorrás</span><b>{money(discount)}</b></div> : null}
            <div className="total-row"><span>{mode === "delivery" ? "Envío" : "Retiro en el local"}</span><b>{!feeKnown ? "A calcular" : fee === 0 ? "Gratis" : money(fee)}</b></div>
            <div className="total-row grand"><span>Total</span><b>{money(feeKnown ? total : total - fee)}</b></div>
          </div>
          {mode === "delivery" && !feeKnown ? <p className="help">Cargá tu dirección arriba para calcular el envío.</p> : null}
          {mode === "delivery" && freeFrom > 0 && fee > 0 ? <p className="help">Envío gratis desde {money(freeFrom)}.</p> : null}
          <Link className="btn wide" href="/checkout">Ir a pagar</Link>
        </>
      ) : null}
    </aside>
  );
}
