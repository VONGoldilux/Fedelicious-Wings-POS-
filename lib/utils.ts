export function formatPeso(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

// "gcash" displays as "E-Payment" everywhere — cash and e-payment are the
// only two methods the POS offers, but "card"/"other" survive as a display
// fallback for any pre-existing orders that used the old options.
export function paymentMethodLabel(method: string | null): string {
  if (!method) return "—";
  if (method === "gcash") return "E-Payment";
  if (method === "cash") return "Cash";
  return method.charAt(0).toUpperCase() + method.slice(1);
}
