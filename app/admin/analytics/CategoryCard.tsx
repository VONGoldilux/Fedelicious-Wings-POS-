"use client";

import { Card, CardHeader, Title3, Caption1, Text, tokens } from "@fluentui/react-components";
import { formatPeso } from "@/lib/utils";
import type { CategoryItemStat } from "./constants";
import { useSharedStyles } from "@/components/fluent/styles";

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
  const styles = useSharedStyles();
  const visible = sold.slice(0, VISIBLE_COUNT);
  const rest = sold.slice(VISIBLE_COUNT);
  const topQty = sold[0]?.qty ?? 0;

  return (
    <Card size="large" className={styles.card}>
      <CardHeader
        header={<Title3>{category}</Title3>}
        description={
          sold.length > 0 ? (
            <Caption1>
              {soldQty}× · {formatPeso(soldRevenue)}
            </Caption1>
          ) : undefined
        }
      />

      {sold.length === 0 ? (
        <div className={styles.emptyState}>
          <Text>No sales in this window</Text>
        </div>
      ) : (
        <div style={{ marginTop: tokens.spacingVerticalS, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS }}>
          {visible.map((item, i) => (
            <SoldRow key={item.productId} rank={i + 1} item={item} pct={topQty ? (item.qty / topQty) * 100 : 0} />
          ))}
          {rest.length > 0 && (
            <details style={{ marginTop: tokens.spacingVerticalXXS }}>
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  fontSize: tokens.fontSizeBase200,
                  fontWeight: tokens.fontWeightSemibold,
                  color: tokens.colorBrandForeground1,
                }}
              >
                +{rest.length} more sold
              </summary>
              <div style={{ marginTop: tokens.spacingVerticalXXS, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS }}>
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
    <div style={{ position: "relative", overflow: "hidden", borderRadius: tokens.borderRadiusMedium }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: `${width}%`,
          backgroundColor: tokens.colorBrandBackground2,
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.spacingHorizontalM,
          padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        }}
      >
        <span style={{ display: "flex", minWidth: 0, alignItems: "center", gap: tokens.spacingHorizontalS }}>
          <Caption1 style={{ width: 16, flexShrink: 0, color: tokens.colorNeutralForeground3 }}>{rank}</Caption1>
          <Text truncate style={{ minWidth: 0 }} title={item.name}>
            {item.name}
          </Text>
        </span>
        <Text weight="medium" style={{ flexShrink: 0 }}>
          {item.qty}× · {formatPeso(item.revenue)}
        </Text>
      </div>
    </div>
  );
}
