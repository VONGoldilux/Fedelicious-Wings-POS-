"use client";

import { cx } from "@/lib/utils";

// A real toggle switch, sized for touch — the button's own hit area is 44px
// tall even though the visible track is slimmer, rather than a text button
// that flips between "Mark unavailable"/"Mark available".
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50"
    >
      <span
        className={cx(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-green-500" : "bg-char-700/25 dark:bg-cream/25"
        )}
      >
        <span
          aria-hidden
          className={cx(
            "inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-[1.375rem]"
          )}
        />
      </span>
    </button>
  );
}
