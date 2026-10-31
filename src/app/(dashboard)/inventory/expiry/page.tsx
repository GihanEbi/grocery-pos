"use client";

import { Suspense } from "react";
import { ExpiryView } from "@/components/inventory/expiry-view";
import { PageSkeleton } from "@/components/inventory/page-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton kpis={4} />}>
      <ExpiryView />
    </Suspense>
  );
}
