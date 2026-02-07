import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/skeleton";

export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={4} />
    </div>
  );
}
