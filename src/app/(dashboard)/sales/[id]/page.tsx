"use client";

import { useParams } from "next/navigation";
import { SaleDetail } from "@/components/sales/sale-detail";

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  return <SaleDetail id={decodeURIComponent(id ?? "")} />;
}
