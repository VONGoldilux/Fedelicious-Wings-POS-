"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatPeso } from "@/lib/utils";
import type { Order } from "@/lib/types";

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  ready: "bg-mustard-100 text-mustard-700",
  preparing: "bg-char-800/10 text-char-700",
  queued: "bg-char-800/10 text-char-700",
};

export default function CashierTransactionsPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [rangeDays, setRangeDays] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    async function load() {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - rangeDays);
      since.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("cashier_id", profile!.id)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      setOrders((data as Order[]) ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, profile]);

  const summary = useMemo(() => {
    const completed = orders.filter((o) => o.status !== "cancelled");
    return {
      count: completed.length,
      revenue: completed.reduce((sum, o) => sum + Number(o.total), 0),
    };
  }, [orders]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900">
            My Transactions
          </h1>
          <p className="text-sm text-char-700/70">
            Orders you rang up, most recent first.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-char-800/5 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setRangeDays(opt.days)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                rangeDays === opt.days
                  ? "bg-ember-500 text-white"
                  : "text-char-700 hover:bg-char-800/10"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-card border border-char-700/10 bg-white p-4 shadow-sm">
          <p className="text-xs text-char-700/50">Transactions</p>
          <p className="font-display text-2xl font-semibold text-char-900">
            {summary.count}
          </p>
        </div>
        <div className="rounded-card border border-char-700/10 bg-white p-4 shadow-sm">
          <p className="text-xs text-char-700/50">Revenue</p>
          <p className="font-display text-2xl font-semibold text-ember-600">
            {formatPeso(summary.revenue)}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-char-700/60">Loading transactions…</p>
      ) : orders.length === 0 ? (
        <p className="text-char-700/60">No transactions in this range yet.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-char-700/10 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-char-800/5 text-xs uppercase text-char-700/50">
              <tr>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Items</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-char-700/10">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium text-char-900">
                    #{o.order_number}
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {formatDateTime(o.created_at)}
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items
                  </td>
                  <td className="px-4 py-3 capitalize text-char-700/70">
                    {o.payment_method ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLES[o.status] ?? "bg-char-800/10 text-char-700"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-char-900">
                    {formatPeso(o.total)}
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
