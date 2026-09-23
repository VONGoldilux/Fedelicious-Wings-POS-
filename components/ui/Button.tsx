"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

// Every size hits (or clears) the 44px touch-target minimum — "sm" is the
// one exception, reserved for dense admin-table row actions that sit next
// to other controls, never for anything tapped on a register/tablet.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-11 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-5 text-base gap-2 rounded-lg",
  xl: "h-14 px-6 text-lg gap-2.5 rounded-lg",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-ember-500 text-white hover:bg-ember-600 disabled:hover:bg-ember-500",
  secondary:
    "bg-char-800/[0.06] text-char-800 hover:bg-char-800/10 dark:bg-cream/10 dark:text-cream dark:hover:bg-cream/15",
  outline:
    "border border-char-700/20 text-char-700 hover:border-ember-500 hover:text-ember-600 dark:border-cream/15 dark:text-cream/80 dark:hover:border-ember-500 dark:hover:text-ember-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:hover:bg-red-600",
  ghost:
    "text-char-700 hover:bg-char-800/5 dark:text-cream/80 dark:hover:bg-cream/5",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth,
      loading,
      icon,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cx(
          "inline-flex items-center justify-center whitespace-nowrap font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          SIZE_CLASSES[size],
          VARIANT_CLASSES[variant],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="animate-spin" size={size === "xl" || size === "lg" ? 18 : 15} />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
