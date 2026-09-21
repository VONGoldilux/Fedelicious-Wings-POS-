// Shared domain types, mirroring the Supabase schema in supabase/schema.sql.

export type UserRole = "super_admin" | "cashier" | "kitchen";

export type OrderStatus =
  | "queued"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type PaymentMethod = "cash" | "gcash" | "card" | "other";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  special_instructions: string | null;
}

export interface Order {
  id: string;
  order_number: number;
  status: OrderStatus;
  subtotal: number;
  total: number;
  payment_method: PaymentMethod | null;
  amount_tendered: number | null;
  change_due: number | null;
  notes: string | null;
  cashier_id: string | null;
  created_at: string;
  ready_at: string | null;
  completed_at: string | null;
  order_items?: OrderItem[];
}

// ---------- Promotions ----------

export type PromoType =
  | "discount_percentage"
  | "discount_flat"
  | "free_item"
  | "bundle";

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

// Snapshot shape stored inside promotions.required_items / reward_items.
export interface PromoItemRef {
  product_id: string;
  product_name: string;
  quantity: number;
}

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  start_date: string; // date, "YYYY-MM-DD"
  end_date: string; // date, "YYYY-MM-DD"
  valid_days: Weekday[] | null; // null/empty = every day
  promo_type: PromoType;
  discount_value: number | null;
  bundle_price: number | null;
  required_items: PromoItemRef[];
  reward_items: PromoItemRef[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  hours_worked: number | null;
}

// Cart line used only on the client while building an order in the POS.
export interface CartLine {
  product: Product;
  quantity: number;
  special_instructions?: string;
}
