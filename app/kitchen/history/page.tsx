"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import type { Order } from "@/lib/types";

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400",
  ready: "bg-mustard-100 dark:bg-mustard-500/20 text-mustard-700 dark:text-mustard-300",
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

function prepMinutes(order: Order): number | null {
  if (!order.ready_at) return null;
  return Math.round(
    (new Date(order.ready_at).getTime() - new Date(order.created_at).getTime()) /
      60000
  );
}

export default function KitchenHistoryPage() {
  const supabase = createClient();

  const [rangeDays, setRangeDays] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - rangeDays);
      since.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .not("ready_at", "is", null)
        .gte("ready_at", since.toISOString())
        .order("ready_at", { ascending: false });

      setOrders((data as Order[]) ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  const summary = useMemo(() => {
    const times = orders.map(prepMinutes).filter((m): m is number => m !== null);
    const avg = times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;
    return { count: orders.length, avgPrep: avg };
  }, [orders]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
            Handled Orders
          </h1>
          <p className="text-sm text-char-700/70 dark:text-cream/70">
            Orders you've marked ready, most recent first.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-char-800/5 dark:bg-cream/5 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setRangeDays(opt.days)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                rangeDays === opt.days
                  ? "bg-ember-500 text-white"
                  : "text-char-700 dark:text-cream/80 hover:bg-char-800/10 dark:hover:bg-cream/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-4 shadow-sm">
          <p className="text-xs text-char-700/50 dark:text-cream/50">Orders handled</p>
          <p className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
            {summary.count}
          </p>
        </div>
        <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-4 shadow-sm">
          <p className="text-xs text-char-700/50 dark:text-cream/50">Avg. prep time</p>
          <p className="font-display text-2xl font-semibold text-ember-600 dark:text-ember-400">
            {summary.avgPrep}m
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-char-700/60 dark:text-cream/60">Loading history…</p>
      ) : orders.length === 0 ? (
        <p className="text-char-700/60 dark:text-cream/60">No handled orders in this range yet.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-char-800/5 dark:bg-cream/5 text-xs uppercase text-char-700/50 dark:text-cream/50">
              <tr>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Queued at</th>
                <th className="px-4 py-2.5">Ready at</th>
                <th className="px-4 py-2.5">Prep time</th>
                <th className="px-4 py-2.5">Items</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-char-700/10 dark:divide-cream/10">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium text-char-900 dark:text-cream">
                    #{o.order_number}
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
                    {o.order_type === "dine_in" && o.table_number
                      ? ` · Table ${o.table_number}`
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {formatDateTime(o.created_at)}
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {o.ready_at ? formatDateTime(o.ready_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {prepMinutes(o) ?? "—"}m
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLES[o.status] ?? "bg-char-800/10 dark:bg-cream/10 text-char-700 dark:text-cream/80"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
