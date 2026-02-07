import Link from "next/link";
import { getCustomers } from "@/actions/admin/customers";
import { formatPrice, formatDate, redactEmail } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Customers",
};

const PAGE_SIZE = 30;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const search = params.search || undefined;

  const { customers, total } = await getCustomers({
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { search, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) p.set(k, v);
    }
    return `/admin/customers?${p.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Customers
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {total} unique customer{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search */}
      <form className="flex items-center gap-2">
        <input
          name="search"
          type="text"
          placeholder="Search by email..."
          defaultValue={search ?? ""}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {search && (
          <Link href="/admin/customers">
            <Button variant="ghost" size="sm">Clear</Button>
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Email</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Orders</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Total Spent</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Last Order</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No customers found.
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr
                  key={customer.email}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    {redactEmail(customer.email)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {customer.orderCount}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {formatPrice(customer.totalSpent, customer.currency)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDate(customer.lastOrderAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/customers/${encodeURIComponent(customer.email)}`}>
                      <Button variant="outline" size="sm">View</Button>
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
