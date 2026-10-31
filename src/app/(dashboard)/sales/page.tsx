"use client";

import { Suspense } from "react";
import { SalesHistory } from "@/components/sales/sales-history";

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesHistory />
    </Suspense>
  );
}
