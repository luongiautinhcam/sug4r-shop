import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerOrders } from "@/actions/admin/customers";
import { formatPrice, formatDate, redactEmail } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fulfilled: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  refunded: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PAGE_SIZE = 30;

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ email: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { email: encodedEmail } = await params;
  const sp = await searchParams;
  const email = decodeURIComponent(encodedEmail);
  const page = Math.max(1, parseInt(sp.page ?? "1"));

  const { orders, total } = await getCustomerOrders(email, {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  if (total === 0 && page === 1) {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/customers"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          &larr; Back to customers
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {redactEmail(email)}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {total} order{total !== 1 ? "s" : ""}
          {orders.length > 0 && ` · Total spent: ${formatPrice(totalSpent, orders[0].currency)}`}
        </p>
      </div>

      {/* Orders Table */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Order</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Total</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Date</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
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
                <td className="px-4 py-3">
                  <Badge variant="secondary" className={statusColors[order.status] ?? ""}>
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
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </td>
              </tr>
            ))}
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
              <Link href={`?page=${page - 1}`}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link href={`?page=${page + 1}`}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
