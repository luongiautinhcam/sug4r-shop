import { getAdminCategories } from "@/actions/admin/categories";
import { ProductForm } from "@/components/admin/product-form";

export const metadata = {
  title: "New Product",
};

export default async function NewProductPage() {
  const cats = await getAdminCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          New Product
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Create a new product listing.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <ProductForm categories={cats.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </div>
  );
}
