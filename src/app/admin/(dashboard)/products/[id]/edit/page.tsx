import { notFound } from "next/navigation";
import { getAdminProductById } from "@/actions/admin/products";
import { getAdminCategories } from "@/actions/admin/categories";
import { ProductForm } from "@/components/admin/product-form";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Edit Product",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, cats] = await Promise.all([
    getAdminProductById(id),
    getAdminCategories(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Edit Product
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {product.name}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={
            product.status === "active"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : product.status === "draft"
                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }
        >
          {product.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <ProductForm
              product={product}
              categories={cats.map((c) => ({ id: c.id, name: c.name }))}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Inventory
            </h3>
            <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {product.availableCount}
              <span className="text-base font-normal text-zinc-400"> / {product.totalCount}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {product.availableCount} available of {product.totalCount} total
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
