import Link from "next/link";
import { getInventoryItems } from "@/actions/admin/inventory";
import { getAdminProducts } from "@/actions/admin/products";
import { formatDate, truncate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RevokeButton } from "./revoke-button";

export const metadata = {
  title: "Inventory",
};

const PAGE_SIZE = 30;

const statusColors: Record<string, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reserved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  sold: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  revoked: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const productId = params.product || undefined;
  const status = params.status || undefined;

  const [{ items, total }, { products }] = await Promise.all([
    getInventoryItems({
      productId,
      status,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getAdminProducts({ limit: 200 }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { product: productId, status, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") p.set(k, v);
    }
    return `/admin/inventory?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Inventory
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {total} item{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/admin/inventory/import">
          <Button>Import Credentials</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {products.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Product:</span>
            <Link
              href={buildUrl({ product: undefined, page: "1" })}
              className={`rounded-md px-3 py-1 text-sm ${
                !productId
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              All
            </Link>
            {products.slice(0, 10).map((prod) => (
              <Link
                key={prod.id}
                href={buildUrl({ product: prod.id, page: "1" })}
                className={`rounded-md px-3 py-1 text-sm ${
                  productId === prod.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {truncate(prod.name, 20)}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status:</span>
          {[
            { label: "All", value: "all" },
            { label: "Available", value: "available" },
            { label: "Reserved", value: "reserved" },
            { label: "Sold", value: "sold" },
            { label: "Revoked", value: "revoked" },
          ].map((opt) => (
            <Link
              key={opt.value}
              href={buildUrl({ status: opt.value === "all" ? undefined : opt.value, page: "1" })}
              className={`rounded-md px-3 py-1 text-sm ${
                (status ?? "all") === opt.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">ID</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Product</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Key ID</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Created</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No inventory items found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {item.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    {item.productName}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={statusColors[item.status] ?? ""}
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {item.encryptionKeyId}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(item.status === "available" || item.status === "reserved") && (
                      <RevokeButton itemId={item.id} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
