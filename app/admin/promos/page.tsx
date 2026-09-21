"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import {
  WEEKDAYS,
  type Product,
  type PromoItemRef,
  type PromoType,
  type Promotion,
  type Weekday,
} from "@/lib/types";

const PROMO_TYPE_LABEL: Record<PromoType, string> = {
  discount_percentage: "% Discount",
  discount_flat: "₱ Discount",
  free_item: "Buy X, Get Y Free",
  bundle: "Bundle / Combo",
};

const EMPTY_FORM = {
  id: null as string | null,
  name: "",
  description: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date().toISOString().slice(0, 10),
  valid_days: [] as Weekday[], // empty = every day
  promo_type: "discount_percentage" as PromoType,
  discount_value: "",
  discount_scope_product_id: "", // optional: limit discount to one item
  buy_product_id: "",
  buy_quantity: "1",
  free_product_id: "",
  free_quantity: "1",
  bundle_product_ids: [] as string[],
  bundle_price: "",
  is_active: true,
};

export default function PromosPage() {
  const supabase = createClient();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bundleSearch, setBundleSearch] = useState("");

  async function loadPromotions() {
    setLoading(true);
    const { data } = await supabase
      .from("promotions")
      .select("*")
      .order("start_date", { ascending: false });
    setPromotions((data as Promotion[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPromotions();
    supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const bundleSearchResults = useMemo(() => {
    const q = bundleSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, bundleSearch]);

  function openNewForm() {
    setForm(EMPTY_FORM);
    setError(null);
    setBundleSearch("");
    setShowForm(true);
  }

  function openEditForm(promo: Promotion) {
    setForm({
      id: promo.id,
      name: promo.name,
      description: promo.description ?? "",
      start_date: promo.start_date,
      end_date: promo.end_date,
      valid_days: promo.valid_days ?? [],
      promo_type: promo.promo_type,
      discount_value: promo.discount_value != null ? String(promo.discount_value) : "",
      discount_scope_product_id: promo.required_items[0]?.product_id ?? "",
      buy_product_id: promo.required_items[0]?.product_id ?? "",
      buy_quantity: String(promo.required_items[0]?.quantity ?? 1),
      free_product_id: promo.reward_items[0]?.product_id ?? "",
      free_quantity: String(promo.reward_items[0]?.quantity ?? 1),
      bundle_product_ids: promo.reward_items.map((r) => r.product_id),
      bundle_price: promo.bundle_price != null ? String(promo.bundle_price) : "",
      is_active: promo.is_active,
    });
    setError(null);
    setBundleSearch("");
    setShowForm(true);
  }

  function toggleDay(day: Weekday) {
    setForm((prev) => ({
      ...prev,
      valid_days: prev.valid_days.includes(day)
        ? prev.valid_days.filter((d) => d !== day)
        : [...prev.valid_days, day],
    }));
  }

  function toggleBundleProduct(id: string) {
    setForm((prev) => ({
      ...prev,
      bundle_product_ids: prev.bundle_product_ids.includes(id)
        ? prev.bundle_product_ids.filter((x) => x !== id)
        : [...prev.bundle_product_ids, id],
    }));
  }

  function itemRef(productId: string, quantity: number): PromoItemRef[] {
    const p = productById.get(productId);
    if (!p) return [];
    return [{ product_id: p.id, product_name: p.name, quantity }];
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Promo name is required.");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("End date can't be before the start date.");
      return;
    }

    let required_items: PromoItemRef[] = [];
    let reward_items: PromoItemRef[] = [];
    let discount_value: number | null = null;
    let bundle_price: number | null = null;

    if (form.promo_type === "discount_percentage" || form.promo_type === "discount_flat") {
      const value = Number(form.discount_value);
      if (!value || value <= 0) {
        setError("Enter a discount value greater than 0.");
        return;
      }
      if (form.promo_type === "discount_percentage" && value > 100) {
        setError("Percentage discount can't exceed 100%.");
        return;
      }
      discount_value = value;
      required_items = form.discount_scope_product_id
        ? itemRef(form.discount_scope_product_id, 1)
        : [];
    } else if (form.promo_type === "free_item") {
      if (!form.buy_product_id || !form.free_product_id) {
        setError("Select both the item to buy and the free item.");
        return;
      }
      required_items = itemRef(form.buy_product_id, Number(form.buy_quantity) || 1);
      reward_items = itemRef(form.free_product_id, Number(form.free_quantity) || 1);
    } else if (form.promo_type === "bundle") {
      if (form.bundle_product_ids.length < 2) {
        setError("Select at least 2 items to bundle.");
        return;
      }
      const price = Number(form.bundle_price);
      if (!price || price <= 0) {
        setError("Enter a bundle price greater than 0.");
        return;
      }
      bundle_price = price;
      reward_items = form.bundle_product_ids.flatMap((id) => itemRef(id, 1));
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date,
        valid_days: form.valid_days.length > 0 ? form.valid_days : null,
        promo_type: form.promo_type,
        discount_value,
        bundle_price,
        required_items,
        reward_items,
        is_active: form.is_active,
      };

      if (form.id) {
        const { error: updateError } = await supabase
          .from("promotions")
          .update(payload)
          .eq("id", form.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("promotions").insert(payload);
        if (insertError) throw insertError;
      }

      setShowForm(false);
      await loadPromotions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: Promotion) {
    await supabase
      .from("promotions")
      .update({ is_active: !promo.is_active })
      .eq("id", promo.id);
    loadPromotions();
  }

  async function deletePromo(promo: Promotion) {
    if (!confirm(`Delete promo "${promo.name}"?`)) return;
    await supabase.from("promotions").delete().eq("id", promo.id);
    loadPromotions();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900">
            Promo Manager
          </h1>
          <p className="text-sm text-char-700/70">
            Discounts, buy-one-get-one deals, and bundle combos.
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="rounded-md bg-ember-500 px-4 py-2 font-medium text-white hover:bg-ember-600"
        >
          + New promo
        </button>
      </div>

      {loading ? (
        <p className="text-char-700/60">Loading promos…</p>
      ) : promotions.length === 0 ? (
        <p className="text-char-700/60">No promos yet.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-char-700/10 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-char-800/5 text-xs uppercase text-char-700/50">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Value</th>
                <th className="px-4 py-2.5">Dates</th>
                <th className="px-4 py-2.5">Days</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-char-700/10">
              {promotions.map((promo) => (
                <tr key={promo.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-char-900">{promo.name}</p>
                    {promo.description && (
                      <p className="text-xs text-char-700/50 line-clamp-1">
                        {promo.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {PROMO_TYPE_LABEL[promo.promo_type]}
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {promo.promo_type === "discount_percentage" &&
                      `${promo.discount_value}%`}
                    {promo.promo_type === "discount_flat" &&
                      formatPeso(promo.discount_value ?? 0)}
                    {promo.promo_type === "free_item" &&
                      `${promo.required_items[0]?.product_name ?? "?"} → free ${
                        promo.reward_items[0]?.product_name ?? "?"
                      }`}
                    {promo.promo_type === "bundle" &&
                      `${promo.reward_items.length} items · ${formatPeso(
                        promo.bundle_price ?? 0
                      )}`}
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {promo.start_date} → {promo.end_date}
                  </td>
                  <td className="px-4 py-3 text-char-700/70">
                    {promo.valid_days && promo.valid_days.length > 0
                      ? promo.valid_days.map((d) => d.slice(0, 3)).join(", ")
                      : "Every day"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(promo)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        promo.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-char-800/10 text-char-700"
                      }`}
                    >
                      {promo.is_active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditForm(promo)}
                        className="rounded border border-char-700/20 px-2 py-1 text-xs text-char-700 hover:border-ember-500 hover:text-ember-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePromo(promo)}
                        className="rounded px-2 py-1 text-xs text-ember-600 hover:bg-ember-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="my-8 w-full max-w-lg rounded-card bg-white p-6 shadow-xl"
          >
            <h2 className="mb-4 font-display text-lg font-semibold">
              {form.id ? "Edit promo" : "New promo"}
            </h2>

            {error && (
              <div className="mb-3 rounded border border-ember-300 bg-ember-50 px-3 py-2 text-sm text-ember-700">
                {error}
              </div>
            )}

            <label className="mb-1 block text-sm font-medium text-char-700">
              Promo name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
              placeholder="e.g. Wing Wednesday"
            />

            <label className="mb-1 block text-sm font-medium text-char-700">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
              placeholder="Shown to staff on the promo list"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-char-700">
                  Start date
                </label>
                <input
                  required
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-char-700">
                  End date
                </label>
                <input
                  required
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                />
              </div>
            </div>

            <label className="mb-1 block text-sm font-medium text-char-700">
              Valid days{" "}
              <span className="font-normal text-char-700/50">
                (leave all unchecked for every day)
              </span>
            </label>
            <div className="mb-4 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    form.valid_days.includes(day)
                      ? "bg-ember-500 text-white"
                      : "bg-char-800/5 text-char-700 hover:bg-char-800/10"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-sm font-medium text-char-700">
              Promo type
            </label>
            <select
              value={form.promo_type}
              onChange={(e) =>
                setForm({ ...form, promo_type: e.target.value as PromoType })
              }
              className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
            >
              {Object.entries(PROMO_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* ---- Discount (% or flat) ---- */}
            {(form.promo_type === "discount_percentage" ||
              form.promo_type === "discount_flat") && (
              <>
                <label className="mb-1 block text-sm font-medium text-char-700">
                  {form.promo_type === "discount_percentage"
                    ? "Discount percentage"
                    : "Discount amount (₱)"}
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                  placeholder={form.promo_type === "discount_percentage" ? "20" : "50"}
                />

                <label className="mb-1 block text-sm font-medium text-char-700">
                  Only for this item{" "}
                  <span className="font-normal text-char-700/50">(optional)</span>
                </label>
                <select
                  value={form.discount_scope_product_id}
                  onChange={(e) =>
                    setForm({ ...form, discount_scope_product_id: e.target.value })
                  }
                  className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                >
                  <option value="">Whole order</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {/* ---- Buy X, Get Y Free ---- */}
            {form.promo_type === "free_item" && (
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-char-700">
                    Buy this item
                  </label>
                  <select
                    required
                    value={form.buy_product_id}
                    onChange={(e) => setForm({ ...form, buy_product_id: e.target.value })}
                    className="mb-2 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                  >
                    <option value="">Select item…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={form.buy_quantity}
                    onChange={(e) => setForm({ ...form, buy_quantity: e.target.value })}
                    className="w-full rounded-md border border-char-700/20 px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
                    placeholder="Qty"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-char-700">
                    Get this item free
                  </label>
                  <select
                    required
                    value={form.free_product_id}
                    onChange={(e) => setForm({ ...form, free_product_id: e.target.value })}
                    className="mb-2 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                  >
                    <option value="">Select item…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={form.free_quantity}
                    onChange={(e) => setForm({ ...form, free_quantity: e.target.value })}
                    className="w-full rounded-md border border-char-700/20 px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
                    placeholder="Qty"
                  />
                </div>
              </div>
            )}

            {/* ---- Bundle / combo ---- */}
            {form.promo_type === "bundle" && (
              <>
                <label className="mb-1 block text-sm font-medium text-char-700">
                  Items in this bundle{" "}
                  <span className="font-normal text-char-700/50">
                    (pick 2+{form.bundle_product_ids.length > 0
                      ? ` · ${form.bundle_product_ids.length} selected`
                      : ""}
                    )
                  </span>
                </label>
                <input
                  type="search"
                  value={bundleSearch}
                  onChange={(e) => setBundleSearch(e.target.value)}
                  placeholder="Search items…"
                  className="mb-2 w-full rounded-md border border-char-700/20 px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
                />
                <div className="mb-3 max-h-48 overflow-y-auto rounded-md border border-char-700/20 p-2">
                  {bundleSearchResults.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-char-700/50">
                      No items match your search.
                    </p>
                  ) : (
                    bundleSearchResults.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-char-800/5"
                      >
                        <input
                          type="checkbox"
                          checked={form.bundle_product_ids.includes(p.id)}
                          onChange={() => toggleBundleProduct(p.id)}
                        />
                        <span className="flex-1 text-char-800">{p.name}</span>
                        <span className="text-char-700/50">{formatPeso(p.price)}</span>
                      </label>
                    ))
                  )}
                </div>

                <label className="mb-1 block text-sm font-medium text-char-700">
                  Bundle price (₱)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bundle_price}
                  onChange={(e) => setForm({ ...form, bundle_price: e.target.value })}
                  className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                  placeholder="e.g. 299"
                />
              </>
            )}

            <label className="mb-4 flex items-center gap-2 text-sm text-char-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Active
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md px-4 py-2 text-char-700 hover:bg-char-800/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-ember-500 px-4 py-2 font-medium text-white hover:bg-ember-600 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save promo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
