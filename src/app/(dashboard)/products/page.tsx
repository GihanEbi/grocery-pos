"use client";

import { Suspense } from "react";
import { ProductsView } from "@/components/products/products-view";
import { PageSkeleton } from "@/components/inventory/page-skeleton";

export default function ProductsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProductsView />
    </Suspense>
  );
}
