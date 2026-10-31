import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder used as the Suspense fallback for products & inventory pages. */
export function PageSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: kpis }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)}
      </div>
      <Skeleton className="h-9 w-full max-w-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
