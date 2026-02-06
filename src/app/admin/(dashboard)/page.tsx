import { requireAdmin } from "@/lib/auth-guard";

export const metadata = {
  title: "Dashboard",
};

export default async function AdminDashboardPage() {
  const { user } = await requireAdmin();

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI cards will be added in Phase 7 */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Revenue (Today)
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            $0.00
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Orders
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            0
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Pending
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            0
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Low Stock
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            0
          </p>
        </div>
      </div>
    </div>
  );
}
