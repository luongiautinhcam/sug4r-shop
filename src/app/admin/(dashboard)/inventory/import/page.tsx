"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importInventoryItems } from "@/actions/admin/inventory";
import { getAdminProducts } from "@/actions/admin/products";
import type { AdminProduct } from "@/actions/admin/products";
import { useEffect } from "react";

export default function ImportInventoryPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productId, setProductId] = useState("");
  const [credentials, setCredentials] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminProducts({ limit: 200 }).then(({ products }) => {
      setProducts(products);
      setLoading(false);
    });
  }, []);

  const lines = credentials
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!productId) {
      setError("Please select a product");
      return;
    }

    if (lines.length === 0) {
      setError("Please enter at least one credential");
      return;
    }

    if (lines.length > 500) {
      setError("Maximum 500 credentials per import");
      return;
    }

    startTransition(async () => {
      const result = await importInventoryItems({
        productId,
        credentials: lines,
      });

      if (!result.success) {
        setError(result.error ?? "Import failed");
        return;
      }

      setSuccess(`Successfully imported ${result.data?.imported} credential(s).`);
      setCredentials("");
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Import Credentials
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add encrypted inventory items to a product. Each credential is encrypted with AES-256-GCM before storage.
        </p>
      </div>

      <div className="max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
              {success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="product">Product *</Label>
            {loading ? (
              <p className="text-sm text-zinc-500">Loading products...</p>
            ) : (
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.availableCount} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="credentials">Credentials *</Label>
            <Textarea
              id="credentials"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              rows={10}
              placeholder={"user1@example.com:password123\nuser2@example.com:password456\nlicense-key-abc-123"}
              className="font-mono text-sm"
            />
            <p className="text-xs text-zinc-500">
              Enter one credential per line. Each line will be individually encrypted.
            </p>
          </div>

          {/* Preview */}
          {lines.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Preview
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-bold">{lines.length}</span> credential{lines.length !== 1 ? "s" : ""} will be encrypted and imported.
              </p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={isPending || loading}>
              {isPending ? "Importing..." : `Import ${lines.length > 0 ? lines.length : ""} Credential${lines.length !== 1 ? "s" : ""}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/inventory")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
