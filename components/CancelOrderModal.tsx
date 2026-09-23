"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

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
    <Modal onClose={onClose} maxWidth="sm">
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
        className="mb-4 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
        placeholder="e.g. Customer changed their mind, wrong order, out of stock"
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Never mind
        </Button>
        <Button variant="danger" onClick={handleConfirm} disabled={!reason.trim() || submitting} loading={submitting}>
          {submitting ? "Cancelling…" : "Cancel order"}
        </Button>
      </div>
    </Modal>
  );
}
