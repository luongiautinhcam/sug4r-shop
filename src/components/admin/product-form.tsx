"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProduct, updateProduct } from "@/actions/admin/products";
import type { AdminProduct } from "@/actions/admin/products";

interface ProductFormProps {
  product?: AdminProduct | null;
  categories: { id: string; name: string }[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [autoSlug, setAutoSlug] = useState(!product);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [shortDesc, setShortDesc] = useState(product?.shortDesc ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [price, setPrice] = useState(product ? (product.price / 100).toFixed(2) : "");
  const [status, setStatus] = useState<"draft" | "active" | "archived">(
    (product?.status as "draft" | "active" | "archived") ?? "draft",
  );
  const [sortOrder, setSortOrder] = useState(String(product?.sortOrder ?? 0));

  function handleNameChange(value: string) {
    setName(value);
    if (autoSlug) {
      setSlug(slugify(value));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceInCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceInCents) || priceInCents < 1) {
      setError("Price must be a positive number");
      return;
    }

    startTransition(async () => {
      const data = {
        name,
        slug,
        categoryId: categoryId || null,
        description: description || undefined,
        shortDesc: shortDesc || undefined,
        imageUrl: imageUrl || undefined,
        price: priceInCents,
        currency: "USD",
        status,
        sortOrder: parseInt(sortOrder) || 0,
      };

      const result = product
        ? await updateProduct({ id: product.id, ...data })
        : await createProduct(data);

      if (!result.success) {
        setError(result.error ?? "An error occurred");
        return;
      }

      router.push("/admin/products");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="e.g., Netflix Premium 1 Month"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setAutoSlug(false);
            }}
            required
            placeholder="e.g., netflix-premium-1-month"
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          />
          <p className="text-xs text-zinc-500">
            Used in the URL. Lowercase letters, numbers, and hyphens only.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Category</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price (USD) *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder="9.99"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input
            id="imageUrl"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="shortDesc">Short Description</Label>
          <Input
            id="shortDesc"
            value={shortDesc}
            onChange={(e) => setShortDesc(e.target.value)}
            maxLength={500}
            placeholder="Brief description shown in product cards"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Full Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Detailed product description (supports plain text)"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? product
              ? "Saving..."
              : "Creating..."
            : product
              ? "Save Changes"
              : "Create Product"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/products")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
