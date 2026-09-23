"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function EmptyState({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-char-700/50 dark:text-cream/50">
      {icon}
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-char-700/50 dark:text-cream/50">
      <Loader2 className="animate-spin" size={20} />
      <p className="text-sm">{label}</p>
    </div>
  );
}
