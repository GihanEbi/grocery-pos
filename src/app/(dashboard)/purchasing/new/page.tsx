"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileX2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AccessDenied } from "@/components/shared/access-denied";
import { POStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { PurchaseOrderForm, type POFormValues } from "@/components/purchasing/po-form";
import { dateInputFromToday, isoToDateInput } from "@/components/purchasing/po-utils";
import { useCan } from "@/hooks";
import { useAppStore } from "@/store/app-store";

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={null}>
      <NewPurchaseOrderContent />
    </Suspense>
  );
}

function NewPurchaseOrderContent() {
  const params = useSearchParams();
  const canManage = useCan("purchasing.manage");
  const editId = params.get("edit");
  const editing = useAppStore((s) => (editId ? s.purchaseOrders.find((p) => p.id === editId) ?? null : null));
  const paramKey = params.toString();

  // Build the initial form values once per URL (prefill from AI / supplier links, or the draft being edited).
  const initial = React.useMemo<{ values: POFormValues; source: "manual" | "ai" } | null>(() => {
    const { products, suppliers } = useAppStore.getState();
    if (editId) {
      const po = useAppStore.getState().purchaseOrders.find((p) => p.id === editId);
      if (!po) return null;
      return {
        source: po.source,
        values: {
          supplierId: po.supplierId,
          expectedDate: isoToDateInput(po.expectedDate),
          notes: po.notes,
          lines: po.items.map((i) => ({ productId: i.productId, qty: String(i.quantity), cost: (i.unitCost / 100).toFixed(2) })),
        },
      };
    }
    const productById = new Map(products.map((p) => [p.id, p]));
    const lines: POFormValues["lines"] = [];
    for (const part of (params.get("items") ?? "").split(",")) {
      const [pid, rawQty] = part.split(":");
      const p = pid ? productById.get(pid.trim()) : undefined;
      if (!p || p.status === "archived" || lines.some((l) => l.productId === p.id)) continue;
      const q = Number(rawQty);
      const qty = Number.isFinite(q) && q > 0 ? (p.unit === "kg" ? Math.round(q * 1000) / 1000 : Math.ceil(q)) : 1;
      lines.push({ productId: p.id, qty: String(qty), cost: (p.purchasePrice / 100).toFixed(2) });
    }
    let supplierId = params.get("supplier") ?? "";
    if (supplierId && !suppliers.some((s) => s.id === supplierId)) supplierId = "";
    if (!supplierId && lines.length) supplierId = productById.get(lines[0].productId)?.supplierId ?? "";
    const supplier = suppliers.find((s) => s.id === supplierId && s.status === "active");
    if (!supplier) supplierId = "";
    return {
      source: params.get("source") === "ai" ? "ai" : "manual",
      values: { supplierId, expectedDate: supplier ? dateInputFromToday(supplier.leadTimeDays) : "", notes: "", lines },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  // Gate on the status when the page opened, so saving & approving doesn't flash the "not editable" state.
  const statusAtOpen = React.useMemo(
    () => (editId ? useAppStore.getState().purchaseOrders.find((p) => p.id === editId)?.status : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramKey],
  );

  if (!canManage) return <AccessDenied homeHref="/purchasing" />;

  const breadcrumbs = [{ label: "Purchasing", href: "/purchasing" }, { label: editId ? "Edit order" : "New order" }];

  if (editId && (!editing || !initial)) {
    return (
      <div>
        <PageHeader title="Edit purchase order" breadcrumbs={breadcrumbs} />
        <EmptyState icon={FileX2} title="Purchase order not found" description="It may have been removed when the demo data was reset." action={<Button asChild variant="outline"><Link href="/purchasing">Back to purchase orders</Link></Button>} />
      </div>
    );
  }
  if (editing && statusAtOpen !== "draft") {
    return (
      <div>
        <PageHeader title={`Edit ${editing.poNumber}`} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon={FileX2}
          title="Only draft orders can be edited"
          description={<span className="inline-flex flex-wrap items-center justify-center gap-1.5">{editing.poNumber} is <POStatusBadge status={editing.status} /> and can no longer be changed.</span>}
          action={<Button asChild variant="outline"><Link href={`/purchasing?po=${editing.id}`}>View order</Link></Button>}
        />
      </div>
    );
  }
  if (!initial) return null;

  return (
    <div>
      <PageHeader
        title={editing ? `Edit ${editing.poNumber}` : "New purchase order"}
        description={editing ? "Update the draft before it's approved." : "Choose a supplier, add products and save as a draft or approve straight away."}
        breadcrumbs={breadcrumbs}
      />
      <PurchaseOrderForm key={paramKey} initial={initial.values} editId={editing?.id} source={initial.source} />
    </div>
  );
}
