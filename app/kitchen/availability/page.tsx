"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import type { Product } from "@/lib/types";

export default function KitchenAvailabilityPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [unavailableOnly, setUnavailableOnly] = useState(false);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name");
    setProducts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleAvailability(p: Product) {
    setUpdatingId(p.id);
    const nextAvailable = !p.is_available;
    const { error } = await supabase.rpc("set_product_availability", {
      product_id: p.id,
      available: nextAvailable,
    });
    if (!error) {
      setProducts((prev) =>
        prev.map((item) =>
          item.id === p.id ? { ...item, is_available: nextAvailable } : item
        )
      );
    }
    setUpdatingId(null);
  }

  async function setCategoryAvailability(category: string, available: boolean) {
    const targets = products.filter((p) => p.category === category);
    setUpdatingCategory(category);
    await Promise.all(
      targets.map((p) =>
        supabase.rpc("set_product_availability", {
          product_id: p.id,
          available,
        })
      )
    );
    setProducts((prev) =>
      prev.map((item) =>
        item.category === category ? { ...item, is_available: available } : item
      )
    );
    setUpdatingCategory(null);
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (unavailableOnly && p.is_available) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, search, unavailableOnly]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filteredProducts) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries());
  }, [filteredProducts]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-char-900">
          Menu Availability
        </h1>
        <p className="text-sm text-char-700/70">
          Mark items unavailable when you're out of stock — they'll
          disappear from the cashier's ordering screen instantly.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu items…"
          className="w-full max-w-sm rounded-md border border-char-700/20 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-char-700">
          <input
            type="checkbox"
            checked={unavailableOnly}
            onChange={(e) => setUnavailableOnly(e.target.checked)}
          />
          Show unavailable only
        </label>
      </div>

      {loading ? (
        <p className="text-char-700/60">Loading menu…</p>
      ) : products.length === 0 ? (
        <p className="text-char-700/60">No menu items yet.</p>
      ) : byCategory.length === 0 ? (
        <p className="text-char-700/60">No items match your search.</p>
      ) : (
        <div className="space-y-6">
          {byCategory.map(([category, items]) => (
            <div key={category}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display font-semibold text-char-900">
                  {category}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCategoryAvailability(category, false)}
                    disabled={updatingCategory === category}
                    className="rounded border border-char-700/20 px-2.5 py-1 text-xs font-medium text-char-800 hover:bg-char-800/5 disabled:opacity-50"
                  >
                    {updatingCategory === category
                      ? "Saving…"
                      : `Mark all ${category} unavailable`}
                  </button>
                  <button
                    onClick={() => setCategoryAvailability(category, true)}
                    disabled={updatingCategory === category}
                    className="rounded border border-char-700/20 px-2.5 py-1 text-xs font-medium text-char-800 hover:bg-char-800/5 disabled:opacity-50"
                  >
                    Mark all available
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-card border border-char-700/10 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-char-700/10">
                    {items.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-char-900">{p.name}</p>
                          {p.description && (
                            <p className="text-xs text-char-700/50 line-clamp-1">
                              {p.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-char-700/70">
                          {formatPeso(p.price)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.is_available
                                ? "bg-green-100 text-green-700"
                                : "bg-char-800/10 text-char-700"
                            }`}
                          >
                            {p.is_available ? "Available" : "Unavailable"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => toggleAvailability(p)}
                            disabled={updatingId === p.id}
                            className="rounded border border-char-700/20 px-3 py-1.5 text-xs font-medium text-char-800 hover:bg-char-800/5 disabled:opacity-50"
                          >
                            {updatingId === p.id
                              ? "Saving…"
                              : p.is_available
                              ? "Mark unavailable"
                              : "Mark available"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
