import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/actions/products";
import { formatPrice } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart } from "lucide-react";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: product.name,
    description: product.shortDesc ?? product.description?.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.shortDesc ?? undefined,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/catalog"
        className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Catalog
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Image */}
        <div className="flex items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full max-h-80 w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center text-6xl text-zinc-300 dark:text-zinc-700">
              {product.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          {product.categoryName && (
            <Link
              href={`/catalog?category=${product.categorySlug}`}
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {product.categoryName}
            </Link>
          )}

          <h1 className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {product.name}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {formatPrice(product.price, product.currency)}
            </span>
            <Badge variant={product.inStock ? "default" : "secondary"}>
              {product.inStock ? "In Stock" : "Out of Stock"}
            </Badge>
          </div>

          {product.shortDesc && (
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              {product.shortDesc}
            </p>
          )}

          <div className="mt-6">
            {product.inStock ? (
              <Link href={`/checkout?product=${product.id}`}>
                <Button size="lg" className="w-full sm:w-auto">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Buy Now
                </Button>
              </Link>
            ) : (
              <Button size="lg" disabled className="w-full sm:w-auto">
                Out of Stock
              </Button>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Description
              </h2>
              <div className="prose prose-zinc dark:prose-invert max-w-none text-sm">
                {product.description.split("\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
