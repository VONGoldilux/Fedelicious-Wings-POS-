"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/EmptyState";

const CATEGORY_OPTIONS = [
  "Wings",
  "Rice Meals",
  "Soups",
  "Noodles",
  "Pasta",
  "Party Meals",
  "Beverages",
  "Snacks",
  "Add-ons",
];

const EMPTY_FORM = {
  id: null as string | null,
  name: "",
  description: "",
  price: "",
  category: "Wings",
  is_available: true,
};

export default function ProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  function openNewForm() {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      category: p.category,
      is_available: p.is_available,
    });
    setImageFile(null);
    setImagePreview(p.image_url);
    setError(null);
    setShowForm(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let image_url: string | undefined;

      // 1. Upload the image to the `menu-images` Storage bucket, if a new
      //    file was chosen. Path is namespaced by a random id so re-uploads
      //    of the same filename never collide.
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(path, imageFile, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("menu-images")
          .getPublicUrl(path);
        image_url = publicUrlData.publicUrl;
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        category: form.category.trim() || "Wings",
        is_available: form.is_available,
        ...(image_url ? { image_url } : {}),
      };

      if (form.id) {
        const { error: updateError } = await supabase
          .from("products")
          .update(payload)
          .eq("id", form.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("products")
          .insert(payload);
        if (insertError) throw insertError;
      }

      setShowForm(false);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(p: Product) {
    await supabase
      .from("products")
      .update({ is_available: !p.is_available })
      .eq("id", p.id);
    loadProducts();
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`Remove "${p.name}" from the menu?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      alert(`Couldn't delete "${p.name}": ${error.message}`);
      return;
    }
    loadProducts();
  }

  return (
    <div>
      <PageHeader
        title="Menu Management"
        subtitle="Add, edit, and photograph items on the Fedelicious Wings menu."
        action={
          <Button icon={<Plus size={16} />} onClick={openNewForm}>
            New item
          </Button>
        }
      />

      {loading ? (
        <LoadingState label="Loading menu…" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <Card key={p.id} padding="none" className="overflow-hidden">
              <div className="relative h-36 w-full bg-char-800/5 dark:bg-cream/5">
                {p.image_url ? (
                  <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-char-700/30 dark:text-cream/30">
                    No image
                  </div>
                )}
                {!p.is_available && (
                  <span className="absolute left-2 top-2">
                    <Badge color="neutral" className="!bg-char-950/80 !text-cream">
                      Unavailable
                    </Badge>
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ember-600 dark:text-ember-400">
                  {p.category}
                </p>
                <h3 className="font-display font-semibold text-char-900 dark:text-cream">{p.name}</h3>
                <p className="mt-1 text-sm font-semibold text-char-900 dark:text-cream">
                  {formatPeso(p.price)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditForm(p)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleAvailability(p)}>
                    {p.is_available ? "Hide" : "Show"}
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto !text-red-600 dark:!text-red-400" onClick={() => deleteProduct(p)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth="md">
          <form onSubmit={handleSubmit}>
            <h2 className="mb-4 font-display text-lg font-semibold text-char-900 dark:text-cream">
              {form.id ? "Edit item" : "New menu item"}
            </h2>

            {error && (
              <div className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400">
                {error}
              </div>
            )}

            <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
              Photo
            </label>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-char-800/5 dark:bg-cream/5">
                {imagePreview && <Image src={imagePreview} alt="Preview" fill className="object-cover" />}
              </div>
              <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm text-char-700 dark:text-cream/80" />
            </div>

            <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mb-3 h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
              placeholder="e.g. Spicy Garlic Wings (6pc)"
            />

            <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
              Description / info
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
              rows={2}
              placeholder="Short description shown to cashiers/customers"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                  Price (₱)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-char-700 dark:text-cream/80">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="h-11 w-full rounded-md border border-char-700/20 px-3 focus:border-ember-500 focus:outline-none dark:border-cream/15 dark:bg-char-800 dark:text-cream"
                >
                  {(CATEGORY_OPTIONS.includes(form.category)
                    ? CATEGORY_OPTIONS
                    : [form.category, ...CATEGORY_OPTIONS]
                  ).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm text-char-700 dark:text-cream/80">
              <input
                type="checkbox"
                checked={form.is_available}
                onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
                className="h-4 w-4 accent-ember-500"
              />
              Available on the POS
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {saving ? "Saving…" : "Save item"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
