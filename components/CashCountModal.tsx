"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";

export default function CashCountModal({
  cashierId,
  clockIn,
  onConfirm,
  onCancel,
}: {
  cashierId: string;
  clockIn: string;
  onConfirm: (result: { expected: number; counted: number }) => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [expected, setExpected] = useState<number | null>(null);
  const [counted, setCounted] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("orders")
      .select("total")
      .eq("cashier_id", cashierId)
      .eq("payment_method", "cash")
      .neq("status", "cancelled")
      .gte("created_at", clockIn)
      .then(({ data }) => {
        const sum = (data ?? []).reduce((s, o) => s + Number(o.total), 0);
        setExpected(sum);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashierId, clockIn]);

  const countedNum = Number(counted || 0);
  const diff = expected != null ? countedNum - expected : 0;

  function handleConfirm() {
    if (expected == null) return;
    setSubmitting(true);
    onConfirm({ expected, counted: countedNum });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-card bg-white dark:bg-char-900 p-6 shadow-xl">
        <h2 className="mb-1 font-display text-lg font-semibold text-char-900 dark:text-cream">
          End-of-shift cash count
        </h2>
        <p className="mb-4 text-sm text-char-700/70 dark:text-cream/70">
          Count the drawer before clocking out.
        </p>

        {expected == null ? (
          <p className="text-sm text-char-700/60 dark:text-cream/60">Calculating expected cash…</p>
        ) : (
          <>
            <div className="mb-3 flex justify-between rounded-md bg-char-800/5 dark:bg-cream/5 px-3 py-2 text-sm">
              <span className="text-char-700/70 dark:text-cream/70">Expected cash sales</span>
              <span className="font-semibold text-char-900 dark:text-cream">
                {formatPeso(expected)}
              </span>
            </div>

            <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
              Counted amount in drawer
            </label>
            <input
              autoFocus
              type="number"
              min="0"
              step="0.01"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              className="mb-3 w-full rounded-md border border-char-700/20 dark:border-cream/15 px-3 py-2 focus:border-ember-500 focus:outline-none"
              placeholder="0.00"
            />

            {counted && (
              <div
                className={`mb-4 flex justify-between rounded-md px-3 py-2 text-sm ${
                  diff === 0
                    ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-ember-50 dark:bg-ember-500/15 text-ember-700 dark:text-ember-300"
                }`}
              >
                <span>{diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short"}</span>
                <span className="font-semibold">{formatPeso(Math.abs(diff))}</span>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-char-700 dark:text-cream/80 hover:bg-char-800/5 dark:hover:bg-cream/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={expected == null || counted === "" || submitting}
            className="rounded-md bg-ember-500 px-4 py-2 font-medium text-white hover:bg-ember-600 disabled:opacity-60"
          >
            {submitting ? "Signing out…" : "Confirm & sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
