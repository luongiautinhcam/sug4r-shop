import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { getDashboardKPIs } from "@/actions/admin/dashboard";
import { formatPrice, formatDate, redactEmail } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Dashboard",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fulfilled: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  refunded: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default async function AdminDashboardPage() {
  const { user } = await requireAdmin();
  const kpis = await getDashboardKPIs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Welcome back, {user.email}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Revenue (Today)
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {formatPrice(kpis.revenue.today, kpis.revenue.currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Month: {formatPrice(kpis.revenue.month, kpis.revenue.currency)} &middot;
            All-time: {formatPrice(kpis.revenue.allTime, kpis.revenue.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Total Orders
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {kpis.orders.total}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Paid: {kpis.orders.paid} &middot; Fulfilled: {kpis.orders.fulfilled}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Pending Orders
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {kpis.orders.pending}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Awaiting payment confirmation
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Low Stock
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {kpis.lowStockProducts.length}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Products with &lt;5 items available
          </p>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {kpis.lowStockProducts.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
            Low Stock Alerts
          </h3>
          <ul className="mt-2 space-y-1">
            {kpis.lowStockProducts.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <Link
                  href={`/admin/products/${p.id}/edit`}
                  className="text-yellow-800 underline dark:text-yellow-200"
                >
                  {p.name}
                </Link>
                <span className="text-yellow-700 dark:text-yellow-300">
                  {p.available} left
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Recent Orders
          </h2>
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">View all</Button>
          </Link>
        </div>
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Order</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Total</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {kpis.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    No orders yet.
                  </td>
                </tr>
              ) : (
                kpis.recentOrders.map((order) => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Security Events */}
      {kpis.recentSecurityEvents.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Recent Security Events
            </h2>
            <Link href="/admin/logs?tab=security">
              <Button variant="outline" size="sm">View all</Button>
            </Link>
          </div>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Severity</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">IP</th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {kpis.recentSecurityEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="px-4 py-3 font-mono text-zinc-900 dark:text-zinc-50">
                      {event.eventType}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={severityColors[event.severity] ?? ""}>
                        {event.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {event.ipAddress ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {formatDate(event.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
