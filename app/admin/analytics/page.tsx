"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatPeso, paymentMethodLabel } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-dark-mode";
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

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};
const ORDER_TYPES = ["dine_in", "takeout", "delivery"] as const;
const PAYMENT_METHODS = ["cash", "gcash"] as const;

const ORDER_TYPE_COLORS: Record<string, string> = {
  dine_in: "#F0662B",
  takeout: "#D49B22",
  delivery: "#463830",
};
const PAYMENT_COLORS: Record<string, string> = {
  cash: "#F0662B",
  gcash: "#D49B22",
};

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
  const isDark = useIsDarkMode();
  const gridColor = isDark ? "#463830" : "#e5decf";
  const axisColor = isDark ? "#c9bfae" : "#7a6a58";
  const tooltipStyle = {
    background: isDark ? "#241D18" : "#fff",
    border: `1px solid ${gridColor}`,
    color: isDark ? "#FBF4EA" : "#241D18",
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [rangeDays, setRangeDays] = useState(30);
  const [granularity, setGranularity] = useState<Granularity>("day");

  const [categoryStats, setCategoryStats] = useState<CategoryItemStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const [orderTypeStats, setOrderTypeStats] = useState<
    Record<string, { count: number; revenue: number }>
  >({});
  const [paymentStats, setPaymentStats] = useState<
    Record<string, { count: number; revenue: number }>
  >({});
  const [loadingOrderTypes, setLoadingOrderTypes] = useState(true);

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

  // ---- Orders by channel (dine-in / takeout / delivery) -------------------
  useEffect(() => {
    async function load() {
      setLoadingOrderTypes(true);
      const since = new Date();
      since.setDate(since.getDate() - rangeDays);
      since.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("orders")
        .select("order_type, payment_method, total")
        .neq("status", "cancelled")
        .gte("created_at", since.toISOString());

      const typeStats: Record<string, { count: number; revenue: number }> = {};
      for (const type of ORDER_TYPES) typeStats[type] = { count: 0, revenue: 0 };
      const payStats: Record<string, { count: number; revenue: number }> = {};
      for (const method of PAYMENT_METHODS) payStats[method] = { count: 0, revenue: 0 };

      for (const o of data ?? []) {
        const typeBucket = typeStats[o.order_type] ?? { count: 0, revenue: 0 };
        typeBucket.count += 1;
        typeBucket.revenue += Number(o.total);
        typeStats[o.order_type] = typeBucket;

        if (o.payment_method) {
          const payBucket = payStats[o.payment_method] ?? { count: 0, revenue: 0 };
          payBucket.count += 1;
          payBucket.revenue += Number(o.total);
          payStats[o.payment_method] = payBucket;
        }
      }

      setOrderTypeStats(typeStats);
      setPaymentStats(payStats);
      setLoadingOrderTypes(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

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
  // Bottom 5 is drawn from whatever's left AFTER Top 5 is removed, so the
  // two lists never show the same items twice — which used to happen for
  // any category with 5 or fewer products, or where most items tied at 0
  // sales (stable-sort returns identical order for both directions on a
  // tie, so "highest first" and "lowest first" looked like the same list).
  const byCategory = useMemo(() => {
    const map = new Map<string, CategoryItemStat[]>();
    for (const s of categoryStats) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries()).map(([category, items]) => {
      const byBest = [...items].sort(
        (a, b) => b.qty - a.qty || a.name.localeCompare(b.name)
      );
      const top = byBest.slice(0, 5);
      const topIds = new Set(top.map((t) => t.productId));
      const rest = byBest.filter((s) => !topIds.has(s.productId));
      const bottom = [...rest].reverse().slice(0, 5);
      return { category, top, bottom, hasDistinctBottom: rest.length > 0 };
    });
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
        <h1 className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
          Analytics
        </h1>
        <p className="text-sm text-char-700/70 dark:text-cream/70">
          What's selling, what isn't, and how it's trending.
        </p>
      </div>

      {/* ---------- Orders by channel ---------- */}
      <div className="mb-8">
        <h2 className="mb-4 font-display font-semibold text-char-900 dark:text-cream">
          Orders by channel
        </h2>
        {loadingOrderTypes ? (
          <p className="text-char-700/60 dark:text-cream/60">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {ORDER_TYPES.map((type) => {
                const stat = orderTypeStats[type] ?? { count: 0, revenue: 0 };
                return (
                  <div
                    key={type}
                    className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-5 shadow-sm"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                      {ORDER_TYPE_LABEL[type]}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-char-900 dark:text-cream">
                      {stat.count} orders
                    </p>
                    <p className="text-sm text-ember-600 dark:text-ember-400">{formatPeso(stat.revenue)}</p>
                  </div>
                );
              })}
            </div>
            <SharePie
              data={ORDER_TYPES.map((type) => ({
                name: ORDER_TYPE_LABEL[type],
                value: orderTypeStats[type]?.revenue ?? 0,
                color: ORDER_TYPE_COLORS[type],
              }))}
            />
          </div>
        )}
      </div>

      {/* ---------- Payment methods ---------- */}
      <div className="mb-8">
        <h2 className="mb-4 font-display font-semibold text-char-900 dark:text-cream">
          Payment methods
        </h2>
        {loadingOrderTypes ? (
          <p className="text-char-700/60 dark:text-cream/60">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-lg">
              {PAYMENT_METHODS.map((method) => {
                const stat = paymentStats[method] ?? { count: 0, revenue: 0 };
                return (
                  <div
                    key={method}
                    className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-5 shadow-sm"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                      {paymentMethodLabel(method)}
                    </p>
                    <p className="mt-1 font-display text-2xl font-semibold text-char-900 dark:text-cream">
                      {stat.count} orders
                    </p>
                    <p className="text-sm text-ember-600 dark:text-ember-400">{formatPeso(stat.revenue)}</p>
                  </div>
                );
              })}
            </div>
            <SharePie
              data={PAYMENT_METHODS.map((method) => ({
                name: paymentMethodLabel(method),
                value: paymentStats[method]?.revenue ?? 0,
                color: PAYMENT_COLORS[method],
              }))}
            />
          </div>
        )}
      </div>

      {/* ---------- Top/Bottom sellers per category ---------- */}
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-char-900 dark:text-cream">
            Best &amp; worst sellers by category
          </h2>
          <div className="flex gap-1 rounded-md border border-char-700/20 dark:border-cream/15 bg-white dark:bg-char-900 p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setRangeDays(opt.days)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  rangeDays === opt.days
                    ? "bg-ember-500 text-white"
                    : "text-char-700/70 dark:text-cream/70 hover:bg-char-800/5 dark:hover:bg-cream/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loadingStats ? (
          <p className="text-char-700/60 dark:text-cream/60">Loading…</p>
        ) : byCategory.length === 0 ? (
          <p className="text-char-700/60 dark:text-cream/60">No menu items yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {byCategory.map(({ category, top, bottom, hasDistinctBottom }) => (
              <div
                key={category}
                className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-5 shadow-sm"
              >
                <h3 className="mb-3 font-display font-semibold text-char-900 dark:text-cream">
                  {category}
                </h3>
                {hasDistinctBottom ? (
                  <div className="grid grid-cols-2 gap-4">
                    <RankedList title="Top 5" rows={top} tone="text-green-700 dark:text-green-400" />
                    <RankedList title="Bottom 5" rows={bottom} tone="text-ember-600 dark:text-ember-400" />
                  </div>
                ) : (
                  <RankedList title="All items" rows={top} tone="text-char-800 dark:text-cream/90" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Trending graph ---------- */}
      <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-char-900 dark:text-cream">
            Trending items
          </h2>
          <div className="flex gap-1 rounded-md border border-char-700/20 dark:border-cream/15 bg-white dark:bg-char-900 p-1">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGranularity(opt.value)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  granularity === opt.value
                    ? "bg-ember-500 text-white"
                    : "text-char-700/70 dark:text-cream/70 hover:bg-char-800/5 dark:hover:bg-cream/5"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loadingTrend ? (
          <p className="text-char-700/60 dark:text-cream/60">Loading…</p>
        ) : chartData.length === 0 ? (
          <p className="text-char-700/60 dark:text-cream/60">No sales in this window yet.</p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="bucket" fontSize={12} stroke={axisColor} />
                <YAxis fontSize={12} stroke={axisColor} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: isDark ? "#FBF4EA" : "#241D18" }}
                />
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

function SharePie({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const isDark = useIsDarkMode();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-5 text-sm text-char-700/50 dark:text-cream/50 shadow-sm">
        No revenue yet
      </div>
    );
  }
  return (
    <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-3 shadow-sm">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => formatPeso(v)}
              contentStyle={{
                background: isDark ? "#241D18" : "#fff",
                border: `1px solid ${isDark ? "#463830" : "#e5decf"}`,
                color: isDark ? "#FBF4EA" : "#241D18",
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{ fontSize: 12, color: isDark ? "#FBF4EA" : "#241D18" }}
            />
          </PieChart>
        </ResponsiveContainer>
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
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-char-700/40 dark:text-cream/40">—</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.productId} className="flex justify-between gap-2">
              <span className="line-clamp-1 text-char-800 dark:text-cream/90" title={r.name}>
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
