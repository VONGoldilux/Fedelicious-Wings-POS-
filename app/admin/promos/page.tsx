"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
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
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/EmptyState";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

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

  const columns: DataTableColumn<Promotion>[] = [
    {
      id: "name",
      header: "Name",
      sortValue: (p) => p.name,
      cell: (promo) => (
        <div>
          <p className="font-medium text-char-900 dark:text-cream">{promo.name}</p>
          {promo.description && (
            <p className="line-clamp-1 text-xs text-char-700/50 dark:text-cream/50">{promo.description}</p>
          )}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      sortValue: (p) => p.promo_type,
      cell: (promo) => PROMO_TYPE_LABEL[promo.promo_type],
    },
    {
      id: "value",
      header: "Value",
      cell: (promo) => (
        <>
          {promo.promo_type === "discount_percentage" && `${promo.discount_value}%`}
          {promo.promo_type === "discount_flat" && formatPeso(promo.discount_value ?? 0)}
          {promo.promo_type === "free_item" &&
            `${promo.required_items[0]?.product_name ?? "?"} → free ${promo.reward_items[0]?.product_name ?? "?"}`}
          {promo.promo_type === "bundle" &&
            `${promo.reward_items.length} items · ${formatPeso(promo.bundle_price ?? 0)}`}
        </>
      ),
    },
    {
      id: "dates",
      header: "Dates",
      sortValue: (p) => p.start_date,
      cell: (promo) => `${promo.start_date} → ${promo.end_date}`,
    },
    {
      id: "days",
      header: "Days",
      cell: (promo) =>
        promo.valid_days && promo.valid_days.length > 0
          ? promo.valid_days.map((d) => d.slice(0, 3)).join(", ")
          : "Every day",
    },
    {
      id: "status",
      header: "Status",
      cell: (promo) => (
        <button onClick={() => toggleActive(promo)}>
          <Badge color={promo.is_active ? "success" : "neutral"}>
            {promo.is_active ? "Active" : "Disabled"}
          </Badge>
        </button>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (promo) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => openEditForm(promo)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="!text-red-600 dark:!text-red-400" onClick={() => deletePromo(promo)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Promo Manager"
        subtitle="Discounts, buy-one-get-one deals, and bundle combos."
        action={
          <Button icon={<Plus size={16} />} onClick={openNewForm}>
            New promo
          </Button>
        }
      />

      {loading ? (
        <LoadingState label="Loading promos…" />
      ) : promotions.length === 0 ? (
        <EmptyState message="No promos yet." />
      ) : (
        <Card padding="none">
          <DataTable columns={columns} rows={promotions} getRowId={(p) => p.id} />
        </Card>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth="lg">
          <form onSubmit={handleSubmit}>
            <h2 className="mb-4 font-display text-lg font-semibold text-char-900 dark:text-cream">
              {form.id ? "Edit promo" : "New promo"}
            </h2>

            {error && (
              <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}

            <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
              Promo name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mb-3 h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
              placeholder="e.g. Wing Wednesday"
            />

            <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
              placeholder="Shown to staff on the promo list"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                  Start date
                </label>
                <input
                  required
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                  End date
                </label>
                <input
                  required
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                />
              </div>
            </div>

            <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
              Valid days{" "}
              <span className="font-normal text-char-700/50 dark:text-cream/50">
                (leave all unchecked for every day)
              </span>
            </label>
            <div className="mb-4 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`h-9 rounded-full px-3.5 text-xs font-medium ${
                    form.valid_days.includes(day)
                      ? "bg-ember-500 text-white"
                      : "bg-char-800/5 text-char-700 hover:bg-char-800/10 dark:bg-cream/5 dark:text-cream/80 dark:hover:bg-cream/10"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
              Promo type
            </label>
            <select
              value={form.promo_type}
              onChange={(e) => setForm({ ...form, promo_type: e.target.value as PromoType })}
              className="mb-3 h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
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
                <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
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
                  className="mb-3 h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                  placeholder={form.promo_type === "discount_percentage" ? "20" : "50"}
                />

                <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                  Only for this item{" "}
                  <span className="font-normal text-char-700/50 dark:text-cream/50">(optional)</span>
                </label>
                <select
                  value={form.discount_scope_product_id}
                  onChange={(e) => setForm({ ...form, discount_scope_product_id: e.target.value })}
                  className="mb-3 h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
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
                  <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                    Buy this item
                  </label>
                  <select
                    required
                    value={form.buy_product_id}
                    onChange={(e) => setForm({ ...form, buy_product_id: e.target.value })}
                    className="mb-2 h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
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
                    className="h-10 w-full rounded-md border border-char-700/20 px-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                    placeholder="Qty"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                    Get this item free
                  </label>
                  <select
                    required
                    value={form.free_product_id}
                    onChange={(e) => setForm({ ...form, free_product_id: e.target.value })}
                    className="mb-2 h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
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
                    className="h-10 w-full rounded-md border border-char-700/20 px-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                    placeholder="Qty"
                  />
                </div>
              </div>
            )}

            {/* ---- Bundle / combo ---- */}
            {form.promo_type === "bundle" && (
              <>
                <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                  Items in this bundle{" "}
                  <span className="font-normal text-char-700/50 dark:text-cream/50">
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
                  className="mb-2 h-11 w-full rounded-md border border-char-700/20 px-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                />
                <div className="mb-3 max-h-48 overflow-y-auto rounded-md border border-char-700/20 p-2 dark:border-cream/15">
                  {bundleSearchResults.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-char-700/50 dark:text-cream/50">
                      No items match your search.
                    </p>
                  ) : (
                    bundleSearchResults.map((p) => (
                      <label
                        key={p.id}
                        className="flex min-h-10 items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-char-800/5 dark:hover:bg-cream/5"
                      >
                        <input
                          type="checkbox"
                          checked={form.bundle_product_ids.includes(p.id)}
                          onChange={() => toggleBundleProduct(p.id)}
                          className="h-4 w-4 accent-ember-500"
                        />
                        <span className="flex-1 text-char-800 dark:text-cream/90">{p.name}</span>
                        <span className="text-char-700/50 dark:text-cream/50">{formatPeso(p.price)}</span>
                      </label>
                    ))
                  )}
                </div>

                <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                  Bundle price (₱)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bundle_price}
                  onChange={(e) => setForm({ ...form, bundle_price: e.target.value })}
                  className="mb-3 h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                  placeholder="e.g. 299"
                />
              </>
            )}

            <label className="mb-4 flex items-center gap-2 text-sm text-char-700 dark:text-cream/80">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 accent-ember-500"
              />
              Active
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {saving ? "Saving…" : "Save promo"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
