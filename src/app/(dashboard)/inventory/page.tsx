"use client";

import { Suspense } from "react";
import { InventoryOverview } from "@/components/inventory/inventory-overview";
import { PageSkeleton } from "@/components/inventory/page-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton kpis={6} />}>
      <InventoryOverview />
    </Suspense>
  );
}
