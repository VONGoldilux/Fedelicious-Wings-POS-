"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart, CreditCard, UtensilsCrossed, ShoppingBag, Truck, Banknote, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";

import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LoadingState } from "@/components/ui/EmptyState";
import { MetricDonutCard, type DonutMetricItem } from "./MetricDonutCard";
import { CategoryCard } from "./CategoryCard";
import { DeadStockTable } from "./DeadStockTable";
import { TrendingChart } from "./TrendingChart";
import {
  type CategoryItemStat,
  type Granularity,
  RANGE_OPTIONS,
  GRANULARITY_WINDOW,
  ORDER_TYPE_LABEL,
  ORDER_TYPES,
  PAYMENT_METHODS,
  ORDER_TYPE_COLORS,
  PAYMENT_COLORS,
  bucketKeyFor,
  bucketLabelFor,
} from "./constants";
import { paymentMethodLabel } from "@/lib/utils";

const ORDER_TYPE_ICON: Record<string, typeof UtensilsCrossed> = {
  dine_in: UtensilsCrossed,
  takeout: ShoppingBag,
  delivery: Truck,
};
const PAYMENT_ICON: Record<string, typeof Banknote> = {
  cash: Banknote,
  gcash: Wallet,
};

export default function AnalyticsPage() {
  const supabase = createClient();

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

  // ---- Group sold items by category ----------------------------------------
  // Only items that actually sold show up in a category card, ranked by qty.
  // Zero-sale items are dropped from here entirely — they're listed once,
  // across all categories, in the "No sales" section below instead of being
  // repeated as noise in every card.
  const byCategory = useMemo(() => {
    const map = new Map<string, CategoryItemStat[]>();
    for (const s of categoryStats) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return Array.from(map.entries())
      .map(([category, items]) => {
        const sold = items
          .filter((i) => i.qty > 0)
          .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue || a.name.localeCompare(b.name));
        const soldQty = sold.reduce((sum, i) => sum + i.qty, 0);
        const soldRevenue = sold.reduce((sum, i) => sum + i.revenue, 0);
        return { category, sold, soldQty, soldRevenue };
      })
      .sort((a, b) => b.soldRevenue - a.soldRevenue || a.category.localeCompare(b.category));
  }, [categoryStats]);

  // ---- Dead stock: every zero-sale item, across all categories ------------
  const deadStock = useMemo(
    () =>
      categoryStats
        .filter((s) => s.qty === 0)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [categoryStats]
  );

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === rangeDays)?.label ?? "";

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

  const channelItems: DonutMetricItem[] = ORDER_TYPES.map((type) => ({
    key: type,
    label: ORDER_TYPE_LABEL[type],
    count: orderTypeStats[type]?.count ?? 0,
    revenue: orderTypeStats[type]?.revenue ?? 0,
    color: ORDER_TYPE_COLORS[type],
    Icon: ORDER_TYPE_ICON[type],
  }));

  const paymentItems: DonutMetricItem[] = PAYMENT_METHODS.map((method) => ({
    key: method,
    label: paymentMethodLabel(method),
    count: paymentStats[method]?.count ?? 0,
    revenue: paymentStats[method]?.revenue ?? 0,
    color: PAYMENT_COLORS[method],
    Icon: PAYMENT_ICON[method],
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Analytics"
        subtitle="What's selling, what isn't, and how it's trending."
        action={<SegmentedControl ariaLabel="Date range" options={RANGE_OPTIONS} value={rangeDays} onChange={setRangeDays} />}
      />

      {/* ---------- Orders by channel + Payment methods ---------- */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <MetricDonutCard
          title="Orders by channel"
          HeaderIcon={PieChart}
          items={channelItems}
          loading={loadingOrderTypes}
          emptyLabel="No orders yet in this window"
        />
        <MetricDonutCard
          title="Payment methods"
          HeaderIcon={CreditCard}
          items={paymentItems}
          loading={loadingOrderTypes}
          emptyLabel="No payments yet in this window"
        />
      </div>

      {/* ---------- Best sellers per category ---------- */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold text-char-900 dark:text-cream">
          Best sellers by category
        </h2>

        {loadingStats ? (
          <LoadingState />
        ) : byCategory.length === 0 ? (
          <p className="text-sm text-char-700/60 dark:text-cream/60">No menu items yet.</p>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {byCategory.map((c) => (
              <CategoryCard key={c.category} {...c} />
            ))}
          </div>
        )}
      </div>

      {/* ---------- Dead stock: zero sales across all categories ---------- */}
      {!loadingStats && deadStock.length > 0 && (
        <DeadStockTable items={deadStock} rangeLabel={rangeLabel} />
      )}

      {/* ---------- Trending graph ---------- */}
      <TrendingChart
        chartData={chartData}
        topProductNames={topProductNames}
        granularity={granularity}
        onGranularityChange={setGranularity}
        loading={loadingTrend}
      />
    </div>
  );
}
