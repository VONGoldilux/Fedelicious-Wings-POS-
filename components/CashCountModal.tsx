"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

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
    <Modal onClose={onCancel} maxWidth="sm" closeOnBackdrop={false}>
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
          <div className="mb-3 flex justify-between rounded-md bg-char-800/5 px-3 py-2 text-sm dark:bg-cream/5">
            <span className="text-char-700/70 dark:text-cream/70">Expected cash sales</span>
            <span className="font-semibold text-char-900 dark:text-cream">{formatPeso(expected)}</span>
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
            className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
            placeholder="0.00"
          />

          {counted && (
            <div
              className={`mb-4 flex justify-between rounded-md px-3 py-2 text-sm ${
                diff === 0
                  ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                  : "bg-ember-50 text-ember-700 dark:bg-ember-500/15 dark:text-ember-300"
              }`}
            >
              <span>{diff === 0 ? "Balanced" : diff > 0 ? "Over" : "Short"}</span>
              <span className="font-semibold">{formatPeso(Math.abs(diff))}</span>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={expected == null || counted === "" || submitting}
          loading={submitting}
        >
          {submitting ? "Signing out…" : "Confirm & sign out"}
        </Button>
      </div>
    </Modal>
  );
}
