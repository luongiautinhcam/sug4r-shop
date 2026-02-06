import Link from "next/link";
import { getAdminProducts, toggleProductStatus } from "@/actions/admin/products";
import { getAdminCategories } from "@/actions/admin/categories";
import { formatPrice, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Products",
};

const PAGE_SIZE = 20;

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const status = params.status || undefined;
  const categoryId = params.category || undefined;
  const sort = (params.sort as "name" | "price" | "newest" | "status") || "newest";

  const [{ products, total }, cats] = await Promise.all([
    getAdminProducts({
      status,
      categoryId,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getAdminCategories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleToggleStatus(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const newStatus = formData.get("status") as "draft" | "active" | "archived";
    await toggleProductStatus(id, newStatus);
    redirect("/admin/products");
  }

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { status, category: categoryId, sort, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") p.set(k, v);
    }
    return `/admin/products?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Products
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {total} product{total !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button>New Product</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status:</span>
          {[
            { label: "All", value: "all" },
            { label: "Active", value: "active" },
            { label: "Draft", value: "draft" },
            { label: "Archived", value: "archived" },
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

        {cats.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Category:</span>
            <Link
              href={buildUrl({ category: undefined, page: "1" })}
              className={`rounded-md px-3 py-1 text-sm ${
                !categoryId
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              All
            </Link>
            {cats.map((cat) => (
              <Link
                key={cat.id}
                href={buildUrl({ category: cat.id, page: "1" })}
                className={`rounded-md px-3 py-1 text-sm ${
                  categoryId === cat.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Sort:</span>
          {[
            { label: "Newest", value: "newest" },
            { label: "Name", value: "name" },
            { label: "Price", value: "price" },
          ].map((opt) => (
            <Link
              key={opt.value}
              href={buildUrl({ sort: opt.value, page: "1" })}
              className={`rounded-md px-3 py-1 text-sm ${
                sort === opt.value
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
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Product</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Category</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Price</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Inventory</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Created</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-zinc-500">/{p.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {p.categoryName ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {formatPrice(p.price, p.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={statusColors[p.status] ?? ""}
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={p.availableCount === 0 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50"}>
                      {p.availableCount}
                    </span>
                    <span className="text-zinc-400"> / {p.totalCount}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/products/${p.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Link>
                      {p.status !== "active" && (
                        <form action={handleToggleStatus}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value="active" />
                          <Button variant="outline" size="sm" type="submit">
                            Activate
                          </Button>
                        </form>
                      )}
                      {p.status === "active" && (
                        <form action={handleToggleStatus}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="status" value="archived" />
                          <Button variant="outline" size="sm" type="submit">
                            Archive
                          </Button>
                        </form>
                      )}
                    </div>
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
