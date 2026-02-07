import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { PublicProduct } from "@/actions/products";

interface ProductCardProps {
  product: PublicProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
    >
      {/* Image placeholder */}
      <div className="flex h-40 items-center justify-center bg-zinc-100 dark:bg-zinc-900">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={400}
            height={160}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-3xl text-zinc-300 dark:text-zinc-700">
            {product.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {product.categoryName && (
          <span className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {product.categoryName}
          </span>
        )}
        <h3 className="font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-200">
          {product.name}
        </h3>
        {product.shortDesc && (
          <p className="mt-1 flex-1 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {product.shortDesc}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {formatPrice(product.price, product.currency)}
          </span>
          <Badge variant={product.inStock ? "default" : "secondary"}>
            {product.inStock ? "In Stock" : "Out of Stock"}
          </Badge>
        </div>
      </div>
    </Link>
  );
}
