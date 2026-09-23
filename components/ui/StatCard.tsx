"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/utils";
import { Card } from "./Card";
import { Badge, type BadgeColor } from "./Badge";

export function StatCard({
  label,
  value,
  valueClassName,
  icon,
  badge,
}: {
  label: string;
  value: string;
  /** Tailwind text-color class(es) to emphasize the value, e.g. "text-ember-600 dark:text-ember-400". */
  valueClassName?: string;
  icon?: ReactNode;
  badge?: { text: string; color?: BadgeColor };
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-char-700/50 dark:text-cream/50">
            {label}
          </p>
          <p
            className={cx(
              "mt-1 font-display text-2xl font-semibold",
              valueClassName ?? "text-char-900 dark:text-cream"
            )}
          >
            {value}
          </p>
        </div>
        {icon && <span className="shrink-0 text-char-700/40 dark:text-cream/40">{icon}</span>}
      </div>
      {badge && (
        <div className="mt-3">
          <Badge color={badge.color ?? "warning"}>{badge.text}</Badge>
        </div>
      )}
    </Card>
  );
}
