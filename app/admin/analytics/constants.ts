// Pure types, constants, and helpers shared across the analytics page and
// its section components. Split out from page.tsx so components can import
// them without a circular dependency on the page module itself.

export interface CategoryItemStat {
  productId: string;
  name: string;
  category: string;
  qty: number;
  revenue: number;
}

export type Granularity = "day" | "week" | "month" | "year";

export const RANGE_OPTIONS = [
  { label: "Today", value: 1 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

export const GRANULARITY_OPTIONS: { label: string; value: Granularity }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

// How far back to fetch for each trend granularity, and how many buckets
// that spans — e.g. "Day" plots the last 14 individual days, "Year" plots
// the last 5 calendar years.
export const GRANULARITY_WINDOW: Record<Granularity, { lookbackDays: number; buckets: number }> = {
  day: { lookbackDays: 14, buckets: 14 },
  week: { lookbackDays: 84, buckets: 12 },
  month: { lookbackDays: 365, buckets: 12 },
  year: { lookbackDays: 365 * 5, buckets: 5 },
};

export const TREND_COLORS = ["#F0662B", "#D49B22", "#463830", "#FF8A4C", "#2F6F5E"];

export const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};
export const ORDER_TYPES = ["dine_in", "takeout", "delivery"] as const;
export const PAYMENT_METHODS = ["cash", "gcash"] as const;

export const ORDER_TYPE_COLORS: Record<string, string> = {
  dine_in: "#F0662B",
  takeout: "#D49B22",
  delivery: "#463830",
};
export const PAYMENT_COLORS: Record<string, string> = {
  cash: "#F0662B",
  gcash: "#D49B22",
};

export function bucketKeyFor(date: Date, granularity: Granularity): string {
  if (granularity === "day") {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (granularity === "week") {
    // Key = Monday of that week, so same-week dates share a bucket.
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  }
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return String(date.getFullYear());
}

export function bucketLabelFor(key: string, granularity: Granularity): string {
  if (granularity === "day" || granularity === "week") {
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  }
  if (granularity === "month") {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-PH", { month: "short", year: "2-digit" });
  }
  return key;
}
