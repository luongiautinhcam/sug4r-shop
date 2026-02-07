import { notFound } from "next/navigation";
import { getOrderDetail } from "@/actions/admin/orders";
import { formatPrice, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { OrderActions } from "./order-actions";

export const metadata = {
  title: "Order Detail",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fulfilled: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  refunded: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderDetail(id);

  if (!order) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Order {order.orderCode}
            </h1>
            <p className="text-sm text-zinc-500">
              {order.customerEmail}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={statusColors[order.status] ?? ""}
          >
            {order.status}
          </Badge>
        </div>
        <OrderActions orderId={id} status={order.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Items */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-sm font-medium uppercase text-zinc-500">
              Items
            </h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {item.productName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatPrice(item.unitPrice)} x {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {formatPrice(item.totalPrice)}
                  </p>
                </div>
              ))}
              <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">Total</span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {formatPrice(order.total, order.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-sm font-medium uppercase text-zinc-500">
              Payment History
            </h2>
            {order.paymentHistory.length === 0 ? (
              <p className="text-sm text-zinc-500">No payment records.</p>
            ) : (
              <div className="space-y-3">
                {order.paymentHistory.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
                  >
                    <div className="text-sm">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {p.method.replace("_", " ")}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDate(p.createdAt)}
                        {p.providerTxId && ` · ${p.providerTxId}`}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={statusColors[p.status] ?? ""}
                    >
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery Events */}
          {order.deliveries.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-4 text-sm font-medium uppercase text-zinc-500">
                Deliveries
              </h2>
              <div className="space-y-3">
                {order.deliveries.map((d, i) => {
                  const isExpired = new Date(d.tokenExpiresAt) < new Date();
                  const isRevealed = d.revealedAt !== null;

                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
                    >
                      <div className="text-sm">
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          Credential #{i + 1}
                        </p>
                        <p className="font-mono text-xs text-zinc-500">
                          {d.token.slice(0, 16)}...
                        </p>
                        <p className="text-xs text-zinc-500">
                          Reveals: {d.revealCount}/{d.maxReveals} · Expires: {formatDate(d.tokenExpiresAt)}
                        </p>
                      </div>
                      <div>
                        {isRevealed && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Revealed
                          </Badge>
                        )}
                        {!isRevealed && isExpired && (
                          <Badge variant="secondary" className="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
                            Expired
                          </Badge>
                        )}
                        {!isRevealed && !isExpired && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="mb-3 text-sm font-medium uppercase text-zinc-500">
              Order Info
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Order Code</dt>
                <dd className="font-mono font-medium text-zinc-900 dark:text-zinc-50">
                  {order.orderCode}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Created</dt>
                <dd className="text-zinc-900 dark:text-zinc-50">
                  {formatDate(order.createdAt)}
                </dd>
              </div>
              {order.fulfilledAt && (
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Fulfilled</dt>
                  <dd className="text-zinc-900 dark:text-zinc-50">
                    {formatDate(order.fulfilledAt)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-zinc-500">IP Address</dt>
                <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                  {order.ipAddress ?? "—"}
                </dd>
              </div>
            </dl>
          </div>

          {order.notes && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="mb-2 text-sm font-medium uppercase text-zinc-500">
                Notes
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {order.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
