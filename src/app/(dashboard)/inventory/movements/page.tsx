"use client";

import { Suspense } from "react";
import { StockMovementsView } from "@/components/inventory/stock-movements-view";
import { PageSkeleton } from "@/components/inventory/page-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton kpis={0} />}>
      <StockMovementsView />
    </Suspense>
  );
}
