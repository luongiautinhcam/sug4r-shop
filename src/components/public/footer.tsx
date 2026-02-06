import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            &copy; {year} {SITE_NAME}. All rights reserved.
          </div>
          <nav className="flex gap-6">
            <Link
              href="/faq"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              FAQ
            </Link>
            <Link
              href="/terms"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Privacy
            </Link>
            <Link
              href="/refund-policy"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Refunds
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
