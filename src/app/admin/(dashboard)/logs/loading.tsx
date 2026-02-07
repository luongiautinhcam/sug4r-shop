import { Skeleton, TableSkeleton } from "@/components/admin/skeleton";

export default function LogsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-24" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <TableSkeleton rows={10} cols={5} />
    </div>
  );
}
