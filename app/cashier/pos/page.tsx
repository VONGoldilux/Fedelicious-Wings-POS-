"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatPeso } from "@/lib/utils";
import type { CartLine, Order, PaymentMethod, Product } from "@/lib/types";

export default function CashierPOSPage() {
  const supabase = createClient();
  const { profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string>("All");
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [readyAlerts, setReadyAlerts] = useState<Order[]>([]);

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

  const visibleProducts = useMemo(
    () =>
      category === "All" ? products : products.filter((p) => p.category === category),
    [products, category]
  );

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
  const change =
    paymentMethod === "cash" && tendered
      ? Math.max(0, Number(tendered) - subtotal)
      : 0;

  async function checkout() {
    if (cart.length === 0 || !profile) return;
    if (paymentMethod === "cash" && Number(tendered || 0) < subtotal) return;

    setPaying(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          status: "queued",
          subtotal,
          total: subtotal,
          payment_method: paymentMethod,
          amount_tendered: paymentMethod === "cash" ? Number(tendered) : subtotal,
          change_due: paymentMethod === "cash" ? change : 0,
          cashier_id: profile.id,
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

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(lineItems);
      if (itemsError) throw itemsError;

      alert(`Order #${order.order_number} sent to the kitchen.`);
      setCart([]);
      setTendered("");
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
          </div>
        )}

        <div className="mb-3 flex justify-between border-t border-char-700/10 pt-3 text-sm">
          <span className="text-char-700/70">Subtotal</span>
          <span className="font-semibold text-char-900">
            {formatPeso(subtotal)}
          </span>
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
            (paymentMethod === "cash" && Number(tendered || 0) < subtotal)
          }
          className="w-full rounded-md bg-ember-500 py-2.5 font-semibold text-white hover:bg-ember-600 disabled:opacity-50"
        >
          {paying ? "Sending to kitchen…" : `Checkout · ${formatPeso(subtotal)}`}
        </button>
      </div>
    </div>
  );
}
