export type Role = "admin" | "kitchen" | "delivery" | "waiter" | "customer";

export type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  discountPercent: number;
  stock: number;
  image: string;
  available: boolean;
  soldOut?: boolean;
};

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  basePrice: number;
  discountPercent: number;
  unitPrice: number;
  limitedStock?: boolean;
};

export type OrderStatus =
  | "pending_payment"
  | "received"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash" | "mercadopago";
export type PaymentStatus = "unpaid" | "pending" | "approved" | "rejected";
export type DiningMode = "delivery" | "pickup";

export type OrderMessage = {
  id: string;
  authorId: string;
  authorName: string;
  role: Role;
  text: string;
  createdAt: string;
};

export type OrderEvent = {
  id: string;
  at: string;
  kind: string;
  text: string;
  userId?: string;
  userName: string;
  role: Role;
};

export type Order = {
  id: string;
  code: string;
  customerId?: string;
  customerName: string;
  phone: string;
  email: string;
  mode: DiningMode;
  address: string;
  notes: string;
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  distanceKm?: number;
  destinationLat?: number;
  destinationLng?: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  mpPreferenceId?: string;
  mpInitPoint?: string;
  mpPaymentId?: string;
  status: OrderStatus;
  courierId?: string;
  courierName?: string;
  courierLat?: number;
  courierLng?: number;
  courierAt?: string;
  kitchenId?: string;
  kitchenName?: string;
  acceptedAt?: string;
  readyAt?: string;
  takenAt?: string;
  collectedAt?: string;
  deliveredAt?: string;
  deliveryPin?: string;
  messages?: OrderMessage[];
  events?: OrderEvent[];
  createdAt: string;
  updatedAt: string;
};

export type StaffUser = {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  passwordSeal?: string;
  role: Role;
};

export type PublicUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
  password?: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  emailVerified?: boolean;
  verifyTokenHash?: string;
  verifyExpires?: number;
  createdAt?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
};

export type Restaurant = {
  name: string;
  tagline: string;
  address: string;
  city: string;
  country: string;
  cuisine: string;
  hours: string;
  phone: string;
  deliveryFee: number;
  freeDeliveryFrom: number;
  pricePerKm: number;
  latitude: number;
  longitude: number;
  etaDelivery: string;
  etaPickup: string;
  banner?: string;
};

export type DB = {
  restaurant: Restaurant;
  products: Product[];
  orders: Order[];
  users: StaffUser[];
  customers: Customer[];
  orderSeq: number;
};

export type Session = {
  sub: string;
  name: string;
  role: Role;
  exp: number;
};
