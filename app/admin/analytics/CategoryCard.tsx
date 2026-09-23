"use client";

import { formatPeso } from "@/lib/utils";
import type { CategoryItemStat } from "./constants";
import { Card, CardHeader } from "@/components/ui/Card";

const VISIBLE_COUNT = 6;

export function CategoryCard({
  category,
  sold,
  soldQty,
  soldRevenue,
}: {
  category: string;
  sold: CategoryItemStat[];
  soldQty: number;
  soldRevenue: number;
}) {
  const visible = sold.slice(0, VISIBLE_COUNT);
  const rest = sold.slice(VISIBLE_COUNT);
  const topQty = sold[0]?.qty ?? 0;

  return (
    <Card>
      <CardHeader
        title={category}
        description={sold.length > 0 ? `${soldQty}× · ${formatPeso(soldRevenue)}` : undefined}
      />

      {sold.length === 0 ? (
        <div className="py-6 text-center text-sm text-char-700/50 dark:text-cream/50">
          No sales in this window
        </div>
      ) : (
        <div className="mt-1 flex flex-col gap-1">
          {visible.map((item, i) => (
            <SoldRow key={item.productId} rank={i + 1} item={item} pct={topQty ? (item.qty / topQty) * 100 : 0} />
          ))}
          {rest.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer list-none text-xs font-semibold text-ember-600 dark:text-ember-400">
                +{rest.length} more sold
              </summary>
              <div className="mt-1 flex flex-col gap-1">
                {rest.map((item, i) => (
                  <SoldRow
                    key={item.productId}
                    rank={VISIBLE_COUNT + i + 1}
                    item={item}
                    pct={topQty ? (item.qty / topQty) * 100 : 0}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

function SoldRow({ rank, item, pct }: { rank: number; item: CategoryItemStat; pct: number }) {
  const width = Math.max(pct, 4);
  return (
    <div className="relative overflow-hidden rounded-md">
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 bg-ember-100 dark:bg-ember-500/20"
        style={{ width: `${width}%` }}
      />
      <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="w-4 shrink-0 text-xs text-char-700/50 dark:text-cream/50">{rank}</span>
          <span className="min-w-0 truncate text-sm text-char-800 dark:text-cream/90" title={item.name}>
            {item.name}
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-char-900 dark:text-cream">
          {item.qty}× · {formatPeso(item.revenue)}
        </span>
      </div>
    </div>
  );
}
