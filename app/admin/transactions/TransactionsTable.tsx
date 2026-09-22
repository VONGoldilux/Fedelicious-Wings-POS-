"use client";

import { useMemo } from "react";
import {
  Card,
  CardHeader,
  Title3,
  Button,
  Dropdown,
  Option,
  DataGrid,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  TableCellLayout,
  createTableColumn,
  type TableColumnDefinition,
  tokens,
} from "@fluentui/react-components";
import { ReceiptMoneyRegular } from "@fluentui/react-icons";
import { formatDateTime, formatPeso, paymentMethodLabel } from "@/lib/utils";
import { useSharedStyles } from "@/components/fluent/styles";
import { EmptyState, LoadingState } from "@/components/fluent/EmptyState";
import { OrderStatusBadge } from "@/components/fluent/StatusBadge";
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
  const styles = useSharedStyles();

  const columns = useMemo<TableColumnDefinition<OrderWithCashier>[]>(
    () => [
      createTableColumn<OrderWithCashier>({
        columnId: "order",
        compare: (a, b) => a.order_number - b.order_number,
        renderHeaderCell: () => "Order",
        renderCell: (o) => <TableCellLayout>#{o.order_number}</TableCellLayout>,
      }),
      createTableColumn<OrderWithCashier>({
        columnId: "time",
        compare: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        renderHeaderCell: () => "Time",
        renderCell: (o) => <TableCellLayout>{formatDateTime(o.created_at)}</TableCellLayout>,
      }),
      createTableColumn<OrderWithCashier>({
        columnId: "cashier",
        compare: (a, b) => (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? ""),
        renderHeaderCell: () => "Cashier",
        renderCell: (o) => <TableCellLayout truncate>{o.profiles?.full_name ?? "—"}</TableCellLayout>,
      }),
      createTableColumn<OrderWithCashier>({
        columnId: "type",
        compare: (a, b) => a.order_type.localeCompare(b.order_type),
        renderHeaderCell: () => "Type",
        renderCell: (o) => (
          <TableCellLayout>
            {ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}
            {o.order_type === "dine_in" && o.table_number ? ` · Table ${o.table_number}` : ""}
            {o.order_type === "delivery" && (
              <Button
                appearance="transparent"
                size="small"
                style={{ marginLeft: tokens.spacingHorizontalXS, color: tokens.colorBrandForeground1 }}
                onClick={() => onSetRider(o)}
              >
                {o.delivered_by ? `· ${o.delivered_by}` : "· Set rider"}
              </Button>
            )}
          </TableCellLayout>
        ),
      }),
      createTableColumn<OrderWithCashier>({
        columnId: "items",
        compare: (a, b) =>
          (a.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0) -
          (b.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0),
        renderHeaderCell: () => "Items",
        renderCell: (o) => `${o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items`,
      }),
      createTableColumn<OrderWithCashier>({
        columnId: "payment",
        compare: (a, b) => (a.payment_method ?? "").localeCompare(b.payment_method ?? ""),
        renderHeaderCell: () => "Payment",
        renderCell: (o) => (
          <TableCellLayout>
            {paymentMethodLabel(o.payment_method)}
            {o.payment_provider && ` · ${o.payment_provider}`}
          </TableCellLayout>
        ),
      }),
      createTableColumn<OrderWithCashier>({
        columnId: "status",
        compare: (a, b) => a.status.localeCompare(b.status),
        renderHeaderCell: () => "Status",
        renderCell: (o) => (
          <TableCellLayout>
            <span title={o.cancel_reason ?? undefined}>
              <OrderStatusBadge status={o.status} />
            </span>
          </TableCellLayout>
        ),
      }),
      createTableColumn<OrderWithCashier>({
        columnId: "total",
        compare: (a, b) => Number(a.total) - Number(b.total),
        renderHeaderCell: () => "Total",
        renderCell: (o) => <TableCellLayout>{formatPeso(o.total)}</TableCellLayout>,
      }),
      createTableColumn<OrderWithCashier>({
        columnId: "actions",
        compare: () => 0,
        renderHeaderCell: () => "",
        renderCell: (o) => (
          <div style={{ display: "flex", gap: tokens.spacingHorizontalXS }}>
            <Button size="small" onClick={() => onViewReceipt(o)}>
              Receipt
            </Button>
            {CANCELLABLE_STATUSES.includes(o.status) && (
              <Button
                size="small"
                appearance="outline"
                style={{ color: tokens.colorPaletteRedForeground1, borderColor: tokens.colorPaletteRedBorder1 }}
                onClick={() => onCancel(o)}
              >
                Cancel
              </Button>
            )}
          </div>
        ),
      }),
    ],
    [onCancel, onSetRider, onViewReceipt]
  );

  return (
    <Card size="large" className={styles.card}>
      <CardHeader
        image={<ReceiptMoneyRegular fontSize={20} style={{ color: tokens.colorBrandForeground1 }} />}
        header={<Title3>All transactions</Title3>}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: tokens.spacingHorizontalS,
          marginTop: tokens.spacingVerticalM,
          marginBottom: tokens.spacingVerticalS,
        }}
      >
        <Dropdown
          aria-label="Filter by channel"
          value={CHANNEL_OPTIONS.find((o) => o.value === channelFilter)?.label ?? ""}
          selectedOptions={[channelFilter]}
          onOptionSelect={(_, data) => onChannelFilterChange((data.optionValue ?? "all") as ChannelFilter)}
          style={{ minWidth: 180 }}
        >
          {CHANNEL_OPTIONS.map((o) => (
            <Option key={o.value} value={o.value}>
              {o.label}
            </Option>
          ))}
        </Dropdown>
        <Dropdown
          aria-label="Filter by payment method"
          value={PAYMENT_OPTIONS.find((o) => o.value === paymentFilter)?.label ?? ""}
          selectedOptions={[paymentFilter]}
          onOptionSelect={(_, data) => onPaymentFilterChange((data.optionValue ?? "all") as PaymentFilter)}
          style={{ minWidth: 200 }}
        >
          {PAYMENT_OPTIONS.map((o) => (
            <Option key={o.value} value={o.value}>
              {o.label}
            </Option>
          ))}
        </Dropdown>
      </div>

      {loading ? (
        <LoadingState label="Loading transactions…" />
      ) : orders.length === 0 ? (
        <EmptyState icon={ReceiptMoneyRegular} message="No transactions match this range and filters." />
      ) : (
        <div className={styles.tableScroll}>
          <DataGrid items={orders} columns={columns} sortable getRowId={(o) => o.id} size="medium">
            <DataGridHeader>
              <DataGridRow>
                {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody<OrderWithCashier>>
              {({ item, rowId }) => (
                <DataGridRow<OrderWithCashier> key={rowId}>
                  {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        </div>
      )}
    </Card>
  );
}
