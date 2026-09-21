"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { formatPeso } from "@/lib/utils";
import type { Product } from "@/lib/types";

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
    await supabase.from("products").delete().eq("id", p.id);
    loadProducts();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-char-900">
            Menu Management
          </h1>
          <p className="text-sm text-char-700/70">
            Add, edit, and photograph items on the Fedelicious Wings menu.
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="rounded-md bg-ember-500 px-4 py-2 font-medium text-white hover:bg-ember-600"
        >
          + New item
        </button>
      </div>

      {loading ? (
        <p className="text-char-700/60">Loading menu…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-card border border-char-700/10 bg-white shadow-sm"
            >
              <div className="relative h-36 w-full bg-char-800/5">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-char-700/30">
                    No image
                  </div>
                )}
                {!p.is_available && (
                  <span className="absolute left-2 top-2 rounded bg-char-950/80 px-2 py-0.5 text-xs text-cream">
                    Unavailable
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs uppercase tracking-wide text-ember-600">
                  {p.category}
                </p>
                <h3 className="font-display font-semibold text-char-900">
                  {p.name}
                </h3>
                <p className="mt-1 text-sm font-semibold text-char-900">
                  {formatPeso(p.price)}
                </p>
                <div className="mt-3 flex gap-2 text-sm">
                  <button
                    onClick={() => openEditForm(p)}
                    className="rounded border border-char-700/20 px-2 py-1 text-char-700 hover:border-ember-500 hover:text-ember-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleAvailability(p)}
                    className="rounded border border-char-700/20 px-2 py-1 text-char-700 hover:border-ember-500 hover:text-ember-600"
                  >
                    {p.is_available ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => deleteProduct(p)}
                    className="ml-auto rounded px-2 py-1 text-ember-600 hover:bg-ember-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-card bg-white p-6 shadow-xl"
          >
            <h2 className="mb-4 font-display text-lg font-semibold">
              {form.id ? "Edit item" : "New menu item"}
            </h2>

            {error && (
              <div className="mb-3 rounded border border-ember-300 bg-ember-50 px-3 py-2 text-sm text-ember-700">
                {error}
              </div>
            )}

            <label className="mb-1 block text-sm font-medium text-char-700">
              Photo
            </label>
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-char-800/5">
                {imagePreview && (
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-sm"
              />
            </div>

            <label className="mb-1 block text-sm font-medium text-char-700">
              Name
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
              placeholder="e.g. Spicy Garlic Wings (6pc)"
            />

            <label className="mb-1 block text-sm font-medium text-char-700">
              Description / info
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mb-3 w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
              rows={2}
              placeholder="Short description shown to cashiers/customers"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-char-700">
                  Price (₱)
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-char-700">
                  Category
                </label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-md border border-char-700/20 px-3 py-2 focus:border-ember-500 focus:outline-none"
                  placeholder="Wings, Sides, Drinks…"
                />
              </div>
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm text-char-700">
              <input
                type="checkbox"
                checked={form.is_available}
                onChange={(e) =>
                  setForm({ ...form, is_available: e.target.checked })
                }
              />
              Available on the POS
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
                {saving ? "Saving…" : "Save item"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
