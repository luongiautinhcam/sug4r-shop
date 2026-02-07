import { KPICardsSkeleton, TableSkeleton, Skeleton } from "@/components/admin/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <KPICardsSkeleton />
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}
