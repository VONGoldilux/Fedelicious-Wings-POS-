"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export default function SetDeliveryRiderModal({
  orderNumber,
  currentName,
  onConfirm,
  onClose,
}: {
  orderNumber: number;
  currentName: string | null;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(currentName ?? "");
  const [submitting, setSubmitting] = useState(false);

  function handleConfirm() {
    if (!name.trim()) return;
    setSubmitting(true);
    onConfirm(name.trim());
  }

  return (
    <Modal onClose={onClose} maxWidth="sm">
      <h2 className="mb-1 font-display text-lg font-semibold text-char-900 dark:text-cream">
        Delivery rider — order #{orderNumber}
      </h2>
      <p className="mb-4 text-sm text-char-700/70 dark:text-cream/70">
        Who's delivering this order? This is recorded as proof of handoff.
      </p>

      <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
        Rider name
      </label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-4 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
        placeholder="e.g. Juan dela Cruz"
      />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!name.trim() || submitting} loading={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
