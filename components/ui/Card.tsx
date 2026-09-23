"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

export function Card({
  children,
  className,
  padding = "md",
  interactive,
}: {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
  interactive?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-card border border-char-700/10 bg-white shadow-card dark:border-cream/10 dark:bg-char-900 dark:shadow-card-dark",
        padding === "md" && "p-5",
        padding === "sm" && "p-3.5",
        interactive && "transition-shadow hover:shadow-card-lg dark:hover:shadow-card-lg-dark",
        className
      )}
    >
      {children}
    </div>
  );
}

// Mirrors the "icon + title + description + trailing action" header block
// used throughout the admin pages, so migrating off Fluent's CardHeader is
// a near 1:1 prop swap.
export function CardHeader({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="mt-0.5 shrink-0 text-ember-600 dark:text-ember-400">{icon}</span>}
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-char-900 dark:text-cream">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-sm text-char-700/60 dark:text-cream/60">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
