"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatPeso, paymentMethodLabel } from "@/lib/utils";
import ReceiptModal from "@/components/ReceiptModal";
import CancelOrderModal from "@/components/CancelOrderModal";
import SetDeliveryRiderModal from "@/components/SetDeliveryRiderModal";
import type { Order } from "@/lib/types";

const CANCELLABLE_STATUSES = ["queued", "preparing", "ready"];

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400",
  cancelled: "bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400",
  ready: "bg-mustard-100 dark:bg-mustard-500/20 text-mustard-700 dark:text-mustard-300",
  preparing: "bg-char-800/10 dark:bg-cream/10 text-char-700 dark:text-cream/80",
  queued: "bg-char-800/10 dark:bg-cream/10 text-char-700 dark:text-cream/80",
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

export default function CashierTransactionsPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [rangeDays, setRangeDays] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [riderOrder, setRiderOrder] = useState<Order | null>(null);

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
      cash: completed
        .filter((o) => o.payment_method === "cash")
        .reduce((sum, o) => sum + Number(o.total), 0),
      epayment: completed
        .filter((o) => o.payment_method === "gcash")
        .reduce((sum, o) => sum + Number(o.total), 0),
    };
  }, [orders]);

  async function markHandedOff(orderId: string) {
    const completed_at = new Date().toISOString();
    await supabase
      .from("orders")
      .update({ status: "completed", completed_at })
      .eq("id", orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: "completed", completed_at } : o
      )
    );
  }

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

  async function confirmRider(name: string) {
    if (!riderOrder) return;
    await supabase
      .from("orders")
      .update({ delivered_by: name })
      .eq("id", riderOrder.id);
    setOrders((prev) =>
      prev.map((o) => (o.id === riderOrder.id ? { ...o, delivered_by: name } : o))
    );
    setRiderOrder(null);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
            My Transactions
          </h1>
          <p className="text-sm text-char-700/70 dark:text-cream/70">
            Orders you rang up, most recent first.
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

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
        <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-4 shadow-sm">
          <p className="text-xs text-char-700/50 dark:text-cream/50">Transactions</p>
          <p className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
            {summary.count}
          </p>
        </div>
        <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-4 shadow-sm">
          <p className="text-xs text-char-700/50 dark:text-cream/50">Revenue</p>
          <p className="font-display text-2xl font-semibold text-ember-600 dark:text-ember-400">
            {formatPeso(summary.revenue)}
          </p>
        </div>
        <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-4 shadow-sm">
          <p className="text-xs text-char-700/50 dark:text-cream/50">Cash</p>
          <p className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
            {formatPeso(summary.cash)}
          </p>
        </div>
        <div className="rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 p-4 shadow-sm">
          <p className="text-xs text-char-700/50 dark:text-cream/50">E-Payment</p>
          <p className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
            {formatPeso(summary.epayment)}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-char-700/60 dark:text-cream/60">Loading transactions…</p>
      ) : orders.length === 0 ? (
        <p className="text-char-700/60 dark:text-cream/60">No transactions in this range yet.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-char-700/10 dark:border-cream/10 bg-white dark:bg-char-900 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-char-800/5 dark:bg-cream/5 text-xs uppercase text-char-700/50 dark:text-cream/50">
              <tr>
                <th className="px-4 py-2.5">Order</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Items</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5"></th>
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
                    {o.order_type === "delivery" && (
                      <button
                        onClick={() => setRiderOrder(o)}
                        className="ml-1.5 text-xs text-ember-600 dark:text-ember-400 hover:underline"
                      >
                        {o.delivered_by ? `· ${o.delivered_by}` : "· Set rider"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {formatDateTime(o.created_at)}
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items
                  </td>
                  <td className="px-4 py-3 text-char-700/70 dark:text-cream/70">
                    {paymentMethodLabel(o.payment_method)}
                    {o.payment_provider && ` · ${o.payment_provider}`}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      title={o.cancel_reason ?? undefined}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                        STATUS_STYLES[o.status] ?? "bg-char-800/10 dark:bg-cream/10 text-char-700 dark:text-cream/80"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-char-900 dark:text-cream">
                    {formatPeso(o.total)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setViewingOrder(o)}
                        className="rounded border border-char-700/20 dark:border-cream/15 px-3 py-1.5 text-xs font-medium text-char-800 dark:text-cream/90 hover:bg-char-800/5 dark:hover:bg-cream/5"
                      >
                        Receipt
                      </button>
                      {o.status === "ready" && (
                        <button
                          onClick={() => markHandedOff(o.id)}
                          className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                        >
                          Mark handed off
                        </button>
                      )}
                      {CANCELLABLE_STATUSES.includes(o.status) && (
                        <button
                          onClick={() => setCancellingOrder(o)}
                          className="rounded border border-ember-300 dark:border-ember-500/40 px-3 py-1.5 text-xs font-medium text-ember-600 dark:text-ember-400 hover:bg-ember-50 dark:hover:bg-ember-500/15"
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
          cashierName={profile?.full_name}
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

      {riderOrder && (
        <SetDeliveryRiderModal
          orderNumber={riderOrder.order_number}
          currentName={riderOrder.delivered_by}
          onConfirm={confirmRider}
          onClose={() => setRiderOrder(null)}
        />
      )}
    </div>
  );
}
