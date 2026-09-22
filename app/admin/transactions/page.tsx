"use client";

import { useEffect, useMemo, useState } from "react";
import { FluentProvider, tokens } from "@fluentui/react-components";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-dark-mode";
import ReceiptModal from "@/components/ReceiptModal";
import CancelOrderModal from "@/components/CancelOrderModal";
import SetDeliveryRiderModal from "@/components/SetDeliveryRiderModal";
import type { Order, OrderType, PaymentMethod } from "@/lib/types";

import { brandLightTheme, brandDarkTheme } from "@/components/fluent/theme";
import { useSharedStyles } from "@/components/fluent/styles";
import { PageHeader } from "@/components/fluent/PageHeader";
import { SegmentedControl } from "@/components/fluent/SegmentedControl";
import { StatCard } from "@/components/fluent/StatCard";
import { TransactionsTable } from "./TransactionsTable";

export type OrderWithCashier = Order & { profiles: { full_name: string } | null };

const RANGE_OPTIONS = [
  { label: "Today", value: 1 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
];

export type ChannelFilter = "all" | OrderType;
export type PaymentFilter = "all" | PaymentMethod;

export default function AdminTransactionsPage() {
  const isDark = useIsDarkMode();
  return (
    <FluentProvider theme={isDark ? brandDarkTheme : brandLightTheme} style={{ backgroundColor: "transparent" }}>
      <TransactionsContent />
    </FluentProvider>
  );
}

function TransactionsContent() {
  const supabase = createClient();
  const styles = useSharedStyles();

  const [rangeDays, setRangeDays] = useState(1);
  const [orders, setOrders] = useState<OrderWithCashier[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [viewingOrder, setViewingOrder] = useState<OrderWithCashier | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<OrderWithCashier | null>(null);
  const [riderOrder, setRiderOrder] = useState<OrderWithCashier | null>(null);

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

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (channelFilter !== "all" && o.order_type !== channelFilter) return false;
      if (paymentFilter !== "all" && o.payment_method !== paymentFilter) return false;
      return true;
    });
  }, [orders, channelFilter, paymentFilter]);

  const summary = useMemo(() => {
    const counted = filteredOrders.filter((o) => o.status !== "cancelled");
    return {
      count: counted.length,
      revenue: counted.reduce((sum, o) => sum + Number(o.total), 0),
      cash: counted
        .filter((o) => o.payment_method === "cash")
        .reduce((sum, o) => sum + Number(o.total), 0),
      epayment: counted
        .filter((o) => o.payment_method === "gcash")
        .reduce((sum, o) => sum + Number(o.total), 0),
    };
  }, [filteredOrders]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXL }}>
      <PageHeader
        title="Transactions"
        subtitle="Every order across all cashiers, most recent first."
        action={
          <SegmentedControl ariaLabel="Date range" options={RANGE_OPTIONS} value={rangeDays} onChange={setRangeDays} />
        }
      />

      <div className={styles.statGrid}>
        <StatCard label="Transactions" value={String(summary.count)} />
        <StatCard label="Revenue" value={formatPeso(summary.revenue)} valueColor={tokens.colorBrandForeground1} />
        <StatCard label="Cash" value={formatPeso(summary.cash)} />
        <StatCard label="E-Payment" value={formatPeso(summary.epayment)} />
      </div>

      <TransactionsTable
        orders={filteredOrders}
        loading={loading}
        channelFilter={channelFilter}
        paymentFilter={paymentFilter}
        onChannelFilterChange={setChannelFilter}
        onPaymentFilterChange={setPaymentFilter}
        onViewReceipt={setViewingOrder}
        onCancel={setCancellingOrder}
        onSetRider={setRiderOrder}
      />

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
