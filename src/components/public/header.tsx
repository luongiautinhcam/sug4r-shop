import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          {SITE_NAME}
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-6">
          <Link
            href="/catalog"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Catalog
          </Link>
          <Link
            href="/faq"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            FAQ
          </Link>
          <Link
            href="/order/lookup"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Track Order
          </Link>
        </nav>
      </div>
    </header>
  );
}
