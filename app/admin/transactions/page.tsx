"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatPeso, paymentMethodLabel } from "@/lib/utils";
import ReceiptModal from "@/components/ReceiptModal";
import CancelOrderModal from "@/components/CancelOrderModal";
import type { Order } from "@/lib/types";

type OrderWithCashier = Order & { profiles: { full_name: string } | null };

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

const CANCELLABLE_STATUSES = ["queued", "preparing", "ready"];

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  ready: "bg-mustard-100 text-mustard-700",
  preparing: "bg-char-800/10 text-char-700",
  queued: "bg-char-800/10 text-char-700",
};

export default function AdminTransactionsPage() {
  const supabase = createClient();

  const [rangeDays, setRangeDays] = useState(1);
  const [orders, setOrders] = useState<OrderWithCashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingOrder, setViewingOrder] = useState<OrderWithCashier | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<OrderWithCashier | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - rangeDays);
      since.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*), profiles(full_name)")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      setOrders((data as OrderWithCashier[]) ?? []);
      setLoading(false);
    }
    load();
  }, [rangeDays, supabase]);

  const summary = useMemo(() => {
    const counted = orders.filter((o) => o.status !== "cancelled");
    return {
      count: counted.length,
      revenue: counted.reduce((sum, o) => sum + Number(o.total), 0),
    };
  }, [orders]);

  async function confirmCancel(reason: string) {
    if (!cancellingOrder) return;
    await supabase
      .from("orders")
      .update({ status: "cancelled", cancel_reason: reason })
      .eq("id", cancellingOrder.id);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === cancellingOrder.id
          ? { ...o, status: "cancelled", cancel_reason: reason }
          : o
      )
    );
    setCancellingOrder(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900">
            Transactions
          </h1>
          <p className="text-sm text-char-700/70">
            Every order across all cashiers, most recent first.
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
                <th className="px-4 py-2.5">Cashier</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Items</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5"></th>
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
                    {o.profiles?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
                    {o.order_type === "dine_in" && o.table_number
                      ? ` · Table ${o.table_number}`
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {paymentMethodLabel(o.payment_method)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      title={o.cancel_reason ?? undefined}
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setViewingOrder(o)}
                        className="rounded border border-char-700/20 px-3 py-1.5 text-xs font-medium text-char-800 hover:bg-char-800/5"
                      >
                        Receipt
                      </button>
                      {CANCELLABLE_STATUSES.includes(o.status) && (
                        <button
                          onClick={() => setCancellingOrder(o)}
                          className="rounded border border-ember-300 px-3 py-1.5 text-xs font-medium text-ember-600 hover:bg-ember-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewingOrder && (
        <ReceiptModal
          order={viewingOrder}
          cashierName={viewingOrder.profiles?.full_name}
          onClose={() => setViewingOrder(null)}
        />
      )}

      {cancellingOrder && (
        <CancelOrderModal
          orderNumber={cancellingOrder.order_number}
          onConfirm={confirmCancel}
          onClose={() => setCancellingOrder(null)}
        />
      )}
    </div>
  );
}
