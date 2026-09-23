"use client";

import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import type { LucideIcon } from "lucide-react";
import { formatPeso } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-dark-mode";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";

export interface DonutMetricItem {
  key: string;
  label: string;
  count: number;
  revenue: number;
  color: string;
  Icon: LucideIcon;
}

const RADIAN = Math.PI / 180;

// Renders the % directly on the ring itself (recharts custom Pie label).
// recharts' own label-render prop types are a loose union that doesn't line
// up with the actual props it hands back at runtime, so this narrows to just
// the fields used rather than fighting the library's types.
function renderRingLabel(props: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (percent < 0.06) return null; // slice too thin to label without clutter
  const radius = innerRadius + (outerRadius - innerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      fontWeight={700}
      fill="#FFFFFF"
      paintOrder="stroke"
      stroke="rgba(0,0,0,0.35)"
      strokeWidth={3}
      strokeLinejoin="round"
    >
      {Math.round(percent * 100)}%
    </text>
  );
}

export function MetricDonutCard({
  title,
  HeaderIcon,
  items,
  loading,
  emptyLabel,
}: {
  title: string;
  HeaderIcon: LucideIcon;
  items: DonutMetricItem[];
  loading: boolean;
  emptyLabel: string;
}) {
  const isDark = useIsDarkMode();
  const totalRevenue = items.reduce((sum, i) => sum + i.revenue, 0);
  const totalCount = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <Card>
      <CardHeader
        icon={<HeaderIcon size={18} />}
        title={title}
        description={`${totalCount} order${totalCount === 1 ? "" : "s"} total`}
      />

      {loading ? (
        <LoadingState />
      ) : totalRevenue === 0 ? (
        <EmptyState icon={<HeaderIcon size={26} />} message={emptyLabel} />
      ) : (
        <div className="flex flex-wrap items-center gap-6 pt-2">
          <div className="relative h-[168px] w-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  dataKey="revenue"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="none"
                  label={renderRingLabel}
                  labelLine={false}
                  isAnimationActive={false}
                >
                  {items.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(v: number) => formatPeso(v)}
                  contentStyle={{
                    background: isDark ? "#241D18" : "#fff",
                    border: `1px solid ${isDark ? "#463830" : "#e5decf"}`,
                    color: isDark ? "#FBF4EA" : "#241D18",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-char-700/50 dark:text-cream/50">Total</span>
              <span className="font-semibold text-char-900 dark:text-cream">{formatPeso(totalRevenue)}</span>
            </div>
          </div>

          <div className="flex min-w-[200px] flex-1 flex-col gap-2.5">
            {items.map((item) => {
              const pct = totalRevenue ? Math.round((item.revenue / totalRevenue) * 100) : 0;
              return (
                <div key={item.key} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <item.Icon size={16} className="shrink-0 text-char-700/50 dark:text-cream/50" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-char-900 dark:text-cream">{item.label}</p>
                    <p className="text-xs text-char-700/50 dark:text-cream/50">
                      {item.count} order{item.count === 1 ? "" : "s"} · {formatPeso(item.revenue)}
                    </p>
                  </div>
                  <Badge style={{ backgroundColor: `${item.color}22`, color: item.color }}>{pct}%</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
