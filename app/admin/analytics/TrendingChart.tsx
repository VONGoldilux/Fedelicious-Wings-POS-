"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, Title3, Text, Body1Strong, Caption1, tokens } from "@fluentui/react-components";
import { ArrowTrendingRegular } from "@fluentui/react-icons";
import { useIsDarkMode } from "@/lib/use-dark-mode";
import { GRANULARITY_OPTIONS, TREND_COLORS, type Granularity } from "./constants";
import { SegmentedControl } from "@/components/fluent/SegmentedControl";
import { useSharedStyles } from "@/components/fluent/styles";
import { EmptyState, LoadingState } from "@/components/fluent/EmptyState";

export function TrendingChart({
  chartData,
  topProductNames,
  granularity,
  onGranularityChange,
  loading,
}: {
  chartData: Record<string, number | string>[];
  topProductNames: string[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  loading: boolean;
}) {
  const styles = useSharedStyles();
  const isDark = useIsDarkMode();
  const gridColor = isDark ? "#463830" : "#e5decf";
  const axisColor = isDark ? "#c9bfae" : "#7a6a58";
  const tooltipStyle = {
    background: isDark ? "#241D18" : "#fff",
    border: `1px solid ${gridColor}`,
    color: isDark ? "#FBF4EA" : "#241D18",
  };

  // Ranked leaderboard for the docked side panel — summed straight from the
  // same bucketed rows the chart draws, so it can't drift from what's plotted.
  const ranked = useMemo(() => {
    const totals = new Map<string, number>();
    for (const name of topProductNames) totals.set(name, 0);
    for (const row of chartData) {
      for (const name of topProductNames) {
        const v = row[name];
        if (typeof v === "number") totals.set(name, (totals.get(name) ?? 0) + v);
      }
    }
    return topProductNames
      .map((name) => ({ name, qty: totals.get(name) ?? 0 }))
      .sort((a, b) => b.qty - a.qty);
  }, [chartData, topProductNames]);

  return (
    <Card size="large" className={styles.card}>
      <div className={styles.sectionHeaderRow}>
        <CardHeader
          image={<ArrowTrendingRegular fontSize={20} style={{ color: tokens.colorBrandForeground1 }} />}
          header={<Title3>Trending items</Title3>}
        />
        <SegmentedControl
          ariaLabel="Trend granularity"
          options={GRANULARITY_OPTIONS}
          value={granularity}
          onChange={onGranularityChange}
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : chartData.length === 0 ? (
        <EmptyState icon={ArrowTrendingRegular} message="No sales in this window yet." />
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalL }}>
          <div style={{ flex: "3 1 480px", height: 320, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="bucket" fontSize={12} stroke={axisColor} />
                <YAxis fontSize={12} stroke={axisColor} allowDecimals={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                {topProductNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={TREND_COLORS[i % TREND_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Docked ranked panel — sits beside the chart instead of overlaying it. */}
          <div
            style={{
              flex: "1 1 180px",
              minWidth: 160,
              borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
              paddingLeft: tokens.spacingHorizontalL,
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacingVerticalS,
            }}
          >
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Top sellers this period</Caption1>
            {ranked.map((row, i) => (
              <div key={row.name} style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    backgroundColor: TREND_COLORS[i % TREND_COLORS.length],
                  }}
                >
                  {i + 1}
                </span>
                <Text truncate style={{ minWidth: 0, flex: 1 }} title={row.name}>
                  {row.name}
                </Text>
                <Body1Strong style={{ flexShrink: 0 }}>{row.qty}×</Body1Strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
