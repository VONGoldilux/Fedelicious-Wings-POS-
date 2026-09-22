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
import {
  FluentProvider,
  Card,
  CardHeader,
  Title3,
  tokens,
  DataGrid,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  TableCellLayout,
  createTableColumn,
  type TableColumnDefinition,
} from "@fluentui/react-components";
import { DataBarVerticalRegular, FoodRegular } from "@fluentui/react-icons";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-dark-mode";
import type { Order, OrderItem } from "@/lib/types";

import { brandLightTheme, brandDarkTheme } from "@/components/fluent/theme";
import { useSharedStyles } from "@/components/fluent/styles";
import { PageHeader } from "@/components/fluent/PageHeader";
import { SegmentedControl } from "@/components/fluent/SegmentedControl";
import { StatCard } from "@/components/fluent/StatCard";
import { EmptyState, LoadingState } from "@/components/fluent/EmptyState";

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

const popularColumns: TableColumnDefinition<PopularItem>[] = [
  createTableColumn<PopularItem>({
    columnId: "name",
    compare: (a, b) => a.name.localeCompare(b.name),
    renderHeaderCell: () => "Item",
    renderCell: (item) => <TableCellLayout truncate>{item.name}</TableCellLayout>,
  }),
  createTableColumn<PopularItem>({
    columnId: "qty",
    compare: (a, b) => a.qty - b.qty,
    renderHeaderCell: () => "Qty sold",
    renderCell: (item) => `${item.qty}×`,
  }),
  createTableColumn<PopularItem>({
    columnId: "revenue",
    compare: (a, b) => a.revenue - b.revenue,
    renderHeaderCell: () => "Revenue",
    renderCell: (item) => formatPeso(item.revenue),
  }),
];

export default function DashboardPage() {
  const isDark = useIsDarkMode();
  return (
    <FluentProvider theme={isDark ? brandDarkTheme : brandLightTheme} style={{ backgroundColor: "transparent" }}>
      <DashboardContent />
    </FluentProvider>
  );
}

function DashboardContent() {
  const supabase = createClient();
  const isDark = useIsDarkMode();
  const styles = useSharedStyles();
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
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXL }}>
      <PageHeader
        title="Sales Reports"
        subtitle="Revenue and menu performance for Fedelicious Wings."
        action={
          <SegmentedControl ariaLabel="Date range" options={RANGE_OPTIONS} value={rangeDays} onChange={setRangeDays} />
        }
      />

      {loading ? (
        <LoadingState label="Loading report…" />
      ) : (
        <>
          <div className={styles.statGrid}>
            <StatCard label="Total revenue" value={formatPeso(totalRevenue)} valueColor={tokens.colorBrandForeground1} />
            <StatCard label="Orders" value={String(orders.length)} />
            <StatCard
              label="Average order value"
              value={formatPeso(orders.length ? totalRevenue / orders.length : 0)}
            />
          </div>

          <Card size="large" className={styles.card}>
            <CardHeader
              image={<DataBarVerticalRegular fontSize={20} style={{ color: tokens.colorBrandForeground1 }} />}
              header={<Title3>Revenue by day</Title3>}
            />
            {revenueByDay.length === 0 ? (
              <EmptyState icon={DataBarVerticalRegular} message="No revenue in this period yet." />
            ) : (
              <div style={{ height: 260, paddingTop: tokens.spacingVerticalM }}>
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

          <Card size="large" className={styles.card}>
            <CardHeader
              image={<FoodRegular fontSize={20} style={{ color: tokens.colorBrandForeground1 }} />}
              header={<Title3>Popular items</Title3>}
            />
            {popularItems.length === 0 ? (
              <EmptyState icon={FoodRegular} message="No sales in this period yet." />
            ) : (
              <div style={{ paddingTop: tokens.spacingVerticalM }}>
                <DataGrid items={popularItems} columns={popularColumns} sortable getRowId={(item) => item.name} size="small">
                  <DataGridHeader>
                    <DataGridRow>
                      {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
                    </DataGridRow>
                  </DataGridHeader>
                  <DataGridBody<PopularItem>>
                    {({ item, rowId }) => (
                      <DataGridRow<PopularItem> key={rowId}>
                        {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
                      </DataGridRow>
                    )}
                  </DataGridBody>
                </DataGrid>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
