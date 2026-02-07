import { getActiveProducts, getCategories } from "@/actions/products";
import { ProductCard } from "@/components/public/product-card";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const revalidate = 60; // ISR: revalidate catalog every 60 seconds

export const metadata = {
  title: "Catalog",
  description: "Browse our selection of premium digital accounts and subscription keys.",
};

interface CatalogPageProps {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    page?: string;
  }>;
}

const ITEMS_PER_PAGE = 12;

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name", label: "Name" },
] as const;

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const categorySlug = params.category;
  const sort = (params.sort ?? "newest") as "newest" | "price_asc" | "price_desc" | "name";
  const page = Math.max(1, Number(params.page ?? "1"));
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const [{ products, total }, cats] = await Promise.all([
    getActiveProducts({
      categorySlug,
      sort,
      limit: ITEMS_PER_PAGE,
      offset,
    }),
    getCategories(),
  ]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const merged = { category: categorySlug, sort, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "newest" && k !== "page") p.set(k, v);
      else if (k === "page" && v && v !== "1") p.set(k, v);
    }
    const qs = p.toString();
    return `/catalog${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Catalog
      </h1>

      {/* Filters row */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildUrl({ category: undefined })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              !categorySlug
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800",
            )}
          >
            All
          </Link>
          {cats.map((cat) => (
            <Link
              key={cat.id}
              href={buildUrl({ category: cat.slug })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                categorySlug === cat.slug
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800",
              )}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Sort:</span>
          {sortOptions.map((opt) => (
            <Link
              key={opt.value}
              href={buildUrl({ sort: opt.value })}
              className={cn(
                "text-sm transition-colors",
                sort === opt.value
                  ? "font-medium text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50",
              )}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            No products found
            {categorySlug ? " in this category" : ""}.
          </p>
          {categorySlug && (
            <Link
              href="/catalog"
              className="mt-2 inline-block text-sm font-medium text-zinc-900 dark:text-zinc-50"
            >
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
