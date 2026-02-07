"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { toast } from "sonner";
import {
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/actions/admin/categories";
import type { AdminCategory } from "@/actions/admin/categories";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [autoSlug, setAutoSlug] = useState(true);

  function loadCategories() {
    getAdminCategories().then((cats) => {
      setCategories(cats);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function resetForm() {
    setEditingId(null);
    setShowCreate(false);
    setFormName("");
    setFormSlug("");
    setFormSortOrder("0");
    setAutoSlug(true);
    setError(null);
  }

  function startEdit(cat: AdminCategory) {
    setShowCreate(false);
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormSortOrder(String(cat.sortOrder));
    setAutoSlug(false);
    setError(null);
  }

  function startCreate() {
    setEditingId(null);
    setShowCreate(true);
    setFormName("");
    setFormSlug("");
    setFormSortOrder("0");
    setAutoSlug(true);
    setError(null);
  }

  function handleNameChange(value: string) {
    setFormName(value);
    if (autoSlug) {
      setFormSlug(slugify(value));
    }
  }

  function handleSave() {
    setError(null);

    if (!formName.trim()) {
      setError("Name is required");
      return;
    }
    if (!formSlug.trim()) {
      setError("Slug is required");
      return;
    }

    startTransition(async () => {
      const data = {
        name: formName.trim(),
        slug: formSlug.trim(),
        sortOrder: parseInt(formSortOrder) || 0,
        isActive: true,
      };

      const result = editingId
        ? await updateCategory({ id: editingId, ...data })
        : await createCategory(data);

      if (!result.success) {
        setError(result.error ?? "An error occurred");
        return;
      }

      toast.success(editingId ? "Category updated" : "Category created");
      resetForm();
      loadCategories();
    });
  }

  async function handleDelete(id: string) {
    const result = await deleteCategory(id);
    if (!result.success) {
      toast.error(result.error ?? "Failed to delete category");
      return;
    }
    toast.success("Category deleted");
    loadCategories();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Categories
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        {!showCreate && !editingId && (
          <Button onClick={startCreate}>New Category</Button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Create / Edit Form */}
      {(showCreate || editingId) && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {editingId ? "Edit Category" : "New Category"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Streaming"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formSlug}
                onChange={(e) => {
                  setFormSlug(e.target.value);
                  setAutoSlug(false);
                }}
                placeholder="e.g., streaming"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">Sort Order</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : editingId ? "Save Changes" : "Create"}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Category List */}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading categories...</p>
      ) : (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Products</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Sort Order</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No categories yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {cat.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {cat.slug}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {cat.productCount}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {cat.sortOrder}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={
                          cat.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }
                      >
                        {cat.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(cat)}
                        >
                          Edit
                        </Button>
                        {cat.productCount === 0 && (
                          <ConfirmButton
                            title="Delete category?"
                            description={`"${cat.name}" will be permanently deleted. This cannot be undone.`}
                            confirmLabel="Delete"
                            variant="outline"
                            size="sm"
                            onConfirm={() => handleDelete(cat.id)}
                          >
                            Delete
                          </ConfirmButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
