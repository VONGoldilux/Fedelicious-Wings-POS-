"use client";

import { Badge, type BadgeProps } from "@fluentui/react-components";
import type { OrderStatus } from "@/lib/types";

// Consistent status-color conventions reused everywhere a status appears —
// order lifecycle, payroll paid/pending, staff active/deactivated — so
// "warning" always looks like the same mustard tint and "success" always
// looks like the same green, no matter which page it's on.
const ORDER_STATUS_COLOR: Record<OrderStatus, BadgeProps["color"]> = {
  completed: "success",
  cancelled: "danger",
  ready: "warning",
  preparing: "informative",
  queued: "informative",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge appearance="tint" shape="rounded" color={ORDER_STATUS_COLOR[status] ?? "informative"} style={{ textTransform: "capitalize" }}>
      {status}
    </Badge>
  );
}

export function PaidStatusBadge({ paid, label }: { paid: boolean; label: string }) {
  return paid ? (
    <Badge appearance="tint" color="success" shape="rounded">
      {label}
    </Badge>
  ) : (
    <Badge appearance="tint" color="warning" shape="rounded">
      {label}
    </Badge>
  );
}

export function ActiveStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge appearance="tint" color="success" shape="rounded">
      Active
    </Badge>
  ) : (
    <Badge appearance="tint" color="subtle" shape="rounded">
      Deactivated
    </Badge>
  );
}
