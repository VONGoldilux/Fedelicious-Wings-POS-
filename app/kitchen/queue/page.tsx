"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatTime, minutesSince } from "@/lib/utils";
import type { Order } from "@/lib/types";

const RECENT_LIMIT = 8;

const ACTIVE_STATUSES = ["queued", "preparing", "ready"] as const;

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

export default function KitchenQueuePage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [handledToday, setHandledToday] = useState(0);
  const [recentHandled, setRecentHandled] = useState<Order[]>([]);
  const [, forceTick] = useState(0);

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: true });
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  }, [supabase]);

  // Orders the kitchen has moved to "ready" (or beyond) today — a count of
  // work done, independent of whether the cashier has completed them since.
  const loadHandledToday = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .not("ready_at", "is", null)
      .gte("ready_at", startOfDay.toISOString());
    setHandledToday(count ?? 0);
  }, [supabase]);

  const loadRecentHandled = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .not("ready_at", "is", null)
      .order("ready_at", { ascending: false })
      .limit(RECENT_LIMIT);
    setRecentHandled((data as Order[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadOrders();
    loadHandledToday();
    loadRecentHandled();
  }, [loadOrders, loadHandledToday, loadRecentHandled]);

  // ---- Realtime: new orders appear instantly, status changes sync live ----
  useEffect(() => {
    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => loadOrders()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as Order;
          setOrders((prev) => {
            if (!ACTIVE_STATUSES.includes(updated.status as any)) {
              return prev.filter((o) => o.id !== updated.id);
            }
            return prev.map((o) =>
              o.id === updated.id ? { ...o, ...updated } : o
            );
          });
          if (updated.ready_at) {
            loadHandledToday();
            loadRecentHandled();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        () => loadOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render every 30s so the "minutes ago" timestamps stay fresh.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  async function setStatus(orderId: string, status: Order["status"]) {
    const patch: Partial<Order> = { status };
    if (status === "ready") patch.ready_at = new Date().toISOString();
    await supabase.from("orders").update(patch).eq("id", orderId);
  }

  const queued = orders.filter((o) => o.status === "queued");
  const preparing = orders.filter((o) => o.status === "preparing");
  const ready = orders.filter((o) => o.status === "ready");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900">
            Kitchen Display
          </h1>
          <p className="text-sm text-char-700/70">
            Orders update live — no refresh needed.
          </p>
        </div>
        <div className="rounded-card border border-char-700/10 bg-white px-4 py-2.5 shadow-sm">
          <p className="text-xs text-char-700/50">Handled today</p>
          <p className="font-display text-xl font-semibold text-green-600">
            {handledToday}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-char-700/60">Loading queue…</p>
      ) : (
        <>
          {orders.length === 0 && (
            <p className="mb-4 text-char-700/60">No active orders. All caught up! 🍗</p>
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Column title="Queued" count={queued.length} accent="border-char-700/30">
            {queued.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                primaryLabel="Start preparing"
                onPrimary={() => setStatus(o.id, "preparing")}
              />
            ))}
          </Column>

          <Column title="Preparing" count={preparing.length} accent="border-mustard-500">
            {preparing.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                primaryLabel="Mark as Ready"
                onPrimary={() => setStatus(o.id, "ready")}
              />
            ))}
          </Column>

          <Column title="Ready for pickup" count={ready.length} accent="border-green-500">
            {ready.map((o) => (
              <OrderCard key={o.id} order={o} readOnly />
            ))}
          </Column>
          </div>
        </>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display font-semibold text-char-900">
          Recently handled
        </h2>
        {recentHandled.length === 0 ? (
          <p className="text-sm text-char-700/60">
            No orders handled yet — completed orders will show up here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-card border border-char-700/10 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-char-800/5 text-xs uppercase text-char-700/50">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5">Ready at</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-char-700/10">
                {recentHandled.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2.5 font-medium text-char-900">
                      #{o.order_number}
                    </td>
                    <td className="px-4 py-2.5 text-char-700/70">
                      {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
                      {o.order_type === "dine_in" && o.table_number
                        ? ` · Table ${o.table_number}`
                        : ""}
                    </td>
                    <td className="px-4 py-2.5 text-char-700/70">
                      {o.ready_at ? formatTime(o.ready_at) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-char-700/70">
                      {o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items
                    </td>
                    <td className="px-4 py-2.5 capitalize text-char-700/70">
                      {o.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Column({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className={`mb-3 border-b-2 pb-2 font-display font-semibold text-char-900 ${accent}`}>
        {title} <span className="text-char-700/40">({count})</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function OrderCard({
  order,
  primaryLabel,
  onPrimary,
  readOnly,
}: {
  order: Order;
  primaryLabel?: string;
  onPrimary?: () => void;
  readOnly?: boolean;
}) {
  const age = minutesSince(order.created_at);
  const urgent = age >= 15 && order.status !== "ready";

  return (
    <div
      className={`rounded-card border bg-white p-4 shadow-sm ${
        urgent ? "border-ember-500" : "border-char-700/10"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display font-semibold text-char-900">
          #{order.order_number}
        </span>
        <span
          className={`text-xs ${urgent ? "font-semibold text-ember-600" : "text-char-700/50"}`}
        >
          {formatTime(order.created_at)} · {age}m ago
        </span>
      </div>

      <div className="mb-2">
        <span className="rounded-full bg-char-800/5 px-2 py-0.5 text-xs font-medium capitalize text-char-700">
          {order.order_type === "dine_in"
            ? `Dine-in${order.table_number ? ` · Table ${order.table_number}` : ""}`
            : order.order_type.replace("_", " ")}
        </span>
      </div>

      <ul className="mb-3 space-y-1 text-sm">
        {order.order_items?.map((it) => (
          <li key={it.id} className="text-char-800">
            <div className="flex justify-between">
              <span>
                {it.quantity}× {it.product_name}
              </span>
            </div>
            {it.special_instructions && (
              <p className="text-xs italic text-ember-600">{it.special_instructions}</p>
            )}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mb-3 rounded bg-char-800/5 px-2 py-1 text-xs text-char-700/70">
          Note: {order.notes}
        </p>
      )}

      {!readOnly && primaryLabel && onPrimary && (
        <button
          onClick={onPrimary}
          className="w-full rounded-md bg-ember-500 py-2 text-sm font-semibold text-white hover:bg-ember-600"
        >
          {primaryLabel}
        </button>
      )}
      {readOnly && (
        <p className="text-center text-sm font-medium text-green-600">
          Waiting for pickup
        </p>
      )}
    </div>
  );
}
