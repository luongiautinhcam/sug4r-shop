import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/skeleton";

export default function InventoryLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}
