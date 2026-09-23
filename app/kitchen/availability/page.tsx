"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { LoadingState, EmptyState } from "@/components/ui/EmptyState";

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
      <PageHeader
        title="Menu Availability"
        subtitle="Mark items unavailable when you're out of stock — they'll disappear from the cashier's ordering screen instantly."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-char-700/40 dark:text-cream/40"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search menu items…"
            className="h-11 w-full rounded-md border border-char-700/20 bg-white pl-9 pr-3 text-sm focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-900 dark:text-cream"
          />
        </div>
        <label className="flex h-11 items-center gap-2 text-sm text-char-700 dark:text-cream/80">
          <input
            type="checkbox"
            checked={unavailableOnly}
            onChange={(e) => setUnavailableOnly(e.target.checked)}
            className="h-4 w-4 accent-ember-500"
          />
          Show unavailable only
        </label>
      </div>

      {loading ? (
        <LoadingState label="Loading menu…" />
      ) : products.length === 0 ? (
        <EmptyState message="No menu items yet." />
      ) : byCategory.length === 0 ? (
        <EmptyState message="No items match your search." />
      ) : (
        <div className="space-y-6">
          {byCategory.map(([category, items]) => (
            <div key={category}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display font-semibold text-char-900 dark:text-cream">
                  {category}
                </h2>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingCategory === category}
                    onClick={() => setCategoryAvailability(category, false)}
                  >
                    {updatingCategory === category ? "Saving…" : `Mark all unavailable`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updatingCategory === category}
                    onClick={() => setCategoryAvailability(category, true)}
                  >
                    Mark all available
                  </Button>
                </div>
              </div>
              <Card padding="none">
                <ul className="divide-y divide-char-700/10 dark:divide-cream/10">
                  {items.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-char-900 dark:text-cream">{p.name}</p>
                        {p.description && (
                          <p className="line-clamp-1 text-xs text-char-700/50 dark:text-cream/50">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <span className="hidden text-sm text-char-700/70 dark:text-cream/70 sm:inline">
                        {formatPeso(p.price)}
                      </span>
                      <Badge color={p.is_available ? "success" : "neutral"}>
                        {p.is_available ? "Available" : "Unavailable"}
                      </Badge>
                      <Switch
                        checked={p.is_available}
                        disabled={updatingId === p.id}
                        onChange={() => toggleAvailability(p)}
                        label={`Toggle availability for ${p.name}`}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
