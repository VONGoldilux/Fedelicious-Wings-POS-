"use client";

import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

export type BadgeColor = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

const COLOR_CLASSES: Record<BadgeColor, string> = {
  brand: "bg-ember-50 text-ember-700 dark:bg-ember-500/15 dark:text-ember-300",
  success: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  warning: "bg-mustard-400/20 text-mustard-500 dark:bg-mustard-500/20 dark:text-mustard-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  info: "bg-char-800/10 text-char-700 dark:bg-cream/10 dark:text-cream/80",
  neutral: "bg-char-800/10 text-char-700 dark:bg-cream/10 dark:text-cream/80",
};

export function Badge({
  children,
  color = "neutral",
  className,
  style,
}: {
  children: ReactNode;
  color?: BadgeColor;
  className?: string;
  /** Escape hatch for a per-series computed color (e.g. a chart legend swatch) that doesn't map to the fixed semantic palette above. */
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        COLOR_CLASSES[color],
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
}

const ORDER_STATUS_COLOR: Record<OrderStatus, BadgeColor> = {
  completed: "success",
  cancelled: "danger",
  ready: "warning",
  preparing: "info",
  queued: "info",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge color={ORDER_STATUS_COLOR[status] ?? "info"} className="capitalize">
      {status}
    </Badge>
  );
}

export function PaidStatusBadge({ paid, label }: { paid: boolean; label: string }) {
  return <Badge color={paid ? "success" : "warning"}>{label}</Badge>;
}

export function ActiveStatusBadge({ active }: { active: boolean }) {
  return <Badge color={active ? "success" : "neutral"}>{active ? "Active" : "Deactivated"}</Badge>;
}
