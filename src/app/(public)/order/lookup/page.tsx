import { Suspense } from "react";
import { OrderLookupForm } from "./lookup-form";

export const metadata = {
  title: "Track Order",
  description: "Look up your order status using your order code and email.",
};

export default function OrderLookupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-12">
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      }
    >
      <OrderLookupForm />
    </Suspense>
  );
}
