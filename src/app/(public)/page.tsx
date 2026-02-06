import Link from "next/link";
import { getFeaturedProducts, getCategories } from "@/actions/products";
import { ProductCard } from "@/components/public/product-card";
import { SITE_NAME } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Shield, Zap, Lock } from "lucide-react";

export default async function HomePage() {
  const [featured, cats] = await Promise.all([
    getFeaturedProducts(6),
    getCategories(),
  ]);

  return (
    <div>
      {/* Hero */}
      <section className="bg-white py-20 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
            {SITE_NAME}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            Premium digital accounts and subscription keys. Instant delivery via
            encrypted, one-time secure links.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/catalog"
              className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Browse Catalog
            </Link>
            <Link
              href="/faq"
              className="rounded-full border border-zinc-300 px-8 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-y border-zinc-200 bg-zinc-50 py-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-4">
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Zap className="h-5 w-5 text-zinc-900 dark:text-zinc-50" />
            <span>Instant Delivery</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Lock className="h-5 w-5 text-zinc-900 dark:text-zinc-50" />
            <span>AES-256 Encrypted</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Shield className="h-5 w-5 text-zinc-900 dark:text-zinc-50" />
            <span>View-Once Secure Links</span>
          </div>
        </div>
      </section>

      {/* Categories */}
      {cats.length > 0 && (
        <section className="bg-white py-12 dark:bg-zinc-950">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Categories
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {cats.map((cat) => (
                <Link key={cat.id} href={`/catalog?category=${cat.slug}`}>
                  <Badge
                    variant="outline"
                    className="cursor-pointer px-4 py-2 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {cat.name}
                    {cat.productCount > 0 && (
                      <span className="ml-2 text-zinc-400">
                        {cat.productCount}
                      </span>
                    )}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="bg-zinc-50 py-12 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Featured Products
            </h2>
            <Link
              href="/catalog"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              View All
            </Link>
          </div>
          {featured.length === 0 ? (
            <p className="mt-8 text-center text-zinc-500 dark:text-zinc-400">
              No products available yet. Check back soon!
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
