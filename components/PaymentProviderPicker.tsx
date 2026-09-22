"use client";

import { useEffect, useMemo, useState } from "react";
import { PAYMENT_PROVIDERS } from "@/lib/payment-providers";

export default function PaymentProviderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const isKnownProvider = (PAYMENT_PROVIDERS as readonly string[]).includes(value);
  // "Other" mode is active either because the current value isn't one of the
  // presets, or the cashier explicitly picked "Other".
  const [otherMode, setOtherMode] = useState(!!value && !isKnownProvider);
  // The search box's own text is tracked separately from `value` (the
  // committed selection) — otherwise a controlled input showing `value`
  // can't be typed over once something's already selected.
  const [inputText, setInputText] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setInputText(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = inputText.trim().toLowerCase();
    if (!q || q === value.toLowerCase()) return PAYMENT_PROVIDERS;
    return PAYMENT_PROVIDERS.filter((p) => p.toLowerCase().includes(q));
  }, [inputText, value]);

  if (otherMode) {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-medium text-char-700/70">
            Bank / e-wallet (typed manually)
          </label>
          <button
            type="button"
            onClick={() => {
              setOtherMode(false);
              onChange("");
              setInputText("");
            }}
            className="text-xs text-ember-600 hover:underline"
          >
            Search instead
          </button>
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. PayPal, Alipay, WeChat Pay…"
          className="w-full rounded-md border border-char-700/20 px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-char-700/70">
        Bank / e-wallet used
      </label>
      <input
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value);
          if (value) onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search GCash, Maya, BDO…"
        className="w-full rounded-md border border-char-700/20 px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-char-700/20 bg-white shadow-lg">
          {filtered.map((p) => (
            <button
              key={p}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p);
                setInputText(p);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-char-800/5 ${
                value === p ? "bg-ember-50 text-ember-700" : "text-char-800"
              }`}
            >
              {p}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-1.5 text-sm text-char-700/50">No matches.</p>
          )}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setOtherMode(true);
              onChange("");
              setInputText("");
              setOpen(false);
            }}
            className="block w-full border-t border-char-700/10 px-3 py-1.5 text-left text-sm font-medium text-ember-600 hover:bg-ember-50"
          >
            Other (type it in)
          </button>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-0" onMouseDown={() => setOpen(false)} />
      )}
    </div>
  );
}
