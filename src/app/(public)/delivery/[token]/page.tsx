import { checkDeliveryToken } from "@/lib/delivery";
import { DeliveryReveal } from "./delivery-reveal";
import Link from "next/link";

export const metadata = {
  title: "Delivery",
};

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const check = await checkDeliveryToken(token);

  if (check.status === "not_found") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-950">
          <h1 className="text-xl font-bold text-red-800 dark:text-red-200">
            Invalid Delivery Link
          </h1>
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            This delivery link is not valid. Please check your order confirmation
            for the correct link.
          </p>
        </div>
        <Link
          href="/order/lookup"
          className="mt-6 inline-block text-sm text-zinc-500 hover:underline"
        >
          Look up your order
        </Link>
      </div>
    );
  }

  if (check.status === "expired") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-8 dark:border-yellow-900 dark:bg-yellow-950">
          <h1 className="text-xl font-bold text-yellow-800 dark:text-yellow-200">
            Delivery Link Expired
          </h1>
          <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
            This delivery link for <strong>{check.productName}</strong> has
            expired. Please contact support if you need assistance.
          </p>
        </div>
        <Link
          href="/order/lookup"
          className="mt-6 inline-block text-sm text-zinc-500 hover:underline"
        >
          Look up your order
        </Link>
      </div>
    );
  }

  if (check.status === "revealed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Already Revealed
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The credential for <strong>{check.productName}</strong> has already
            been revealed and cannot be shown again.
          </p>
        </div>
        <Link
          href="/order/lookup"
          className="mt-6 inline-block text-sm text-zinc-500 hover:underline"
        >
          Look up your order
        </Link>
      </div>
    );
  }

  // Status is "ready" — show the reveal UI
  return <DeliveryReveal token={token} productName={check.productName!} />;
}
