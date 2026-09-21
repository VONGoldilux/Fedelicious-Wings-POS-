"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import type { Product } from "@/lib/types";

// ---------------------------------------------------------------------------
// Local shapes. These are computed/aggregated views for this page only —
// they don't mirror a DB table, so (matching this app's convention, see
// admin/dashboard/page.tsx) they stay local instead of living in lib/types.
// ---------------------------------------------------------------------------
interface CategoryItemStat {
  productId: string;
  name: string;
  category: string;
  qty: number;
  revenue: number;
}

type Granularity = "day" | "week" | "month" | "year";

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const GRANULARITY_OPTIONS: { label: string; value: Granularity }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
  { label: "Year", value: "year" },
];

// How far back to fetch for each trend granularity, and how many buckets
// that spans — e.g. "Day" plots the last 14 individual days, "Year" plots
// the last 5 calendar years.
const GRANULARITY_WINDOW: Record<Granularity, { lookbackDays: number; buckets: number }> = {
  day: { lookbackDays: 14, buckets: 14 },
  week: { lookbackDays: 84, buckets: 12 },
  month: { lookbackDays: 365, buckets: 12 },
  year: { lookbackDays: 365 * 5, buckets: 5 },
};

const TREND_COLORS = ["#F0662B", "#D49B22", "#463830", "#FF8A4C", "#2F6F5E"];

function bucketKeyFor(date: Date, granularity: Granularity): string {
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

function bucketLabelFor(key: string, granularity: Granularity): string {
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

export default function AnalyticsPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [rangeDays, setRangeDays] = useState(30);
  const [granularity, setGranularity] = useState<Granularity>("day");

  const [categoryStats, setCategoryStats] = useState<CategoryItemStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const [trendRows, setTrendRows] = useState<
    { product_id: string; product_name: string; quantity: number; created_at: string }[]
  >([]);
  const [loadingTrend, setLoadingTrend] = useState(true);

  // ---- Load the product catalog once (id -> name/category lookup) --------
  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .then(({ data }) => setProducts(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Top/Bottom sellers per category, for the selected range -----------
  useEffect(() => {
    async function load() {
      setLoadingStats(true);
      const since = new Date();
      since.setDate(since.getDate() - rangeDays);
      since.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("order_items")
        .select("product_id, product_name, quantity, line_total, orders!inner(created_at,status)")
        .neq("orders.status", "cancelled")
        .gte("orders.created_at", since.toISOString());

      const salesByProduct = new Map<string, { qty: number; revenue: number }>();
      for (const row of data ?? []) {
        if (!row.product_id) continue;
        const existing = salesByProduct.get(row.product_id) ?? { qty: 0, revenue: 0 };
        existing.qty += row.quantity;
        existing.revenue += Number(row.line_total);
        salesByProduct.set(row.product_id, existing);
      }

      // Include every product (even zero-sold ones) so "bottom sellers"
      // actually surfaces items nobody's buying, not just the least-bad.
      const stats: CategoryItemStat[] = products.map((p) => {
        const sold = salesByProduct.get(p.id);
        return {
          productId: p.id,
          name: p.name,
          category: p.category,
          qty: sold?.qty ?? 0,
          revenue: sold?.revenue ?? 0,
        };
      });

      setCategoryStats(stats);
      setLoadingStats(false);
    }
    if (products.length > 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, products]);

  // ---- Trend data for the selected granularity ----------------------------
  useEffect(() => {
    async function load() {
      setLoadingTrend(true);
      const { lookbackDays } = GRANULARITY_WINDOW[granularity];
      const since = new Date();
      since.setDate(since.getDate() - lookbackDays);
      since.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("order_items")
        .select("product_id, product_name, quantity, orders!inner(created_at,status)")
        .neq("orders.status", "cancelled")
        .gte("orders.created_at", since.toISOString());

      setTrendRows(
        (data ?? [])
          .filter((r) => r.product_id)
          .map((r) => ({
            product_id: r.product_id as string,
            product_name: r.product_name,
            quantity: r.quantity,
            // order_items has no created_at of its own — use the parent order's.
            created_at: (r as unknown as { orders: { created_at: string } }).orders.created_at,
          }))
      );
      setLoadingTrend(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  // ---- Group top/bottom-5 by category -------------------------------------
  const byCategory = useMemo(() => {
    const map = new Map<string, CategoryItemStat[]>();
    for (const s of categoryStats) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      top: [...items].sort((a, b) => b.qty - a.qty).slice(0, 5),
      bottom: [...items].sort((a, b) => a.qty - b.qty).slice(0, 5),
    }));
  }, [categoryStats]);

  // ---- Trending chart: top 5 items overall in this window, bucketed ------
  const { chartData, topProductNames } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of trendRows) {
      totals.set(r.product_name, (totals.get(r.product_name) ?? 0) + r.quantity);
    }
    const top = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    const topSet = new Set(top);

    const buckets = new Map<string, Record<string, number | string>>();
    for (const r of trendRows) {
      if (!topSet.has(r.product_name)) continue;
      const key = bucketKeyFor(new Date(r.created_at), granularity);
      const row = buckets.get(key) ?? { bucket: bucketLabelFor(key, granularity), __key: key };
      row[r.product_name] = (Number(row[r.product_name]) || 0) + r.quantity;
      buckets.set(key, row);
    }

    const rows = Array.from(buckets.values()).sort((a, b) =>
      String(a.__key).localeCompare(String(b.__key))
    );

    return { chartData: rows, topProductNames: top };
  }, [trendRows, granularity]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-char-900">
          Analytics
        </h1>
        <p className="text-sm text-char-700/70">
          What's selling, what isn't, and how it's trending.
        </p>
      </div>

      {/* ---------- Top/Bottom sellers per category ---------- */}
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-char-900">
            Best &amp; worst sellers by category
          </h2>
          <div className="flex gap-1 rounded-md border border-char-700/20 bg-white p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setRangeDays(opt.days)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  rangeDays === opt.days
                    ? "bg-ember-500 text-white"
                    : "text-char-700/70 hover:bg-char-800/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loadingStats ? (
          <p className="text-char-700/60">Loading…</p>
        ) : byCategory.length === 0 ? (
          <p className="text-char-700/60">No menu items yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {byCategory.map(({ category, top, bottom }) => (
              <div
                key={category}
                className="rounded-card border border-char-700/10 bg-white p-5 shadow-sm"
              >
                <h3 className="mb-3 font-display font-semibold text-char-900">
                  {category}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <RankedList title="Top 5" rows={top} tone="text-green-700" />
                  <RankedList title="Bottom 5" rows={bottom} tone="text-ember-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Trending graph ---------- */}
      <div className="rounded-card border border-char-700/10 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-char-900">
            Trending items
          </h2>
          <div className="flex gap-1 rounded-md border border-char-700/20 bg-white p-1">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  granularity === opt.value
                    ? "bg-ember-500 text-white"
                    : "text-char-700/70 hover:bg-char-800/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loadingTrend ? (
          <p className="text-char-700/60">Loading…</p>
        ) : chartData.length === 0 ? (
          <p className="text-char-700/60">No sales in this window yet.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5decf" />
                <XAxis dataKey="bucket" fontSize={12} stroke="#7a6a58" />
                <YAxis fontSize={12} stroke="#7a6a58" allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {topProductNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={TREND_COLORS[i % TREND_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function RankedList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: CategoryItemStat[];
  tone: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-char-700/50">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-char-700/40">—</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.productId} className="flex justify-between gap-2">
              <span className="line-clamp-1 text-char-800" title={r.name}>
                {r.name}
              </span>
              <span className={`shrink-0 font-medium ${tone}`}>
                {r.qty}× · {formatPeso(r.revenue)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
