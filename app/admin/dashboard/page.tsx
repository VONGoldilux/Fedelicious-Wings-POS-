"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import { BarChart3, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-dark-mode";
import type { Order, OrderItem } from "@/lib/types";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

const RANGE_OPTIONS = [
  { label: "Today", value: 1 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
];

interface PopularItem {
  name: string;
  qty: number;
  revenue: number;
}

const popularColumns: DataTableColumn<PopularItem>[] = [
  { id: "name", header: "Item", cell: (i) => i.name, sortValue: (i) => i.name },
  { id: "qty", header: "Qty sold", cell: (i) => `${i.qty}×`, sortValue: (i) => i.qty },
  { id: "revenue", header: "Revenue", cell: (i) => formatPeso(i.revenue), sortValue: (i) => i.revenue },
];

export default function DashboardPage() {
  const supabase = createClient();
  const isDark = useIsDarkMode();
  const gridColor = isDark ? "#463830" : "#e5decf";
  const axisColor = isDark ? "#c9bfae" : "#7a6a58";
  const [rangeDays, setRangeDays] = useState(7);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - rangeDays);
      since.setHours(0, 0, 0, 0);

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .neq("status", "cancelled")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      const orderIds = (ordersData ?? []).map((o) => o.id);
      let itemsData: OrderItem[] = [];
      if (orderIds.length > 0) {
        const { data } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);
        itemsData = data ?? [];
      }

      setOrders(ordersData ?? []);
      setItems(itemsData);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays]);

  const totalRevenue = useMemo(
    () => orders.reduce((sum, o) => sum + Number(o.total), 0),
    [orders]
  );

  const revenueByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const day = new Date(o.created_at).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      });
      map.set(day, (map.get(day) ?? 0) + Number(o.total));
    }
    return Array.from(map.entries()).map(([day, revenue]) => ({ day, revenue }));
  }, [orders]);

  const popularItems: PopularItem[] = useMemo(() => {
    const map = new Map<string, PopularItem>();
    for (const it of items) {
      const key = it.product_name;
      const existing = map.get(key) ?? { name: key, qty: 0, revenue: 0 };
      existing.qty += it.quantity;
      existing.revenue += Number(it.line_total);
      map.set(key, existing);
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [items]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Sales Reports"
        subtitle="Revenue and menu performance for Fedelicious Wings."
        action={<SegmentedControl ariaLabel="Date range" options={RANGE_OPTIONS} value={rangeDays} onChange={setRangeDays} />}
      />

      {loading ? (
        <LoadingState label="Loading report…" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total revenue" value={formatPeso(totalRevenue)} valueClassName="text-ember-600 dark:text-ember-400" />
            <StatCard label="Orders" value={String(orders.length)} />
            <StatCard
              label="Average order value"
              value={formatPeso(orders.length ? totalRevenue / orders.length : 0)}
            />
          </div>

          <Card>
            <CardHeader icon={<BarChart3 size={18} />} title="Revenue by day" />
            {revenueByDay.length === 0 ? (
              <EmptyState icon={<BarChart3 size={26} />} message="No revenue in this period yet." />
            ) : (
              <div style={{ height: 260 }} className="pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="day" fontSize={12} stroke={axisColor} />
                    <YAxis fontSize={12} stroke={axisColor} />
                    <RechartsTooltip
                      formatter={(v: number) => formatPeso(v)}
                      contentStyle={{
                        background: isDark ? "#241D18" : "#fff",
                        border: `1px solid ${gridColor}`,
                        color: isDark ? "#FBF4EA" : "#241D18",
                      }}
                    />
                    <Bar dataKey="revenue" fill="#F0662B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card padding="none">
            <div className="p-5 pb-0">
              <CardHeader icon={<Flame size={18} />} title="Popular items" />
            </div>
            {popularItems.length === 0 ? (
              <EmptyState icon={<Flame size={26} />} message="No sales in this period yet." />
            ) : (
              <DataTable columns={popularColumns} rows={popularItems} getRowId={(i) => i.name} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
