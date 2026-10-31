"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReceiptText, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesTab } from "./sales-tab";
import { ReturnsTab } from "./returns-tab";

type TabValue = "sales" | "returns";

export function SalesHistory() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<TabValue>(params.get("tab") === "returns" ? "returns" : "sales");

  const onTabChange = (v: string) => {
    const next = v === "returns" ? "returns" : "sales";
    setTab(next);
    router.replace(next === "returns" ? `${pathname}?tab=returns` : pathname, { scroll: false });
  };

  return (
    <div>
      <PageHeader
        title="Sales & Returns"
        description="Review completed transactions, reprint receipts and process customer returns."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Sales & Returns" }]}
      />
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="mb-5">
          <TabsTrigger value="sales" data-testid="tab-sales"><ReceiptText /> Sales</TabsTrigger>
          <TabsTrigger value="returns" data-testid="tab-returns"><Undo2 /> Returns</TabsTrigger>
        </TabsList>
        <TabsContent value="sales"><SalesTab /></TabsContent>
        <TabsContent value="returns"><ReturnsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
