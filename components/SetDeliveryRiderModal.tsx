"use client";

import { useState } from "react";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-card bg-white dark:bg-char-900 p-6 shadow-xl"
      >
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
          className="mb-4 w-full rounded-md border border-char-700/20 dark:border-cream/15 px-3 py-2 focus:border-ember-500 focus:outline-none"
          placeholder="e.g. Juan dela Cruz"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-char-700 dark:text-cream/80 hover:bg-char-800/5 dark:hover:bg-cream/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!name.trim() || submitting}
            className="rounded-md bg-ember-500 px-4 py-2 font-medium text-white hover:bg-ember-600 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
