"use client";

import { ToggleButton } from "@fluentui/react-components";
import { useSharedStyles } from "./styles";

// One reusable pill-button group for every range/granularity/half-month
// picker in the admin area — ToggleButton already carries the right
// pressed/hover/focus states and picks up the brand color from the theme
// automatically instead of a hardcoded `bg-ember-500`.
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const styles = useSharedStyles();
  return (
    <div className={styles.segmented} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <ToggleButton
          key={String(opt.value)}
          size="small"
          appearance={value === opt.value ? "primary" : "subtle"}
          checked={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </ToggleButton>
      ))}
    </div>
  );
}
