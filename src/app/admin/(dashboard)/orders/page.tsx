import Link from "next/link";
import { getOrders } from "@/actions/admin/orders";
import { formatPrice, formatDate, redactEmail } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Orders",
};

const PAGE_SIZE = 30;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fulfilled: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  refunded: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const status = params.status || undefined;

  const { orders, total } = await getOrders({
    status,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { status, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") p.set(k, v);
    }
    return `/admin/orders?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Orders
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {total} order{total !== 1 ? "s" : ""} total
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status:</span>
        {[
          { label: "All", value: "all" },
          { label: "Pending", value: "pending" },
          { label: "Paid", value: "paid" },
          { label: "Fulfilled", value: "fulfilled" },
          { label: "Refunded", value: "refunded" },
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

      {/* Table */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Order</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Customer</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Total</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Date</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {order.orderCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {redactEmail(order.customerEmail)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={statusColors[order.status] ?? ""}
                    >
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {formatPrice(order.total, order.currency)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
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
