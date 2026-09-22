"use client";

import { useState } from "react";

export default function CancelOrderModal({
  orderNumber,
  onConfirm,
  onClose,
}: {
  orderNumber: number;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleConfirm() {
    if (!reason.trim()) return;
    setSubmitting(true);
    onConfirm(reason.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card bg-white dark:bg-char-900 p-6 shadow-xl"
      >
        <h2 className="mb-1 font-display text-lg font-semibold text-char-900 dark:text-cream">
          Cancel order #{orderNumber}
        </h2>
        <p className="mb-4 text-sm text-char-700/70 dark:text-cream/70">
          This can't be undone. A reason is required for reporting.
        </p>

        <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
          Reason
        </label>
        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mb-4 w-full rounded-md border border-char-700/20 dark:border-cream/15 px-3 py-2 focus:border-ember-500 focus:outline-none"
          placeholder="e.g. Customer changed their mind, wrong order, out of stock"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-char-700 dark:text-cream/80 hover:bg-char-800/5 dark:hover:bg-cream/5"
          >
            Never mind
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!reason.trim() || submitting}
            className="rounded-md bg-ember-600 px-4 py-2 font-medium text-white hover:bg-ember-700 disabled:opacity-60"
          >
            {submitting ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      </div>
    </div>
  );
}
