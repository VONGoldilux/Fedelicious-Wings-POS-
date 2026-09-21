"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import type { Order, OrderItem } from "@/lib/types";

const RANGE_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
];

export default function DashboardPage() {
  const supabase = createClient();
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

  const popularItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
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
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900">
            Sales Reports
          </h1>
          <p className="text-sm text-char-700/70">
            Revenue and menu performance for Fedelicious Wings.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-char-700/20 bg-white p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setRangeDays(opt.days)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                rangeDays === opt.days
                  ? "bg-ember-500 text-white"
                  : "text-char-700/70 hover:bg-char-800/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-char-700/60">Loading report…</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total revenue" value={formatPeso(totalRevenue)} />
            <StatCard label="Orders" value={String(orders.length)} />
            <StatCard
              label="Average order value"
              value={formatPeso(orders.length ? totalRevenue / orders.length : 0)}
            />
          </div>

          <div className="mb-6 rounded-card border border-char-700/10 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-display font-semibold text-char-900">
              Revenue by day
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5decf" />
                  <XAxis dataKey="day" fontSize={12} stroke="#7a6a58" />
                  <YAxis fontSize={12} stroke="#7a6a58" />
                  <Tooltip formatter={(v: number) => formatPeso(v)} />
                  <Bar dataKey="revenue" fill="#F0662B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-card border border-char-700/10 bg-white p-5 shadow-sm">
            <h2 className="mb-4 font-display font-semibold text-char-900">
              Popular items
            </h2>
            <table className="w-full text-left text-sm">
              <thead className="text-char-700/60">
                <tr>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium">Qty sold</th>
                  <th className="pb-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {popularItems.map((it) => (
                  <tr key={it.name} className="border-t border-char-700/10">
                    <td className="py-2 text-char-900">{it.name}</td>
                    <td className="py-2">{it.qty}</td>
                    <td className="py-2">{formatPeso(it.revenue)}</td>
                  </tr>
                ))}
                {popularItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-char-700/50">
                      No sales in this period yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-char-700/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-char-700/50">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold text-char-900">
        {value}
      </p>
    </div>
  );
}
