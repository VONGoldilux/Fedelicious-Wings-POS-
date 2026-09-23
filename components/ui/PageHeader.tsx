"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-char-900 dark:text-cream">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-char-700/70 dark:text-cream/70">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
