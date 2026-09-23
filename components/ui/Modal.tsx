"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

const MAX_WIDTH = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

// Shared overlay + panel shell for every dialog in the app (receipt, cancel
// order, cash count, delivery rider, etc.) — previously each modal
// duplicated this exact `fixed inset-0 flex items-center justify-center
// bg-black/50 p-4` wrapper on its own.
export function Modal({
  onClose,
  maxWidth = "sm",
  closeOnBackdrop = true,
  className,
  children,
}: {
  onClose?: () => void;
  maxWidth?: keyof typeof MAX_WIDTH;
  closeOnBackdrop?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 print:bg-white"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cx(
          "my-8 w-full rounded-card bg-white p-6 shadow-card-lg dark:bg-char-900 dark:shadow-card-lg-dark print:shadow-none",
          MAX_WIDTH[maxWidth],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
