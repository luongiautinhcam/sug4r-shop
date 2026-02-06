"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { revealDeliveryAction } from "@/actions/delivery";

export function DeliveryReveal({
  token,
  productName,
}: {
  token: string;
  productName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [credential, setCredential] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleReveal() {
    setError(null);
    startTransition(async () => {
      const result = await revealDeliveryAction(token);

      if (!result.success) {
        setError(result.error ?? "An error occurred");
        return;
      }

      if (!result.data?.success) {
        setError(result.data?.error ?? "Failed to reveal credential");
        return;
      }

      setCredential(result.data.credential!);
    });
  }

  async function handleCopy() {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
    }
  }

  // Credential revealed — show it
  if (credential) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-lg border border-green-200 bg-green-50 p-8 dark:border-green-900 dark:bg-green-950">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Your Credential
          </h1>
          <p className="mt-1 text-center text-sm text-zinc-500">
            {productName}
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="rounded-md bg-zinc-100 p-4 dark:bg-zinc-900">
            <pre className="whitespace-pre-wrap break-all font-mono text-sm text-zinc-900 dark:text-zinc-50">
              {credential}
            </pre>
          </div>
          <Button
            onClick={handleCopy}
            variant="outline"
            className="mt-4 w-full"
          >
            {copied ? "Copied!" : "Copy to Clipboard"}
          </Button>
        </div>

        <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Important
          </p>
          <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
            This credential will not be shown again. Please save it now in a
            secure location.
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/order/lookup"
            className="text-sm text-zinc-500 hover:underline"
          >
            Back to order lookup
          </Link>
        </div>
      </div>
    );
  }

  // Pre-reveal state — confirm before showing
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
            <svg
              className="h-6 w-6 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Ready to Reveal
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your credential for <strong>{productName}</strong> is ready.
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            One-time view
          </p>
          <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
            This credential can only be revealed once. After you click the
            button below, it will be shown a single time and cannot be retrieved
            again. Make sure you are ready to save it.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <Button
          onClick={handleReveal}
          size="lg"
          className="mt-6 w-full"
          disabled={isPending}
        >
          {isPending ? "Revealing..." : "Reveal Credential"}
        </Button>
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/order/lookup"
          className="text-sm text-zinc-500 hover:underline"
        >
          Back to order lookup
        </Link>
      </div>
    </div>
  );
}
