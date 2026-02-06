"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { lookupOrderAction, type OrderLookupResult } from "@/actions/order-lookup";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fulfilled: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  refunded: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function OrderLookupForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderLookupResult | null>(null);

  const [orderCode, setOrderCode] = useState(searchParams.get("code") ?? "");
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOrder(null);

    startTransition(async () => {
      const result = await lookupOrderAction({ orderCode, email });

      if (!result.success) {
        setError(result.error ?? "Order not found");
        return;
      }

      setOrder(result.data!);
    });
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Track Your Order
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Enter your order code and email to check your order status.
        </p>
      </div>

      {/* Lookup Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orderCode">Order Code *</Label>
              <Input
                id="orderCode"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                required
                placeholder="ORD-XXXXXX"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Looking up..." : "Look Up Order"}
        </Button>
      </form>

      {/* Order Result */}
      {order && (
        <div className="mt-8 space-y-6">
          {/* Order Header */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">Order</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  {order.orderCode}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={statusColors[order.status] ?? ""}
              >
                {order.status}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Total</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatPrice(order.total)}
                </p>
              </div>
              <div>
                <p className="text-zinc-500">Date</p>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              {order.payment && (
                <div>
                  <p className="text-zinc-500">Payment</p>
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {order.payment.status === "confirmed" ? "Paid" : order.payment.status}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Order Items */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-3 text-sm font-medium text-zinc-500">Items</h2>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-900 dark:text-zinc-50">
                    {item.productName} x {item.quantity}
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {formatPrice(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Links */}
          {order.deliveryLinks.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-3 text-sm font-medium text-zinc-500">
                Delivery
              </h2>
              <div className="space-y-3">
                {order.deliveryLinks.map((link, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
                  >
                    <div className="text-sm">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        Credential #{i + 1}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {link.revealed
                          ? "Already revealed"
                          : link.expired
                            ? "Link expired"
                            : "Ready to reveal"}
                      </p>
                    </div>
                    {!link.revealed && !link.expired && (
                      <Link href={`/delivery/${link.token}`}>
                        <Button size="sm">View</Button>
                      </Link>
                    )}
                    {link.revealed && (
                      <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        Revealed
                      </Badge>
                    )}
                    {!link.revealed && link.expired && (
                      <Badge variant="secondary" className="bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400">
                        Expired
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending message */}
          {order.status === "pending" && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
              Your order is pending payment. Please complete the payment to proceed.
            </div>
          )}

          {order.status === "paid" && order.deliveryLinks.length === 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
              Payment received! Your order is being processed. Delivery links will appear here once fulfilled.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
