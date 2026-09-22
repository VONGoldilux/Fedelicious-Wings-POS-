"use client";

import { Card, Caption1, Title2, Badge, type BadgeProps, tokens } from "@fluentui/react-components";
import type { FluentIcon } from "@fluentui/react-icons";
import { useSharedStyles } from "./styles";

// The "uppercase label + big number" card used for every glance-able metric
// across Dashboard, Transactions, and Payroll — first established in the
// Analytics redesign's channel/payment stat rows.
export function StatCard({
  label,
  value,
  valueColor,
  icon: Icon,
  badge,
}: {
  label: string;
  value: string;
  /** Design token string, e.g. tokens.colorBrandForeground1, to emphasize a value (revenue, totals). */
  valueColor?: string;
  icon?: FluentIcon;
  badge?: { text: string; color?: BadgeProps["color"] };
}) {
  const styles = useSharedStyles();
  return (
    <Card size="large" className={styles.card}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: tokens.spacingHorizontalS }}>
        <div style={{ minWidth: 0 }}>
          <Caption1
            style={{
              color: tokens.colorNeutralForeground3,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
            }}
            block
          >
            {label}
          </Caption1>
          <Title2 block style={{ marginTop: tokens.spacingVerticalXXS, color: valueColor }}>
            {value}
          </Title2>
        </div>
        {Icon && <Icon fontSize={20} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />}
      </div>
      {badge && (
        <div style={{ marginTop: tokens.spacingVerticalS }}>
          <Badge appearance="tint" color={badge.color ?? "warning"} shape="rounded">
            {badge.text}
          </Badge>
        </div>
      )}
    </Card>
  );
}
