"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getActiveProducts } from "@/actions/products";
import { createOrderAction, type CheckoutResult } from "@/actions/checkout";
import type { PublicProduct } from "@/actions/products";

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function CheckoutForm() {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<CheckoutResult | null>(null);

  // Form state
  const [productId, setProductId] = useState(searchParams.get("product") ?? "");
  const [quantity, setQuantity] = useState("1");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");

  useEffect(() => {
    getActiveProducts({ limit: 100 }).then(({ products }) => {
      setProducts(products);
      setLoading(false);
    });
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);
  const qty = Math.max(1, Math.min(10, parseInt(quantity) || 1));
  const totalCents = selectedProduct ? selectedProduct.price * qty : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!productId) {
      setError("Please select a product");
      return;
    }

    if (email !== emailConfirm) {
      setError("Email addresses do not match");
      return;
    }

    startTransition(async () => {
      const result = await createOrderAction({
        email,
        emailConfirm,
        productId,
        quantity: qty,
        paymentMethod: "manual_transfer",
      });

      if (!result.success) {
        setError(result.error ?? "An error occurred");
        return;
      }

      setOrderResult(result.data!);
    });
  }

  // Order placed successfully — show confirmation
  if (orderResult) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center dark:border-green-900 dark:bg-green-950">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Order Placed!
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your order code is:
          </p>
          <p className="mt-2 text-3xl font-bold tracking-widest text-zinc-900 dark:text-zinc-50">
            {orderResult.orderCode}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Total: {formatPrice(orderResult.total)}
          </p>
        </div>

        {orderResult.paymentInstructions && (
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Payment Instructions
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {orderResult.paymentInstructions}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          <Link href={`/order/lookup?code=${orderResult.orderCode}`}>
            <Button>Track Your Order</Button>
          </Link>
          <Link href="/catalog" className="text-sm text-zinc-500 hover:underline">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Complete your purchase securely.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Product Selection */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Product
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product">Select Product *</Label>
              {loading ? (
                <p className="text-sm text-zinc-500">Loading products...</p>
              ) : (
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter((p) => p.inStock).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {formatPrice(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max="10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          {selectedProduct && !selectedProduct.inStock && (
            <p className="mt-2 text-sm text-red-600">This product is currently out of stock.</p>
          )}
        </div>

        {/* Email */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Your Email
          </h2>
          <p className="mb-4 text-xs text-zinc-500">
            Your email is used to look up your order. Double-check it carefully.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="space-y-2">
              <Label htmlFor="emailConfirm">Confirm Email *</Label>
              <Input
                id="emailConfirm"
                type="email"
                value={emailConfirm}
                onChange={(e) => setEmailConfirm(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
          </div>
        </div>

        {/* Order Summary */}
        {selectedProduct && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Order Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {selectedProduct.name} x {qty}
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatPrice(totalCents)}
                </span>
              </div>
              <div className="border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <div className="flex justify-between">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">Total</span>
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {formatPrice(totalCents)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={isPending || loading || !productId || !email || !emailConfirm}
        >
          {isPending ? "Placing Order..." : "Place Order"}
        </Button>
      </form>
    </div>
  );
}
