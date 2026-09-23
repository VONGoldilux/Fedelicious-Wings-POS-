"use client";

import { cx } from "@/lib/utils";

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-lg border border-char-700/15 bg-char-800/[0.04] p-1 dark:border-cream/15 dark:bg-cream/5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cx(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
              active
                ? "bg-ember-500 text-white shadow-sm"
                : "text-char-700/70 hover:bg-char-800/10 dark:text-cream/70 dark:hover:bg-cream/10"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
