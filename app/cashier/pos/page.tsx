"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatPeso } from "@/lib/utils";
import ReceiptModal from "@/components/ReceiptModal";
import { WEEKDAYS } from "@/lib/types";
import type { CartLine, Order, PaymentMethod, Product, Promotion } from "@/lib/types";

// ---------------------------------------------------------------------------
// Promo eligibility + discount math. A promo is "eligible" for the current
// cart when today falls in its date range/valid days AND the cart actually
// satisfies its trigger condition (has the scoped/required item(s)).
// ---------------------------------------------------------------------------
function isPromoDateActive(promo: Promotion): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today < promo.start_date || today > promo.end_date) return false;
  if (promo.valid_days && promo.valid_days.length > 0) {
    const todayName = WEEKDAYS[(new Date().getDay() + 6) % 7]; // Mon=0..Sun=6
    if (!promo.valid_days.includes(todayName)) return false;
  }
  return true;
}

function isPromoEligible(promo: Promotion, cart: CartLine[]): boolean {
  if (!promo.is_active || !isPromoDateActive(promo)) return false;

  if (promo.promo_type === "discount_percentage" || promo.promo_type === "discount_flat") {
    const scopeId = promo.required_items[0]?.product_id;
    return scopeId ? cart.some((l) => l.product.id === scopeId) : cart.length > 0;
  }
  if (promo.promo_type === "free_item") {
    const req = promo.required_items[0];
    if (!req) return false;
    const line = cart.find((l) => l.product.id === req.product_id);
    return !!line && line.quantity >= req.quantity;
  }
  if (promo.promo_type === "bundle") {
    return promo.reward_items.every((r) =>
      cart.some((l) => l.product.id === r.product_id)
    );
  }
  return false;
}

function computeDiscount(promo: Promotion, cart: CartLine[], subtotal: number): number {
  if (promo.promo_type === "discount_percentage") {
    const scopeId = promo.required_items[0]?.product_id;
    const base = scopeId
      ? cart
          .filter((l) => l.product.id === scopeId)
          .reduce((s, l) => s + l.product.price * l.quantity, 0)
      : subtotal;
    return Math.round(base * ((promo.discount_value ?? 0) / 100) * 100) / 100;
  }
  if (promo.promo_type === "discount_flat") {
    const scopeId = promo.required_items[0]?.product_id;
    const base = scopeId
      ? cart
          .filter((l) => l.product.id === scopeId)
          .reduce((s, l) => s + l.product.price * l.quantity, 0)
      : subtotal;
    return Math.min(promo.discount_value ?? 0, base);
  }
  if (promo.promo_type === "bundle") {
    const normalTotal = promo.reward_items.reduce((sum, r) => {
      const line = cart.find((l) => l.product.id === r.product_id);
      return sum + (line ? line.product.price : 0);
    }, 0);
    return Math.max(0, normalTotal - (promo.bundle_price ?? 0));
  }
  return 0; // free_item: handled as a ₱0 bonus line, not a subtotal discount
}

export default function CashierPOSPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [readyAlerts, setReadyAlerts] = useState<Order[]>([]);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);

  // ---- Load menu -----------------------------------------------------
  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("is_available", true)
      .order("category")
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load active promos ---------------------------------------------
  useEffect(() => {
    supabase
      .from("promotions")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => setPromotions((data as Promotion[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Realtime: notify cashier when kitchen marks an order "ready" --
  useEffect(() => {
    const channel = supabase
      .channel("cashier-order-ready")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as Order;
          if (updated.status === "ready") {
            setReadyAlerts((prev) =>
              prev.some((o) => o.id === updated.id) ? prev : [updated, ...prev]
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissAlert(orderId: string) {
    setReadyAlerts((prev) => prev.filter((o) => o.id !== orderId));
  }

  async function completeOrder(orderId: string) {
    await supabase
      .from("orders")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", orderId);
    dismissAlert(orderId);
  }

  // ---- Cart helpers ----------------------------------------------------
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const visibleProducts = useMemo(() => {
    const byCategory =
      category === "All" ? products : products.filter((p) => p.category === category);
    const q = search.trim().toLowerCase();
    if (!q) return byCategory;
    return byCategory.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, category, search]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.product.id === productId
            ? { ...l, quantity: l.quantity + delta }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const subtotal = cart.reduce(
    (sum, l) => sum + l.product.price * l.quantity,
    0
  );

  const eligiblePromos = useMemo(
    () => promotions.filter((p) => isPromoEligible(p, cart)),
    [promotions, cart]
  );

  // Drop the selected promo the moment the cart no longer qualifies for it
  // (e.g. cashier removed the triggering item).
  useEffect(() => {
    if (selectedPromoId && !eligiblePromos.some((p) => p.id === selectedPromoId)) {
      setSelectedPromoId(null);
    }
  }, [eligiblePromos, selectedPromoId]);

  const selectedPromo = eligiblePromos.find((p) => p.id === selectedPromoId) ?? null;
  const discountAmount = selectedPromo
    ? computeDiscount(selectedPromo, cart, subtotal)
    : 0;
  const freeBonus =
    selectedPromo?.promo_type === "free_item" ? selectedPromo.reward_items[0] : null;

  const total = Math.max(0, subtotal - discountAmount);
  const change =
    paymentMethod === "cash" && tendered
      ? Math.max(0, Number(tendered) - total)
      : 0;

  async function checkout() {
    if (cart.length === 0 || !profile) return;
    if (paymentMethod === "cash" && Number(tendered || 0) < total) return;

    setPaying(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          status: "queued",
          subtotal,
          discount_amount: discountAmount,
          total,
          payment_method: paymentMethod,
          amount_tendered: paymentMethod === "cash" ? Number(tendered) : total,
          change_due: paymentMethod === "cash" ? change : 0,
          cashier_id: profile.id,
          promo_id: selectedPromo?.id ?? null,
          promo_name: selectedPromo?.name ?? null,
        })
        .select("id, order_number")
        .single();

      if (orderError || !order) throw orderError;

      const lineItems = cart.map((l) => ({
        order_id: order.id,
        product_id: l.product.id,
        product_name: l.product.name,
        unit_price: l.product.price,
        quantity: l.quantity,
      }));

      // A "free item" promo adds its reward as its own ₱0 line, rather than
      // adjusting subtotal — that way receipts/kitchen tickets show exactly
      // what to hand over instead of a bare discount figure.
      if (freeBonus) {
        lineItems.push({
          order_id: order.id,
          product_id: freeBonus.product_id,
          product_name: `${freeBonus.product_name} (Free — ${selectedPromo?.name})`,
          unit_price: 0,
          quantity: freeBonus.quantity,
        });
      }

      const { data: insertedItems, error: itemsError } = await supabase
        .from("order_items")
        .insert(lineItems)
        .select();
      if (itemsError) throw itemsError;

      setReceiptOrder({
        id: order.id,
        order_number: order.order_number,
        status: "queued",
        subtotal,
        discount_amount: discountAmount,
        total,
        payment_method: paymentMethod,
        amount_tendered: paymentMethod === "cash" ? Number(tendered) : total,
        change_due: paymentMethod === "cash" ? change : 0,
        notes: null,
        cashier_id: profile.id,
        promo_id: selectedPromo?.id ?? null,
        promo_name: selectedPromo?.name ?? null,
        created_at: new Date().toISOString(),
        ready_at: null,
        completed_at: null,
        order_items: insertedItems ?? [],
      });
      setCart([]);
      setTendered("");
      setSelectedPromoId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* ---------- Ready-order alerts ---------- */}
      {readyAlerts.length > 0 && (
        <div className="fixed right-4 top-20 z-50 flex w-80 flex-col gap-2 lg:col-span-2">
          {readyAlerts.map((o) => (
            <div
              key={o.id}
              className="rounded-card border border-green-300 bg-green-50 p-4 shadow-lg"
            >
              <p className="font-display font-semibold text-green-800">
                Order #{o.order_number} is ready!
              </p>
              <p className="mb-3 text-sm text-green-700">
                The kitchen has finished this order.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => completeOrder(o.id)}
                  className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                >
                  Mark handed off
                </button>
                <button
                  onClick={() => dismissAlert(o.id)}
                  className="rounded px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Menu grid ---------- */}
      <div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu items…"
          className="mb-3 w-full rounded-md border border-char-700/20 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
        />
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
                category === c
                  ? "bg-ember-500 text-white"
                  : "bg-white text-char-700 hover:bg-char-800/5"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {visibleProducts.length === 0 && (
          <p className="text-sm text-char-700/60">No items match your search.</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="overflow-hidden rounded-card border border-char-700/10 bg-white text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-24 w-full bg-char-800/5">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-char-700/30">
                    No image
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-1 text-sm font-medium text-char-900">
                  {p.name}
                </p>
                <p className="text-sm font-semibold text-ember-600">
                  {formatPeso(p.price)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Cart sidebar ---------- */}
      <div className="h-fit rounded-card border border-char-700/10 bg-white p-4 shadow-sm lg:sticky lg:top-20">
        <h2 className="mb-3 font-display font-semibold text-char-900">
          Current order
        </h2>

        {cart.length === 0 ? (
          <p className="text-sm text-char-700/50">Tap items to add them.</p>
        ) : (
          <div className="mb-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {cart.map((l) => (
              <div key={l.product.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-char-900">
                    {l.product.name}
                  </p>
                  <p className="text-xs text-char-700/50">
                    {formatPeso(l.product.price)} each
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => changeQty(l.product.id, -1)}
                    className="h-6 w-6 rounded border border-char-700/20 text-char-700"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm">{l.quantity}</span>
                  <button
                    onClick={() => changeQty(l.product.id, 1)}
                    className="h-6 w-6 rounded border border-char-700/20 text-char-700"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeLine(l.product.id)}
                  className="ml-1 text-xs text-ember-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
            {freeBonus && (
              <div className="flex items-center justify-between rounded-md bg-green-50 px-2 py-1.5 text-sm">
                <span className="text-green-800">
                  {freeBonus.quantity}× {freeBonus.product_name} (Free)
                </span>
                <span className="text-xs font-medium text-green-700">
                  {selectedPromo?.name}
                </span>
              </div>
            )}
          </div>
        )}

        {eligiblePromos.length > 0 && (
          <div className="mb-3 border-t border-char-700/10 pt-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-char-700/50">
              Promos available
            </p>
            <div className="space-y-1.5">
              {eligiblePromos.map((promo) => (
                <label
                  key={promo.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                    selectedPromoId === promo.id
                      ? "border-ember-500 bg-ember-50"
                      : "border-char-700/15 hover:bg-char-800/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="promo"
                    checked={selectedPromoId === promo.id}
                    onChange={() =>
                      setSelectedPromoId(
                        selectedPromoId === promo.id ? null : promo.id
                      )
                    }
                  />
                  <span className="flex-1 text-char-800">{promo.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 space-y-1 border-t border-char-700/10 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-char-700/70">Subtotal</span>
            <span className="text-char-900">{formatPeso(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Discount ({selectedPromo?.name})</span>
              <span>−{formatPeso(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-char-900">
            <span>Total</span>
            <span>{formatPeso(total)}</span>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-char-700/70">
          Payment method
        </label>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 text-sm"
        >
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="card">Card</option>
          <option value="other">Other</option>
        </select>

        {paymentMethod === "cash" && (
          <>
            <label className="mb-1 block text-xs font-medium text-char-700/70">
              Amount tendered
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="mb-2 w-full rounded-md border border-char-700/20 px-3 py-2 text-sm"
              placeholder="0.00"
            />
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-char-700/70">Change</span>
              <span className="font-medium text-char-900">
                {formatPeso(change)}
              </span>
            </div>
          </>
        )}

        <button
          onClick={checkout}
          disabled={
            paying ||
            cart.length === 0 ||
            (paymentMethod === "cash" && Number(tendered || 0) < total)
          }
          className="w-full rounded-md bg-ember-500 py-2.5 font-semibold text-white hover:bg-ember-600 disabled:opacity-50"
        >
          {paying ? "Sending to kitchen…" : `Checkout · ${formatPeso(total)}`}
        </button>
      </div>

      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          cashierName={profile?.full_name}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
}
