import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { hashPassword, sealPassword } from "./auth";
import { trialProductName } from "./format";
import type { DB, Product } from "./types";

const dbPath = path.join(process.cwd(), "data", "db.json");

let chain: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const STORAGE = "https://jcxqseckfblsobetktqj.supabase.co/storage/v1/object/public/product-images";

function photo(id: string) {
  const source = `https://images.unsplash.com/${id}?fm=webp&fit=crop&w=480&q=60`;
  const name = createHash("sha256").update(source).digest("hex").slice(0, 16);
  return `${STORAGE}/menu/${name}-720.webp`;
}

function product(input: Omit<Product, "id" | "available"> & { available?: boolean }): Product {
  return {
    ...input,
    id: randomUUID(),
    available: input.available ?? true,
  };
}

function seed(): DB {
  return {
    restaurant: {
      name: "Illimani Eats",
      tagline: "Empanadas, pizzas y platos de la casa, directo a tu puerta.",
      address: "General Paz 59",
      city: "Ciudad de Mendoza",
      country: "Argentina",
      cuisine: "Comida típica",
      hours: "Todos los días de 11:00 a 23:30",
      phone: "",
      deliveryFee: 2000,
      freeDeliveryFrom: 25000,
      pricePerKm: 450,
      latitude: -32.8850058,
      longitude: -68.838729,
      etaDelivery: "30–45 min",
      etaPickup: "15–25 min",
      banner: `${STORAGE}/site/hero-1200.webp`,
    },
    orderSeq: 1040,
    users: [
      {
        id: randomUUID(),
        name: "Administración",
        username: "admin",
        passwordHash: hashPassword("admin123"),
        passwordSeal: sealPassword("admin123"),
        role: "admin",
      },
      {
        id: randomUUID(),
        name: "Olga",
        username: "cocina",
        passwordHash: hashPassword("illimani-cocina"),
        passwordSeal: sealPassword("illimani-cocina"),
        role: "kitchen",
      },
      {
        id: randomUUID(),
        name: "Juan",
        username: "delivery",
        passwordHash: hashPassword("illimani-delivery"),
        passwordSeal: sealPassword("illimani-delivery"),
        role: "delivery",
      },
    ],
    orders: [],
    customers: [],
    products: [
      product({
        name: trialProductName,
        description: "Producto para probar un pedido completo. Abrilo para ver el detalle y sumalo con el +.",
        category: "Prueba",
        price: 100,
        discountPercent: 0,
        stock: 99,
        image: "/food-fallback.svg",
      }),
      product({
        name: "Docena de empanadas mixtas",
        description: "Doce empanadas de carne, jamón y queso y árabe. Sale caliente del horno.",
        category: "Promos",
        price: 19800,
        discountPercent: 15,
        stock: 20,
        image: photo("photo-1626700051175-6818013e1d4f"),
      }),
      product({
        name: "Combo pizza y empanadas",
        description: "Pizza muzzarella grande y dos empanadas de carne.",
        category: "Promos",
        price: 15600,
        discountPercent: 10,
        stock: 15,
        image: photo("photo-1513104890138-7c749659a591"),
      }),
      product({
        name: "Empanada de carne",
        description: "Carne cortada a cuchillo, cebolla, comino y huevo. Receta de Mendoza.",
        category: "Empanadas",
        price: 1800,
        discountPercent: 0,
        stock: 80,
        image: photo("photo-1601050690597-df0568f70950"),
      }),
      product({
        name: "Empanada de jamón y queso",
        description: "Jamón cocido y muzzarella, bien dorada.",
        category: "Empanadas",
        price: 1800,
        discountPercent: 0,
        stock: 80,
        image: photo("photo-1626700051175-6818013e1d4f"),
      }),
      product({
        name: "Empanada árabe",
        description: "Carne, limón, tomate y cebolla. Masa finita.",
        category: "Empanadas",
        price: 1900,
        discountPercent: 0,
        stock: 40,
        image: photo("photo-1601050690597-df0568f70950"),
      }),
      product({
        name: "Empanada de humita",
        description: "Choclo cremoso, albahaca y queso.",
        category: "Empanadas",
        price: 1900,
        discountPercent: 0,
        stock: 30,
        image: photo("photo-1626700051175-6818013e1d4f"),
      }),
      product({
        name: "Pizza muzzarella",
        description: "Salsa de tomate, mucha muzzarella y orégano. Ocho porciones.",
        category: "Pizzas",
        price: 12000,
        discountPercent: 0,
        stock: 25,
        image: photo("photo-1513104890138-7c749659a591"),
      }),
      product({
        name: "Pizza napolitana",
        description: "Muzzarella, tomate en rodajas y ajo.",
        category: "Pizzas",
        price: 13500,
        discountPercent: 0,
        stock: 18,
        image: photo("photo-1574071318508-1cdbab80d002"),
      }),
      product({
        name: "Pizza especial",
        description: "Jamón, morrón, huevo y aceitunas.",
        category: "Pizzas",
        price: 15000,
        discountPercent: 20,
        stock: 12,
        image: photo("photo-1565299624946-b28f40a0ae38"),
      }),
      product({
        name: "Fugazza con queso",
        description: "Cebolla en cantidad y muzzarella.",
        category: "Pizzas",
        price: 12500,
        discountPercent: 0,
        stock: 14,
        image: photo("photo-1593560708920-61dd98c46a4e"),
      }),
      product({
        name: "Milanesa napolitana con papas",
        description: "Milanesa de ternera, jamón, muzzarella y papas fritas.",
        category: "Platos",
        price: 14500,
        discountPercent: 0,
        stock: 16,
        image: photo("photo-1632778149955-e80f8ceca2e8"),
      }),
      product({
        name: "Hamburguesa Illimani",
        description: "Medallón de carne, cheddar, panceta, lechuga y papas.",
        category: "Platos",
        price: 11200,
        discountPercent: 0,
        stock: 20,
        image: photo("photo-1568901346375-23c9450c58cd"),
      }),
      product({
        name: "Papas fritas",
        description: "Porción grande, crocantes, con sal de parrilla.",
        category: "Acompañamientos",
        price: 5500,
        discountPercent: 0,
        stock: 40,
        image: photo("photo-1573080496219-bb080dd4f877"),
      }),
      product({
        name: "Ensalada de la casa",
        description: "Lechuga, tomate, zanahoria y huevo.",
        category: "Acompañamientos",
        price: 6200,
        discountPercent: 0,
        stock: 18,
        image: photo("photo-1512621776951-a57141f2eefd"),
      }),
      product({
        name: "Gaseosa 500 ml",
        description: "Bien fría. Consultá el sabor al retirar.",
        category: "Bebidas",
        price: 2500,
        discountPercent: 0,
        stock: 50,
        image: photo("photo-1629203851122-3726ecdf080e"),
      }),
      product({
        name: "Agua mineral",
        description: "Botella de 500 ml.",
        category: "Bebidas",
        price: 1800,
        discountPercent: 0,
        stock: 50,
        image: photo("photo-1548839140-29a749e1cf4d"),
      }),
      product({
        name: "Cerveza rubia 473 ml",
        description: "Lata bien fría.",
        category: "Bebidas",
        price: 3500,
        discountPercent: 0,
        stock: 36,
        image: photo("photo-1608270586620-248524c67de9"),
      }),
      product({
        name: "Flan casero con dulce",
        description: "Flan de vainilla con dulce de leche.",
        category: "Postres",
        price: 4500,
        discountPercent: 0,
        stock: 12,
        image: photo("photo-1488477181946-6428a0291777"),
      }),
      product({
        name: "Helado dos bochas",
        description: "Dulce de leche, chocolate o crema americana.",
        category: "Postres",
        price: 5000,
        discountPercent: 0,
        stock: 20,
        image: photo("photo-1497034825429-c343d7c6a68f"),
      }),
    ],
  };
}

async function writeDb(db: DB) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const tmp = `${dbPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, dbPath);
}

async function load(): Promise<DB> {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    return hydrate(JSON.parse(raw) as DB);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    const db = hydrate(seed());
    await writeDb(db);
    return db;
  }
}

function hydrate(db: DB): DB {
  const current = db.restaurant;
  db.customers = db.customers || [];
  db.orders = db.orders || [];
  db.products = db.products || [];
  db.users = db.users || [];
  db.restaurant = {
    name: current?.name || "Illimani Eats",
    tagline: current?.tagline || "Empanadas, pizzas y platos de la casa, directo a tu puerta.",
    address: current?.address || "General Paz 59",
    city: current?.city || "Ciudad de Mendoza",
    country: current?.country || "Argentina",
    cuisine: current?.cuisine || "Comida típica",
    hours: current?.hours || "Todos los días de 11:00 a 23:30",
    phone: current?.phone || "",
    deliveryFee: current?.deliveryFee ?? 2000,
    freeDeliveryFrom: current?.freeDeliveryFrom ?? 25000,
    pricePerKm: current?.pricePerKm ?? 450,
    latitude: current?.latitude ?? -32.8850058,
    longitude: current?.longitude ?? -68.838729,
    etaDelivery: current?.etaDelivery || "30–45 min",
    etaPickup: current?.etaPickup || "15–25 min",
    banner: current?.banner || "",
  };
  return db;
}

export function readDb() {
  return enqueue(load);
}

export function updateDb<T>(mutator: (db: DB) => T | Promise<T>) {
  return enqueue(async () => {
    const db = await load();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  });
}
