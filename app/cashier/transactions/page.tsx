"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatPeso, paymentMethodLabel } from "@/lib/utils";
import ReceiptModal from "@/components/ReceiptModal";
import CancelOrderModal from "@/components/CancelOrderModal";
import SetDeliveryRiderModal from "@/components/SetDeliveryRiderModal";
import type { Order } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

const CANCELLABLE_STATUSES = ["queued", "preparing", "ready"];

const RANGE_OPTIONS = [
  { label: "Today", value: 1 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
];

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

  const columns: DataTableColumn<Order>[] = [
    {
      id: "order",
      header: "Order",
      sortValue: (o) => o.order_number,
      cell: (o) => <span className="font-semibold text-char-900 dark:text-cream">#{o.order_number}</span>,
    },
    {
      id: "type",
      header: "Type",
      cell: (o) => (
        <span>
          {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
          {o.order_type === "dine_in" && o.table_number ? ` · Table ${o.table_number}` : ""}
          {o.order_type === "delivery" && (
            <button
              onClick={() => setRiderOrder(o)}
              className="ml-1.5 text-xs font-medium text-ember-600 hover:underline dark:text-ember-400"
            >
              {o.delivered_by ? `· ${o.delivered_by}` : "· Set rider"}
            </button>
          )}
        </span>
      ),
    },
    { id: "time", header: "Time", sortValue: (o) => new Date(o.created_at).getTime(), cell: (o) => formatDateTime(o.created_at) },
    {
      id: "items",
      header: "Items",
      cell: (o) => `${o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items`,
    },
    {
      id: "payment",
      header: "Payment",
      cell: (o) => (
        <span>
          {paymentMethodLabel(o.payment_method)}
          {o.payment_provider && ` · ${o.payment_provider}`}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (o) => (
        <span title={o.cancel_reason ?? undefined}>
          <OrderStatusBadge status={o.status} />
        </span>
      ),
    },
    { id: "total", header: "Total", align: "right", sortValue: (o) => Number(o.total), cell: (o) => formatPeso(o.total) },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (o) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setViewingOrder(o)}>
            Receipt
          </Button>
          {o.status === "ready" && (
            <Button size="sm" className="!bg-green-600 hover:!bg-green-700" onClick={() => markHandedOff(o.id)}>
              Mark handed off
            </Button>
          )}
          {CANCELLABLE_STATUSES.includes(o.status) && (
            <Button size="sm" variant="danger" onClick={() => setCancellingOrder(o)}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Transactions"
        subtitle="Orders you rang up, most recent first."
        action={<SegmentedControl ariaLabel="Date range" options={RANGE_OPTIONS} value={rangeDays} onChange={setRangeDays} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
        <StatCard label="Transactions" value={String(summary.count)} />
        <StatCard label="Revenue" value={formatPeso(summary.revenue)} valueClassName="text-ember-600 dark:text-ember-400" />
        <StatCard label="Cash" value={formatPeso(summary.cash)} />
        <StatCard label="E-Payment" value={formatPeso(summary.epayment)} />
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={orders}
          getRowId={(o) => o.id}
          emptyMessage={
            <p className="px-4 py-8 text-center text-sm text-char-700/60 dark:text-cream/60">
              {loading ? "Loading transactions…" : "No transactions in this range yet."}
            </p>
          }
        />
      </Card>

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
