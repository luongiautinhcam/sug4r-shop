import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={5} cols={6} />
    </div>
  );
}
