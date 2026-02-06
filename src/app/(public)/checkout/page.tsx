import { Suspense } from "react";
import { CheckoutForm } from "./checkout-form";

export const metadata = {
  title: "Checkout",
};

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-12">
          <p className="text-sm text-zinc-500">Loading checkout...</p>
        </div>
      }
    >
      <CheckoutForm />
    </Suspense>
  );
}
