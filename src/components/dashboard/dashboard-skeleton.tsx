import { Skeleton } from "@/components/ui/skeleton";

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}

export function ChartSkeleton({ className, height = 270 }: { className?: string; height?: number }) {
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-soft ${className ?? ""}`}>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-52" />
      <Skeleton className="mt-5 w-full rounded-lg" style={{ height }} />
    </div>
  );
}
