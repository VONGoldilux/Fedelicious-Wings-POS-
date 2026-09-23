"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Banknote,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
  Tag,
  IdCard,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cx, formatPeso } from "@/lib/utils";
import ReceiptModal from "@/components/ReceiptModal";
import PaymentProviderPicker from "@/components/PaymentProviderPicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { WEEKDAYS } from "@/lib/types";
import type {
  CartLine,
  Order,
  OrderType,
  PaymentMethod,
  Product,
  Promotion,
  SeniorPwdEntry,
  SeniorPwdIdType,
} from "@/lib/types";

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
};

const ORDER_TYPE_ICON: Record<OrderType, typeof UtensilsCrossed> = {
  dine_in: UtensilsCrossed,
  takeout: ShoppingBag,
  delivery: Truck,
};

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
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProvider, setPaymentProvider] = useState("");
  const [readyAlerts, setReadyAlerts] = useState<Order[]>([]);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("takeout");
  const [tableNumber, setTableNumber] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [containerCount, setContainerCount] = useState(0);
  const [seniorPwdEntries, setSeniorPwdEntries] = useState<SeniorPwdEntry[]>([]);
  const [showSeniorPwdForm, setShowSeniorPwdForm] = useState(false);
  const [newEntryType, setNewEntryType] = useState<SeniorPwdIdType>("senior");
  const [newEntryIdNumber, setNewEntryIdNumber] = useState("");
  const [newEntryName, setNewEntryName] = useState("");
  const [newEntryClaims, setNewEntryClaims] = useState<Record<string, number>>({});
  const [showUnavailablePanel, setShowUnavailablePanel] = useState(true);

  // ---- Load menu (all items — unavailable ones stay visible but marked) --
  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Realtime: reflect kitchen's availability toggles live ------------
  useEffect(() => {
    const channel = supabase
      .channel("cashier-product-availability")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          const updated = payload.new as Product;
          setProducts((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const unavailableProducts = useMemo(
    () => products.filter((p) => !p.is_available),
    [products]
  );

  const cartQtyByProduct = useMemo(
    () => new Map(cart.map((l) => [l.product.id, l.quantity])),
    [cart]
  );

  function addToCart(product: Product) {
    if (!product.is_available) return;
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

  function setLineNote(productId: string, note: string) {
    setCart((prev) =>
      prev.map((l) =>
        l.product.id === productId ? { ...l, special_instructions: note } : l
      )
    );
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

  // ---- Senior/PWD discount: 20% off, per-ID, no double-claiming ---------
  // RA 9994 / RA 10754 entitle each senior/PWD to their own discount only
  // on their portion of the order, and the law doesn't allow stacking two
  // IDs on the same item — so this tracks exactly how much quantity of
  // each cart line has already been claimed by an ID already added below.
  const claimedByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of seniorPwdEntries) {
      for (const item of entry.items) {
        map.set(item.product_id, (map.get(item.product_id) ?? 0) + item.quantity);
      }
    }
    return map;
  }, [seniorPwdEntries]);

  function remainingUnclaimedQty(productId: string, cartQty: number): number {
    return Math.max(0, cartQty - (claimedByProduct.get(productId) ?? 0));
  }

  // If the cashier lowers/removes a cart item after it was already claimed
  // by a senior/PWD ID, clamp that entry's claim down (or drop it) so the
  // discount never outlives the item it was granted for.
  useEffect(() => {
    setSeniorPwdEntries((prev) => {
      let changed = false;
      const next = prev
        .map((entry) => {
          const items = entry.items
            .map((item) => {
              const line = cart.find((l) => l.product.id === item.product_id);
              const cap = line ? line.quantity : 0;
              if (item.quantity > cap) changed = true;
              return { ...item, quantity: Math.min(item.quantity, cap) };
            })
            .filter((item) => item.quantity > 0);
          if (items.length !== entry.items.length) changed = true;
          const discount_amount = items.reduce((sum, item) => {
            const line = cart.find((l) => l.product.id === item.product_id);
            return sum + (line ? line.product.price * item.quantity * 0.2 : 0);
          }, 0);
          return { ...entry, items, discount_amount };
        })
        .filter((entry) => entry.items.length > 0);
      return changed || next.length !== prev.length ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  const seniorPwdDiscountTotal = seniorPwdEntries.reduce(
    (sum, e) => sum + e.discount_amount,
    0
  );

  const newEntryDiscount = cart.reduce((sum, l) => {
    const qty = newEntryClaims[l.product.id] ?? 0;
    return sum + l.product.price * qty * 0.2;
  }, 0);

  function addSeniorPwdEntry() {
    const items = cart
      .map((l) => ({
        product_id: l.product.id,
        product_name: l.product.name,
        quantity: newEntryClaims[l.product.id] ?? 0,
      }))
      .filter((it) => it.quantity > 0);
    if (!newEntryIdNumber.trim() || !newEntryName.trim() || items.length === 0) return;

    setSeniorPwdEntries((prev) => [
      ...prev,
      {
        id_type: newEntryType,
        id_number: newEntryIdNumber.trim(),
        name: newEntryName.trim(),
        items,
        discount_amount: newEntryDiscount,
      },
    ]);
    setNewEntryType("senior");
    setNewEntryIdNumber("");
    setNewEntryName("");
    setNewEntryClaims({});
    setShowSeniorPwdForm(false);
  }

  function removeSeniorPwdEntry(index: number) {
    setSeniorPwdEntries((prev) => prev.filter((_, i) => i !== index));
  }

  // Containers only apply to takeout/delivery (dine-in uses house plates);
  // delivery fee/rider only apply to delivery. Reset whichever no longer
  // applies whenever the cashier switches order type.
  useEffect(() => {
    if (orderType === "dine_in") {
      setContainerCount(0);
    }
    if (orderType !== "delivery") {
      setDeliveredBy("");
      setDeliveryFee("");
    }
  }, [orderType]);

  const containerFeeAmount = orderType !== "dine_in" ? containerCount * 10 : 0;
  const deliveryFeeAmount =
    orderType === "delivery" ? Number(deliveryFee || 0) : 0;

  const total = Math.max(
    0,
    subtotal - discountAmount - seniorPwdDiscountTotal + containerFeeAmount + deliveryFeeAmount
  );
  const change =
    paymentMethod === "cash" && tendered
      ? Math.max(0, Number(tendered) - total)
      : 0;

  async function checkout() {
    if (cart.length === 0 || !profile) return;
    if (paymentMethod === "cash" && Number(tendered || 0) < total) return;
    if (paymentMethod === "gcash" && !paymentReference.trim()) return;
    if (paymentMethod === "gcash" && !paymentProvider.trim()) return;

    setPaying(true);
    setCheckoutError(null);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          status: "queued",
          subtotal,
          discount_amount: discountAmount,
          total,
          payment_method: paymentMethod,
          payment_reference:
            paymentMethod === "gcash" ? paymentReference.trim() : null,
          payment_provider:
            paymentMethod === "gcash" ? paymentProvider.trim() : null,
          amount_tendered: paymentMethod === "cash" ? Number(tendered) : total,
          change_due: paymentMethod === "cash" ? change : 0,
          cashier_id: profile.id,
          promo_id: selectedPromo?.id ?? null,
          promo_name: selectedPromo?.name ?? null,
          order_type: orderType,
          table_number: orderType === "dine_in" ? tableNumber.trim() || null : null,
          senior_pwd_discount_total: seniorPwdDiscountTotal,
          senior_pwd_details: seniorPwdEntries,
          delivered_by: orderType === "delivery" ? deliveredBy.trim() || null : null,
          delivery_fee: deliveryFeeAmount,
          container_count: containerCount,
          container_fee: containerFeeAmount,
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
        special_instructions: l.special_instructions?.trim() || null,
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
          special_instructions: null,
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
        payment_reference:
          paymentMethod === "gcash" ? paymentReference.trim() : null,
        payment_provider:
          paymentMethod === "gcash" ? paymentProvider.trim() : null,
        amount_tendered: paymentMethod === "cash" ? Number(tendered) : total,
        change_due: paymentMethod === "cash" ? change : 0,
        notes: null,
        cashier_id: profile.id,
        promo_id: selectedPromo?.id ?? null,
        promo_name: selectedPromo?.name ?? null,
        order_type: orderType,
        table_number: orderType === "dine_in" ? tableNumber.trim() || null : null,
        cancel_reason: null,
        senior_pwd_discount_total: seniorPwdDiscountTotal,
        senior_pwd_details: seniorPwdEntries,
        delivered_by: orderType === "delivery" ? deliveredBy.trim() || null : null,
        delivery_fee: deliveryFeeAmount,
        container_count: containerCount,
        container_fee: containerFeeAmount,
        created_at: new Date().toISOString(),
        ready_at: null,
        completed_at: null,
        order_items: insertedItems ?? [],
      });
      setCart([]);
      setTendered("");
      setPaymentReference("");
      setPaymentProvider("");
      setSelectedPromoId(null);
      setOrderType("takeout");
      setTableNumber("");
      setSeniorPwdEntries([]);
      setDeliveredBy("");
      setDeliveryFee("");
      setContainerCount(0);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Checkout failed.";
      setCheckoutError(message);
    } finally {
      setPaying(false);
    }
  }

  const checkoutDisabled =
    paying ||
    cart.length === 0 ||
    (paymentMethod === "cash" && Number(tendered || 0) < total) ||
    (paymentMethod === "gcash" && (!paymentReference.trim() || !paymentProvider.trim()));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
      {/* ---------- Unavailable items panel ---------- */}
      {unavailableProducts.length > 0 && (
        <div className="fixed left-4 top-20 z-40 w-72">
          {showUnavailablePanel ? (
            <Card padding="none" className="overflow-hidden !border-ember-300 dark:!border-ember-500/40">
              <div className="flex items-center justify-between gap-2 border-b border-ember-100 bg-ember-50 px-3 py-2.5 dark:border-ember-500/20 dark:bg-ember-500/15">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ember-700 dark:text-ember-300">
                  <AlertTriangle size={15} />
                  Unavailable ({unavailableProducts.length})
                </p>
                <button
                  onClick={() => setShowUnavailablePanel(false)}
                  className="rounded p-1 text-ember-600 hover:bg-ember-100 dark:text-ember-400 dark:hover:bg-ember-500/20"
                  aria-label="Minimize"
                >
                  <X size={15} />
                </button>
              </div>
              <ul className="max-h-64 divide-y divide-char-700/10 overflow-y-auto dark:divide-cream/10">
                {unavailableProducts.map((p) => (
                  <li key={p.id} className="px-3 py-2 text-sm text-char-700 dark:text-cream/80">
                    <span className="line-clamp-1">{p.name}</span>
                    <span className="block text-xs text-char-700/40 dark:text-cream/40">{p.category}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <button
              onClick={() => setShowUnavailablePanel(true)}
              className="flex h-11 items-center gap-1.5 rounded-full border border-ember-300 bg-white px-4 text-sm font-medium text-ember-700 shadow-card-lg dark:border-ember-500/40 dark:bg-char-900 dark:text-ember-300 dark:shadow-card-lg-dark"
            >
              <AlertTriangle size={15} />
              {unavailableProducts.length} unavailable
            </button>
          )}
        </div>
      )}

      {/* ---------- Ready-order alerts ---------- */}
      {readyAlerts.length > 0 && (
        <div className="fixed right-4 top-20 z-50 flex w-80 flex-col gap-2 lg:col-span-2">
          {readyAlerts.map((o) => (
            <Card key={o.id} className="!border-green-300 !bg-green-50 dark:!border-green-500/40 dark:!bg-green-500/10">
              <p className="flex items-center gap-1.5 font-display font-semibold text-green-800 dark:text-green-300">
                <CheckCircle2 size={17} />
                Order #{o.order_number} is ready!
              </p>
              <p className="mb-3 mt-0.5 text-sm text-green-700 dark:text-green-400">
                The kitchen has finished this order.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => completeOrder(o.id)} className="!bg-green-600 hover:!bg-green-700">
                  Mark handed off
                </Button>
                <Button size="sm" variant="ghost" onClick={() => dismissAlert(o.id)} className="!text-green-700 dark:!text-green-400">
                  Dismiss
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ---------- Menu grid ---------- */}
      <div>
        <div className="relative mb-3">
          <Search
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-char-700/40 dark:text-cream/40"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu items…"
            className="h-12 w-full rounded-lg border border-char-700/20 bg-white pl-10 pr-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-900 dark:text-cream"
          />
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cx(
                "inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                category === c
                  ? "bg-ember-500 text-white shadow-sm"
                  : "bg-white text-char-700 hover:bg-char-800/5 dark:bg-char-900 dark:text-cream/80 dark:hover:bg-cream/5"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {visibleProducts.length === 0 && (
          <p className="text-sm text-char-700/60 dark:text-cream/60">No items match your search.</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((p) => (
            <ProductTile
              key={p.id}
              product={p}
              qtyInCart={cartQtyByProduct.get(p.id) ?? 0}
              onAdd={() => addToCart(p)}
            />
          ))}
        </div>
      </div>

      {/* ---------- Cart / ticket panel ---------- */}
      <div className="flex flex-col rounded-card border border-char-700/10 bg-white shadow-card dark:border-cream/10 dark:bg-char-900 dark:shadow-card-dark lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)]">
        {/* -- Header: title + order type + type-specific fields -- */}
        <div className="shrink-0 border-b border-char-700/10 p-4 dark:border-cream/10">
          <h2 className="mb-3 flex items-center gap-2 font-display font-semibold text-char-900 dark:text-cream">
            <ShoppingCart size={18} className="text-ember-600 dark:text-ember-400" />
            Current order
          </h2>

          <div className="mb-3 flex gap-1 rounded-lg border border-char-700/20 bg-char-800/[0.04] p-1 dark:border-cream/15 dark:bg-cream/5">
            {(Object.keys(ORDER_TYPE_LABEL) as OrderType[]).map((t) => {
              const Icon = ORDER_TYPE_ICON[t];
              return (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  className={cx(
                    "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                    orderType === t
                      ? "bg-ember-500 text-white shadow-sm"
                      : "text-char-700/70 hover:bg-char-800/10 dark:text-cream/70 dark:hover:bg-cream/10"
                  )}
                >
                  <Icon size={15} />
                  {ORDER_TYPE_LABEL[t]}
                </button>
              );
            })}
          </div>

          {orderType === "dine_in" && (
            <input
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Table number"
              className="mb-1 h-11 w-full rounded-md border border-char-700/20 px-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
            />
          )}

          {orderType === "delivery" && (
            <div className="space-y-2">
              <input
                value={deliveredBy}
                onChange={(e) => setDeliveredBy(e.target.value)}
                placeholder="Delivered by (rider name)"
                className="h-11 w-full rounded-md border border-char-700/20 px-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-char-700/70 dark:text-cream/70">
                  Delivery fee (₱) — based on distance
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="0.00"
                  className="h-11 w-full rounded-md border border-char-700/20 px-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                />
              </div>
            </div>
          )}

          {orderType !== "dine_in" && (
            <div className="mt-2 flex items-center justify-between rounded-md border border-char-700/15 px-3 py-2 dark:border-cream/15">
              <div>
                <p className="text-sm text-char-700 dark:text-cream/80">Containers</p>
                <p className="text-xs text-char-700/50 dark:text-cream/50">₱10 each</p>
              </div>
              <Stepper value={containerCount} onChange={(n) => setContainerCount(Math.max(0, n))} />
            </div>
          )}
        </div>

        {/* -- Scrollable middle: cart lines, promos, senior/PWD -- */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="py-6 text-center text-sm text-char-700/50 dark:text-cream/50">
              Tap items to add them.
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((l) => (
                <CartLineRow
                  key={l.product.id}
                  line={l}
                  onChangeQty={(delta) => changeQty(l.product.id, delta)}
                  onRemove={() => removeLine(l.product.id)}
                  onNoteChange={(note) => setLineNote(l.product.id, note)}
                />
              ))}
              {freeBonus && (
                <div className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm dark:bg-green-500/10">
                  <span className="text-green-800 dark:text-green-300">
                    {freeBonus.quantity}× {freeBonus.product_name} (Free)
                  </span>
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                    {selectedPromo?.name}
                  </span>
                </div>
              )}
            </div>
          )}

          {eligiblePromos.length > 0 && seniorPwdEntries.length === 0 && (
            <div className="mt-4 border-t border-char-700/10 pt-3 dark:border-cream/10">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                <Tag size={12} />
                Promos available
              </p>
              <div className="space-y-1.5">
                {eligiblePromos.map((promo) => (
                  <label
                    key={promo.id}
                    className={cx(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
                      selectedPromoId === promo.id
                        ? "border-ember-500 bg-ember-50 dark:bg-ember-500/15"
                        : "border-char-700/15 hover:bg-char-800/5 dark:border-cream/15 dark:hover:bg-cream/5"
                    )}
                  >
                    <input
                      type="radio"
                      name="promo"
                      checked={selectedPromoId === promo.id}
                      onChange={() =>
                        setSelectedPromoId(selectedPromoId === promo.id ? null : promo.id)
                      }
                      className="h-4 w-4 accent-ember-500"
                    />
                    <span className="flex-1 text-char-800 dark:text-cream/90">{promo.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {cart.length > 0 && !selectedPromoId && (
            <div className="mt-4 border-t border-char-700/10 pt-3 dark:border-cream/10">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-char-700/50 dark:text-cream/50">
                  <IdCard size={12} />
                  Senior / PWD discount
                </p>
                {!showSeniorPwdForm && (
                  <button
                    onClick={() => setShowSeniorPwdForm(true)}
                    className="text-xs font-medium text-ember-600 hover:underline dark:text-ember-400"
                  >
                    + Add ID
                  </button>
                )}
              </div>

              {seniorPwdEntries.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {seniorPwdEntries.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between rounded-md bg-green-50 px-3 py-2 text-sm dark:bg-green-500/10"
                    >
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-300">
                          {entry.name}{" "}
                          <span className="text-xs font-normal capitalize text-green-700 dark:text-green-400">
                            ({entry.id_type} · {entry.id_number})
                          </span>
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-400">
                          {entry.items.map((it) => `${it.quantity}× ${it.product_name}`).join(", ")}
                          {" — "}
                          {formatPeso(entry.discount_amount)} off
                        </p>
                      </div>
                      <button
                        onClick={() => removeSeniorPwdEntry(i)}
                        className="ml-2 shrink-0 rounded p-1 text-ember-600 hover:bg-ember-100 dark:text-ember-400 dark:hover:bg-ember-500/15"
                        aria-label="Remove entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showSeniorPwdForm && (
                <div className="rounded-md border border-char-700/15 p-3 dark:border-cream/15">
                  <div className="mb-2 flex gap-1 rounded-md border border-char-700/20 bg-char-800/5 p-1 dark:border-cream/15 dark:bg-cream/5">
                    {(["senior", "pwd"] as SeniorPwdIdType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setNewEntryType(t)}
                        className={cx(
                          "h-9 flex-1 rounded px-2 text-xs font-medium capitalize",
                          newEntryType === t
                            ? "bg-ember-500 text-white"
                            : "text-char-700/70 hover:bg-char-800/10 dark:text-cream/70 dark:hover:bg-cream/10"
                        )}
                      >
                        {t === "pwd" ? "PWD" : "Senior Citizen"}
                      </button>
                    ))}
                  </div>
                  <input
                    value={newEntryIdNumber}
                    onChange={(e) => setNewEntryIdNumber(e.target.value)}
                    placeholder={newEntryType === "pwd" ? "PWD ID number" : "OSCA/Senior ID number"}
                    className="mb-1.5 h-10 w-full rounded border border-char-700/20 px-2.5 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                  />
                  <input
                    value={newEntryName}
                    onChange={(e) => setNewEntryName(e.target.value)}
                    placeholder="Name on ID"
                    className="mb-2 h-10 w-full rounded border border-char-700/20 px-2.5 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                  />

                  <p className="mb-1 text-xs font-medium text-char-700/70 dark:text-cream/70">
                    Which items are exclusively theirs?
                  </p>
                  <div className="mb-2 max-h-32 space-y-1 overflow-y-auto">
                    {cart.map((l) => {
                      const remaining = remainingUnclaimedQty(l.product.id, l.quantity);
                      if (remaining === 0) return null;
                      const claimed = newEntryClaims[l.product.id] ?? 0;
                      return (
                        <div key={l.product.id} className="flex items-center justify-between text-sm">
                          <span className="text-char-800 dark:text-cream/90">{l.product.name}</span>
                          <Stepper
                            size="sm"
                            value={claimed}
                            onChange={(n) =>
                              setNewEntryClaims((prev) => ({
                                ...prev,
                                [l.product.id]: Math.max(0, Math.min(remaining, n)),
                              }))
                            }
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="mb-2 flex justify-between text-xs text-char-700/70 dark:text-cream/70">
                    <span>Discount for this ID</span>
                    <span className="font-medium text-green-700 dark:text-green-400">
                      {formatPeso(newEntryDiscount)}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowSeniorPwdForm(false);
                        setNewEntryIdNumber("");
                        setNewEntryName("");
                        setNewEntryClaims({});
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={addSeniorPwdEntry}
                      disabled={!newEntryIdNumber.trim() || !newEntryName.trim() || newEntryDiscount === 0}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* -- Footer: totals, payment, checkout (always visible) -- */}
        <div className="shrink-0 border-t border-char-700/10 p-4 dark:border-cream/10">
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-char-700/70 dark:text-cream/70">Subtotal</span>
              <span className="text-char-900 dark:text-cream">{formatPeso(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>Discount ({selectedPromo?.name})</span>
                <span>−{formatPeso(discountAmount)}</span>
              </div>
            )}
            {seniorPwdDiscountTotal > 0 && (
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>Senior/PWD discount ({seniorPwdEntries.length})</span>
                <span>−{formatPeso(seniorPwdDiscountTotal)}</span>
              </div>
            )}
            {containerFeeAmount > 0 && (
              <div className="flex justify-between text-char-700/70 dark:text-cream/70">
                <span>Containers ({containerCount})</span>
                <span>+{formatPeso(containerFeeAmount)}</span>
              </div>
            )}
            {deliveryFeeAmount > 0 && (
              <div className="flex justify-between text-char-700/70 dark:text-cream/70">
                <span>Delivery fee</span>
                <span>+{formatPeso(deliveryFeeAmount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-char-700/10 pt-1.5 dark:border-cream/10">
              <span className="font-medium text-char-900 dark:text-cream">Total</span>
              <span className="font-display text-2xl font-bold text-ember-600 dark:text-ember-400">
                {formatPeso(total)}
              </span>
            </div>
          </div>

          <div className="mb-3 flex gap-1 rounded-lg border border-char-700/20 bg-char-800/[0.04] p-1 dark:border-cream/15 dark:bg-cream/5">
            {(["cash", "gcash"] as PaymentMethod[]).map((m) => {
              const Icon = m === "cash" ? Banknote : Wallet;
              return (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cx(
                    "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-semibold transition-colors",
                    paymentMethod === m
                      ? "bg-ember-500 text-white shadow-sm"
                      : "text-char-700/70 hover:bg-char-800/10 dark:text-cream/70 dark:hover:bg-cream/10"
                  )}
                >
                  <Icon size={15} />
                  {m === "cash" ? "Cash" : "E-Payment"}
                </button>
              );
            })}
          </div>

          {paymentMethod === "cash" && (
            <>
              <label className="mb-1 block text-xs font-medium text-char-700/70 dark:text-cream/70">
                Amount tendered
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                className="mb-2 h-11 w-full rounded-md border border-char-700/20 px-3 text-sm dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                placeholder="0.00"
              />
              <div className="mb-2 flex flex-wrap gap-1.5">
                {[20, 50, 100, 200, 500, 1000].map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => setTendered(String(bill))}
                    className="h-9 rounded-md border border-char-700/20 px-3 text-xs font-semibold text-char-700 hover:border-ember-500 hover:text-ember-600 dark:border-cream/15 dark:text-cream/80 dark:hover:text-ember-400"
                  >
                    ₱{bill}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTendered(String(total))}
                  className="h-9 rounded-md border border-char-700/20 px-3 text-xs font-semibold text-char-700 hover:border-ember-500 hover:text-ember-600 dark:border-cream/15 dark:text-cream/80 dark:hover:text-ember-400"
                >
                  Exact
                </button>
              </div>
              <div className="mb-3 flex justify-between text-sm">
                <span className="text-char-700/70 dark:text-cream/70">Change</span>
                <span className="font-medium text-char-900 dark:text-cream">{formatPeso(change)}</span>
              </div>
            </>
          )}

          {paymentMethod === "gcash" && (
            <div className="mb-3 space-y-2">
              <PaymentProviderPicker value={paymentProvider} onChange={setPaymentProvider} />
              <div>
                <label className="mb-1 block text-xs font-medium text-char-700/70 dark:text-cream/70">
                  Reference number
                </label>
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="h-11 w-full rounded-md border border-char-700/20 px-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                  placeholder="Enter after payment is sent & received"
                />
              </div>
            </div>
          )}

          {checkoutError && (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400">
              <span>{checkoutError}</span>
              <button onClick={() => setCheckoutError(null)} aria-label="Dismiss" className="shrink-0">
                <X size={14} />
              </button>
            </div>
          )}

          <Button
            size="xl"
            fullWidth
            onClick={checkout}
            disabled={checkoutDisabled}
            loading={paying}
          >
            {paying ? "Sending to kitchen…" : `Checkout · ${formatPeso(total)}`}
          </Button>
        </div>
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

function ProductTile({
  product,
  qtyInCart,
  onAdd,
}: {
  product: Product;
  qtyInCart: number;
  onAdd: () => void;
}) {
  return (
    <button
      onClick={onAdd}
      disabled={!product.is_available}
      className={cx(
        "relative overflow-hidden rounded-card border border-char-700/10 bg-white text-left shadow-card transition-transform dark:border-cream/10 dark:bg-char-900 dark:shadow-card-dark",
        product.is_available
          ? "hover:-translate-y-0.5 hover:shadow-card-lg active:translate-y-0 dark:hover:shadow-card-lg-dark"
          : "cursor-not-allowed opacity-75"
      )}
    >
      {qtyInCart > 0 && (
        <span className="absolute right-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-ember-500 px-1.5 text-xs font-bold text-white shadow-sm">
          {qtyInCart}
        </span>
      )}
      <div className="relative h-28 w-full bg-char-800/5 sm:h-32 dark:bg-cream/5">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className={cx("object-cover", !product.is_available && "grayscale")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-char-700/30 dark:text-cream/30">
            No image
          </div>
        )}
        {!product.is_available && (
          <div className="absolute inset-0 flex items-center justify-center bg-char-950/20">
            <span className="rounded bg-ember-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Unavailable
            </span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-1 text-sm font-medium text-char-900 dark:text-cream">{product.name}</p>
        <p className="text-sm font-bold text-ember-600 dark:text-ember-400">{formatPeso(product.price)}</p>
        {product.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-char-700/50 dark:text-cream/50">
            {product.description}
          </p>
        )}
      </div>
    </button>
  );
}

function Stepper({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
}) {
  const btnSize = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className={cx(
          btnSize,
          "flex items-center justify-center rounded-md border border-char-700/20 text-char-700 hover:border-ember-500 hover:text-ember-600 dark:border-cream/15 dark:text-cream/80 dark:hover:text-ember-400"
        )}
      >
        <Minus size={size === "sm" ? 12 : 14} />
      </button>
      <span className="w-5 text-center text-sm font-medium text-char-900 dark:text-cream">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className={cx(
          btnSize,
          "flex items-center justify-center rounded-md border border-char-700/20 text-char-700 hover:border-ember-500 hover:text-ember-600 dark:border-cream/15 dark:text-cream/80 dark:hover:text-ember-400"
        )}
      >
        <Plus size={size === "sm" ? 12 : 14} />
      </button>
    </div>
  );
}

function CartLineRow({
  line,
  onChangeQty,
  onRemove,
  onNoteChange,
}: {
  line: CartLine;
  onChangeQty: (delta: number) => void;
  onRemove: () => void;
  onNoteChange: (note: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-char-900 dark:text-cream">
            {line.product.name}
          </p>
          <p className="text-xs text-char-700/50 dark:text-cream/50">
            {formatPeso(line.product.price)} each
          </p>
        </div>
        <Stepper value={line.quantity} onChange={(n) => onChangeQty(n - line.quantity)} />
        <button
          onClick={onRemove}
          aria-label="Remove item"
          className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-char-700/40 hover:bg-red-50 hover:text-red-600 dark:text-cream/40 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <input
        value={line.special_instructions ?? ""}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Note (e.g. no onions, extra spicy)"
        className="h-8 w-full rounded border border-char-700/15 px-2 text-xs text-char-700 placeholder:text-char-700/30 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:text-cream/80 dark:placeholder:text-cream/30"
      />
    </div>
  );
}
