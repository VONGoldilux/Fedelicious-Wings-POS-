"use client";

import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, Title3, Body1Strong, Caption1, Text, Badge, tokens } from "@fluentui/react-components";
import type { FluentIcon } from "@fluentui/react-icons";
import { formatPeso } from "@/lib/utils";
import { useIsDarkMode } from "@/lib/use-dark-mode";
import { useSharedStyles } from "@/components/fluent/styles";
import { EmptyState, LoadingState } from "@/components/fluent/EmptyState";

export interface DonutMetricItem {
  key: string;
  label: string;
  count: number;
  revenue: number;
  color: string;
  Icon: FluentIcon;
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
  HeaderIcon: FluentIcon;
  items: DonutMetricItem[];
  loading: boolean;
  emptyLabel: string;
}) {
  const styles = useSharedStyles();
  const isDark = useIsDarkMode();
  const totalRevenue = items.reduce((sum, i) => sum + i.revenue, 0);
  const totalCount = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <Card size="large" className={styles.card}>
      <CardHeader
        image={<HeaderIcon fontSize={20} style={{ color: tokens.colorBrandForeground1 }} />}
        header={<Title3>{title}</Title3>}
        description={
          <Caption1>
            {totalCount} order{totalCount === 1 ? "" : "s"} total
          </Caption1>
        }
      />

      {loading ? (
        <LoadingState />
      ) : totalRevenue === 0 ? (
        <EmptyState icon={HeaderIcon} message={emptyLabel} />
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: tokens.spacingHorizontalXL,
            paddingTop: tokens.spacingVerticalM,
          }}
        >
          <div style={{ position: "relative", width: 168, height: 168, flexShrink: 0 }}>
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
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Total</Caption1>
              <Body1Strong>{formatPeso(totalRevenue)}</Body1Strong>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacingVerticalS,
              flex: "1 1 220px",
              minWidth: 200,
            }}
          >
            {items.map((item) => {
              const pct = totalRevenue ? Math.round((item.revenue / totalRevenue) * 100) : 0;
              return (
                <div key={item.key} style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <item.Icon fontSize={16} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text block>{item.label}</Text>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {item.count} order{item.count === 1 ? "" : "s"} · {formatPeso(item.revenue)}
                    </Caption1>
                  </div>
                  <Badge
                    appearance="tint"
                    shape="rounded"
                    style={{ backgroundColor: `${item.color}22`, color: item.color }}
                  >
                    {pct}%
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
