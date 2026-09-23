"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChefHat,
  Clock,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  Truck,
  UtensilsCrossed,
  ShoppingBag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTime, minutesSince, cx } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeColor } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

const RECENT_LIMIT = 8;

const ACTIVE_STATUSES = ["queued", "preparing", "ready"] as const;

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

const ORDER_TYPE_ICON: Record<string, typeof UtensilsCrossed> = {
  dine_in: UtensilsCrossed,
  takeout: ShoppingBag,
  delivery: Truck,
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

  const recentColumns: DataTableColumn<Order>[] = [
    { id: "order", header: "Order", cell: (o) => <span className="font-semibold text-char-900 dark:text-cream">#{o.order_number}</span> },
    {
      id: "type",
      header: "Type",
      cell: (o) =>
        `${ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}${
          o.order_type === "dine_in" && o.table_number ? ` · Table ${o.table_number}` : ""
        }`,
    },
    { id: "ready_at", header: "Ready at", cell: (o) => (o.ready_at ? formatTime(o.ready_at) : "—") },
    {
      id: "items",
      header: "Items",
      cell: (o) => `${o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items`,
    },
    { id: "status", header: "Status", cell: (o) => <Badge color="success" className="capitalize">{o.status}</Badge> },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
            Kitchen Display
          </h1>
          <p className="text-sm text-char-700/70 dark:text-cream/70">
            Orders update live — no refresh needed.
          </p>
        </div>
        <div className="w-40">
          <StatCard label="Handled today" value={String(handledToday)} valueClassName="text-green-600 dark:text-green-400" />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading queue…" />
      ) : (
        <>
          {orders.length === 0 && (
            <EmptyState icon={<ChefHat size={28} />} message="No active orders. All caught up!" />
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Column title="Queued" count={queued.length} color="info">
              {queued.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  primaryLabel="Start preparing"
                  primaryIcon={<ChevronRight size={17} />}
                  onPrimary={() => setStatus(o.id, "preparing")}
                />
              ))}
            </Column>

            <Column title="Preparing" count={preparing.length} color="warning">
              {preparing.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  primaryLabel="Mark as Ready"
                  primaryIcon={<CheckCircle2 size={17} />}
                  onPrimary={() => setStatus(o.id, "ready")}
                />
              ))}
            </Column>

            <Column title="Ready for pickup" count={ready.length} color="success">
              {ready.map((o) => (
                <OrderCard key={o.id} order={o} readOnly />
              ))}
            </Column>
          </div>
        </>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display font-semibold text-char-900 dark:text-cream">
          Recently handled
        </h2>
        <Card padding="none">
          <DataTable
            columns={recentColumns}
            rows={recentHandled}
            getRowId={(o) => o.id}
            emptyMessage={
              <p className="px-4 py-8 text-center text-sm text-char-700/60 dark:text-cream/60">
                No orders handled yet — completed orders will show up here.
              </p>
            }
          />
        </Card>
      </div>
    </div>
  );
}

const COLUMN_ACCENT: Record<string, { border: string; badge: BadgeColor }> = {
  info: { border: "border-char-700/30 dark:border-cream/20", badge: "info" },
  warning: { border: "border-mustard-500", badge: "warning" },
  success: { border: "border-green-500", badge: "success" },
};

function Column({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: "info" | "warning" | "success";
  children: React.ReactNode;
}) {
  const accent = COLUMN_ACCENT[color];
  return (
    <div>
      <div className={cx("mb-3 flex items-center gap-2 border-b-2 pb-2", accent.border)}>
        <h2 className="font-display font-semibold text-char-900 dark:text-cream">{title}</h2>
        <Badge color={accent.badge}>{count}</Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function OrderCard({
  order,
  primaryLabel,
  primaryIcon,
  onPrimary,
  readOnly,
}: {
  order: Order;
  primaryLabel?: string;
  primaryIcon?: React.ReactNode;
  onPrimary?: () => void;
  readOnly?: boolean;
}) {
  const age = minutesSince(order.created_at);
  const urgent = age >= 15 && order.status !== "ready";
  const TypeIcon = ORDER_TYPE_ICON[order.order_type];

  return (
    <Card padding="sm" className={urgent ? "!border-ember-500" : undefined}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-lg font-bold text-char-900 dark:text-cream">
          #{order.order_number}
        </span>
        <span
          className={cx(
            "flex items-center gap-1 text-xs",
            urgent ? "font-semibold text-ember-600 dark:text-ember-400" : "text-char-700/50 dark:text-cream/50"
          )}
        >
          {urgent ? <AlertTriangle size={13} /> : <Clock size={13} />}
          {formatTime(order.created_at)} · {age}m ago
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge color="neutral" className="gap-1">
          {TypeIcon && <TypeIcon size={11} />}
          {order.order_type === "dine_in"
            ? `Dine-in${order.table_number ? ` · Table ${order.table_number}` : ""}`
            : ORDER_TYPE_LABEL[order.order_type] ?? order.order_type}
        </Badge>
        {order.order_type === "delivery" && order.delivered_by && (
          <Badge color="neutral">Rider: {order.delivered_by}</Badge>
        )}
      </div>

      <ul className="mb-3 space-y-1 text-sm">
        {order.order_items?.map((it) => (
          <li key={it.id} className="text-char-800 dark:text-cream/90">
            <div className="flex justify-between">
              <span>
                {it.quantity}× {it.product_name}
              </span>
            </div>
            {it.special_instructions && (
              <p className="text-xs italic text-ember-600 dark:text-ember-400">{it.special_instructions}</p>
            )}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mb-3 rounded bg-char-800/5 px-2 py-1 text-xs text-char-700/70 dark:bg-cream/5 dark:text-cream/70">
          Note: {order.notes}
        </p>
      )}

      {!readOnly && primaryLabel && onPrimary && (
        <Button size="lg" fullWidth icon={primaryIcon} onClick={onPrimary}>
          {primaryLabel}
        </Button>
      )}
      {readOnly && (
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 size={16} />
          Waiting for pickup
        </p>
      )}
    </Card>
  );
}
