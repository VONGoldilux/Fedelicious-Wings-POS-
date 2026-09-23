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
import { TrendingUp } from "lucide-react";
import { useIsDarkMode } from "@/lib/use-dark-mode";
import { GRANULARITY_OPTIONS, TREND_COLORS, type Granularity } from "./constants";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";

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
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <CardHeader icon={<TrendingUp size={18} />} title="Trending items" className="!mb-0" />
        <SegmentedControl
          ariaLabel="Trend granularity"
          options={GRANULARITY_OPTIONS}
          value={granularity}
          onChange={onGranularityChange}
          size="sm"
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : chartData.length === 0 ? (
        <EmptyState icon={<TrendingUp size={26} />} message="No sales in this window yet." />
      ) : (
        <div className="flex flex-wrap gap-5">
          <div className="min-w-0 flex-[3_1_480px]" style={{ height: 320 }}>
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
          <div className="flex min-w-[160px] flex-[1_1_180px] flex-col gap-2 border-l border-char-700/10 pl-5 dark:border-cream/10">
            <p className="text-xs text-char-700/50 dark:text-cream/50">Top sellers this period</p>
            {ranked.map((row, i) => (
              <div key={row.name} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: TREND_COLORS[i % TREND_COLORS.length] }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-char-800 dark:text-cream/90" title={row.name}>
                  {row.name}
                </span>
                <span className="shrink-0 font-semibold text-char-900 dark:text-cream">{row.qty}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
