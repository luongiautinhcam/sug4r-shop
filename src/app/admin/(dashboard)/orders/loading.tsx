import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/skeleton";

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
