"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

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

  const columns: DataTableColumn<Order>[] = [
    { id: "order", header: "Order", cell: (o) => <span className="font-semibold text-char-900 dark:text-cream">#{o.order_number}</span> },
    {
      id: "type",
      header: "Type",
      cell: (o) =>
        `${ORDER_TYPE_LABEL[o.order_type] ?? o.order_type}${
          o.order_type === "dine_in" && o.table_number ? ` · Table ${o.table_number}` : ""
        }`,
    },
    { id: "queued_at", header: "Queued at", cell: (o) => formatDateTime(o.created_at) },
    { id: "ready_at", header: "Ready at", cell: (o) => (o.ready_at ? formatDateTime(o.ready_at) : "—") },
    { id: "prep", header: "Prep time", cell: (o) => `${prepMinutes(o) ?? "—"}m` },
    {
      id: "items",
      header: "Items",
      cell: (o) => `${o.order_items?.reduce((n, it) => n + it.quantity, 0) ?? 0}× items`,
    },
    { id: "status", header: "Status", cell: (o) => <Badge color="success" className="capitalize">{o.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Handled Orders"
        subtitle="Orders you've marked ready, most recent first."
        action={<SegmentedControl ariaLabel="Date range" options={RANGE_OPTIONS} value={rangeDays} onChange={setRangeDays} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <StatCard label="Orders handled" value={String(summary.count)} />
        <StatCard label="Avg. prep time" value={`${summary.avgPrep}m`} valueClassName="text-ember-600 dark:text-ember-400" />
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={orders}
          getRowId={(o) => o.id}
          emptyMessage={
            loading ? (
              <p className="px-4 py-8 text-center text-sm text-char-700/60 dark:text-cream/60">
                Loading history…
              </p>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-char-700/60 dark:text-cream/60">
                No handled orders in this range yet.
              </p>
            )
          }
        />
      </Card>
    </div>
  );
}
