"use client";

import { useMemo } from "react";
import { Receipt } from "lucide-react";
import { formatDateTime, formatPeso, paymentMethodLabel } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import type { ChannelFilter, PaymentFilter, OrderWithCashier } from "./page";

const CANCELLABLE_STATUSES = ["queued", "preparing", "ready"];

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

const CHANNEL_OPTIONS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "All channels" },
  { value: "dine_in", label: "Dine-in" },
  { value: "takeout", label: "Takeout" },
  { value: "delivery", label: "Delivery" },
];
const PAYMENT_OPTIONS: { value: PaymentFilter; label: string }[] = [
  { value: "all", label: "All payment methods" },
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "E-Payment" },
];

const SELECT_CLASSES =
  "h-10 min-w-[170px] rounded-md border border-char-700/20 bg-white px-2.5 text-sm dark:border-cream/15 dark:bg-char-900 dark:text-cream";

export function TransactionsTable({
  orders,
  loading,
  channelFilter,
  paymentFilter,
  onChannelFilterChange,
  onPaymentFilterChange,
  onViewReceipt,
  onCancel,
  onSetRider,
}: {
  orders: OrderWithCashier[];
  loading: boolean;
  channelFilter: ChannelFilter;
  paymentFilter: PaymentFilter;
  onChannelFilterChange: (v: ChannelFilter) => void;
  onPaymentFilterChange: (v: PaymentFilter) => void;
  onViewReceipt: (order: OrderWithCashier) => void;
  onCancel: (order: OrderWithCashier) => void;
  onSetRider: (order: OrderWithCashier) => void;
}) {
  const columns = useMemo<DataTableColumn<OrderWithCashier>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        sortValue: (o) => o.order_number,
        cell: (o) => <span className="font-semibold text-char-900 dark:text-cream">#{o.order_number}</span>,
      },
      {
        id: "time",
        header: "Time",
        sortValue: (o) => new Date(o.created_at).getTime(),
        cell: (o) => formatDateTime(o.created_at),
      },
      {
        id: "cashier",
        header: "Cashier",
        sortValue: (o) => o.profiles?.full_name ?? "",
        cell: (o) => o.profiles?.full_name ?? "—",
      },
      {
        id: "type",
        header: "Type",
        sortValue: (o) => o.order_type,
        cell: (o) => (
          <span>
            {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
            {o.order_type === "dine_in" && o.table_number ? ` · Table ${o.table_number}` : ""}
            {o.order_type === "delivery" && (
              <button
                onClick={() => onSetRider(o)}
                className="ml-1.5 text-xs font-medium text-ember-600 hover:underline dark:text-ember-400"
              >
                {o.delivered_by ? `· ${o.delivered_by}` : "· Set rider"}
              </button>
            )}
          </span>
        ),
      },
      {
        id: "items",
        header: "Items",
        sortValue: (o) => o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0,
        cell: (o) => `${o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items`,
      },
      {
        id: "payment",
        header: "Payment",
        sortValue: (o) => o.payment_method ?? "",
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
        sortValue: (o) => o.status,
        cell: (o) => (
          <span title={o.cancel_reason ?? undefined}>
            <OrderStatusBadge status={o.status} />
          </span>
        ),
      },
      {
        id: "total",
        header: "Total",
        align: "right",
        sortValue: (o) => Number(o.total),
        cell: (o) => formatPeso(o.total),
      },
      {
        id: "actions",
        header: "",
        cell: (o) => (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => onViewReceipt(o)}>
              Receipt
            </Button>
            {CANCELLABLE_STATUSES.includes(o.status) && (
              <Button size="sm" variant="danger" onClick={() => onCancel(o)}>
                Cancel
              </Button>
            )}
          </div>
        ),
        align: "right",
      },
    ],
    [onCancel, onSetRider, onViewReceipt]
  );

  return (
    <Card padding="none">
      <div className="p-5 pb-0">
        <CardHeader icon={<Receipt size={18} />} title="All transactions" />
      </div>

      <div className="flex flex-wrap gap-2.5 px-5 pb-4 pt-3">
        <select
          aria-label="Filter by channel"
          value={channelFilter}
          onChange={(e) => onChannelFilterChange(e.target.value as ChannelFilter)}
          className={SELECT_CLASSES}
        >
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by payment method"
          value={paymentFilter}
          onChange={(e) => onPaymentFilterChange(e.target.value as PaymentFilter)}
          className={SELECT_CLASSES}
        >
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState label="Loading transactions…" />
      ) : orders.length === 0 ? (
        <EmptyState icon={<Receipt size={26} />} message="No transactions match this range and filters." />
      ) : (
        <DataTable columns={columns} rows={orders} getRowId={(o) => o.id} />
      )}
    </Card>
  );
}
