"use client";

import * as React from "react";
import Link from "next/link";
import { BellRing, ChevronDown, ClipboardList, PackageCheck, Truck } from "lucide-react";
import type { Product, Supplier } from "@/types";
import { stockStatus } from "@/lib/calculations/inventory";
import { multiply } from "@/lib/calculations/money";
import { formatMoney, formatQty } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useCan, useCategoryMap } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductThumb } from "@/components/shared/product-thumb";
import { EmptyState } from "@/components/shared/empty-state";

/** Suggested reorder quantity: top up to 2× minimum, at least one minimum's worth. */
export function reorderQty(p: Pick<Product, "stock" | "minStock">): number {
  return Math.ceil(Math.max(p.minStock * 2 - p.stock, p.minStock, 1));
}

interface Group {
  supplier: Supplier | null;
  items: Product[];
  estCost: number;
  outCount: number;
}

const VISIBLE = 3;
const VISIBLE_GROUPS = 6;
const VISIBLE_GROUPS_MOBILE = 3;

export function LowStockAlerts({ products, suppliers }: { products: Product[]; suppliers: Supplier[] }) {
  const categoryMap = useCategoryMap();
  const canPurchase = useCan("purchasing.manage");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [allGroups, setAllGroups] = React.useState(false);

  const groups = React.useMemo<Group[]>(() => {
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
    const map = new Map<string, Group>();
    for (const p of products) {
      if (p.status !== "active") continue;
      const st = stockStatus(p.stock, p.minStock);
      if (st === "in_stock") continue;
      const key = p.supplierId && supplierMap.has(p.supplierId) ? p.supplierId : "none";
      const g = map.get(key) ?? { supplier: key === "none" ? null : supplierMap.get(key)!, items: [], estCost: 0, outCount: 0 };
      g.items.push(p);
      g.estCost += multiply(p.purchasePrice, reorderQty(p));
      if (st === "out_of_stock") g.outCount++;
      map.set(key, g);
    }
    for (const g of map.values()) g.items.sort((a, b) => a.stock / Math.max(a.minStock, 1) - b.stock / Math.max(b.minStock, 1));
    return [...map.values()].sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1) || b.outCount - a.outCount || b.items.length - a.items.length);
  }, [products, suppliers]);

  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const shownGroups = allGroups ? groups : groups.slice(0, VISIBLE_GROUPS);

  return (
    <section className="rounded-xl border bg-card shadow-soft" aria-labelledby="low-stock-title" data-testid="low-stock-alerts">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-warning-soft text-warning-foreground">
            <BellRing className="size-4" />
          </span>
          <div>
            <h2 id="low-stock-title" className="text-[15px] font-semibold tracking-tight">Low-stock alerts</h2>
            <p className="text-[13px] text-muted-foreground">
              {total === 0 ? "Everything is above its minimum level." : `${total} active product${total === 1 ? "" : "s"} at or below minimum, grouped by supplier.`}
            </p>
          </div>
        </div>
        {total > 0 && <Badge variant="warning">{groups.length} supplier{groups.length === 1 ? "" : "s"}</Badge>}
      </div>

      {total === 0 ? (
        <EmptyState icon={PackageCheck} title="No low-stock items" description="New alerts appear here as soon as a product drops to its minimum level." compact />
      ) : (
        <>
        <div className={cn("grid gap-px overflow-hidden bg-border sm:grid-cols-2 lg:grid-cols-3", groups.length <= VISIBLE_GROUPS_MOBILE && "rounded-b-xl", groups.length <= VISIBLE_GROUPS && "sm:rounded-b-xl")}>
          {shownGroups.map((g, gi) => {
            const key = g.supplier?.id ?? "none";
            const isOpen = expanded.has(key);
            const shown = isOpen ? g.items : g.items.slice(0, VISIBLE);
            const href = g.supplier ? `/purchasing/new?supplier=${g.supplier.id}&items=${g.items.map((p) => `${p.id}:${reorderQty(p)}`).join(",")}` : null;
            return (
              <div key={key} className={cn("flex flex-col bg-card p-4", !allGroups && gi >= VISIBLE_GROUPS_MOBILE && "max-sm:hidden")} data-testid={`low-stock-group-${key}`}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      <Truck className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{g.supplier?.name ?? "No supplier assigned"}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {g.items.length} item{g.items.length === 1 ? "" : "s"}
                      {g.outCount > 0 && <span className="text-destructive-foreground"> · {g.outCount} out</span>}
                      {g.supplier && <> · {g.supplier.leadTimeDays}d lead time</>}
                    </p>
                  </div>
                  {g.supplier && g.supplier.status !== "active" && <Badge variant="secondary">Inactive</Badge>}
                </div>
                <ul className="flex-1 space-y-1.5">
                  {shown.map((p) => {
                    const out = p.stock <= 0;
                    return (
                      <li key={p.id} className="flex items-center gap-2.5 text-[13px]">
                        <ProductThumb image={p.image} name={p.name} color={categoryMap.get(p.categoryId)?.color} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className={cn("tabular shrink-0 text-xs font-medium", out ? "text-destructive-foreground" : "text-warning-foreground")}>
                          {formatQty(p.stock, p.unit)}
                          <span className="font-normal text-muted-foreground"> / {formatQty(p.minStock)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {g.items.length > VISIBLE && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 self-start text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                    {isOpen ? "Show less" : `Show ${g.items.length - VISIBLE} more`}
                  </button>
                )}
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    Est. <span className="font-medium text-foreground tabular">{formatMoney(g.estCost)}</span>
                  </span>
                  {href && canPurchase && g.supplier?.status === "active" ? (
                    <Button asChild size="sm" variant="soft" data-testid={`create-po-${key}`}>
                      <Link href={href}><ClipboardList /> Create purchase order</Link>
                    </Button>
                  ) : !g.supplier ? (
                    <span className="text-xs text-muted-foreground">Assign a supplier to reorder</span>
                  ) : g.supplier.status !== "active" ? (
                    <span className="text-xs text-muted-foreground">Supplier inactive — reassign items</span>
                  ) : null}
                </div>
              </div>
            );
          })}
          {/* Fillers keep the hairline grid tidy when the last row is incomplete. */}
          {shownGroups.length % 2 === 1 && <div aria-hidden className="hidden bg-card sm:block lg:hidden" />}
          {Array.from({ length: (3 - (shownGroups.length % 3)) % 3 }).map((_, i) => <div key={i} aria-hidden className="hidden bg-card lg:block" />)}
        </div>
        {groups.length > VISIBLE_GROUPS_MOBILE && (
          <button
            type="button"
            onClick={() => setAllGroups((v) => !v)}
            aria-expanded={allGroups}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-b-xl border-t py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
              groups.length <= VISIBLE_GROUPS && "sm:hidden",
            )}
            data-testid="low-stock-toggle"
          >
            <ChevronDown className={cn("size-4 transition-transform", allGroups && "rotate-180")} />
            {allGroups ? "Show fewer suppliers" : `Show all ${groups.length} suppliers`}
          </button>
        )}
        </>
      )}
    </section>
  );
}
