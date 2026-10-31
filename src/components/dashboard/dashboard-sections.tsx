"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, PackageCheck, Receipt } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { ExpiryBadge, PaymentBadge, SaleStatusBadge } from "@/components/shared/status-badges";
import { ProductThumb } from "@/components/shared/product-thumb";
import { useAppStore } from "@/store/app-store";
import { useCategoryMap, useCustomerMap } from "@/hooks";
import { expiryRows, productStockStatus } from "@/lib/analytics";
import { formatDate, formatMoney, formatQty, formatRelative } from "@/lib/formatting";
import { cn } from "@/lib/utils";

function SectionHeader({ title, description, href, linkLabel = "View all" }: { title: string; description?: string; href: string; linkLabel?: string }) {
  return (
    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
      <div className="min-w-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="mt-1">{description}</CardDescription>}
      </div>
      <Button asChild variant="ghost" size="sm" className="-mr-2 shrink-0 text-primary">
        <Link href={href}>
          {linkLabel}
          <ArrowRight />
        </Link>
      </Button>
    </CardHeader>
  );
}

/** Last 8 sales with quick search by receipt or customer. */
export function RecentSales() {
  const sales = useAppStore((s) => s.sales);
  const customers = useCustomerMap();
  const [q, setQ] = React.useState("");

  const rows = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...sales]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((s) => {
        if (!term) return true;
        const name = s.customerId ? customers.get(s.customerId)?.name ?? "" : "walk-in";
        return s.receiptNo.toLowerCase().includes(term) || name.toLowerCase().includes(term);
      })
      .slice(0, 8);
  }, [sales, customers, q]);

  return (
    <Card data-testid="recent-sales" className="flex flex-col">
      <SectionHeader title="Recent sales" description="Latest transactions across all registers" href="/sales" />
      <div className="px-5 pb-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search receipt or customer…" className="sm:w-full" aria-label="Search recent sales" />
      </div>
      <CardContent className="flex-1 px-0 pb-2">
        {rows.length === 0 ? (
          <EmptyState compact icon={Receipt} title="No matching sales" description={q ? "Try a different receipt number or customer name." : "Completed sales will appear here."} />
        ) : (
          <ul className="divide-y">
            {rows.map((s) => {
              const customer = s.customerId ? customers.get(s.customerId)?.name ?? "Customer" : "Walk-in";
              return (
                <li key={s.id}>
                  <Link href={`/sales/${s.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 outline-none">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Receipt className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium">{s.receiptNo}</span>
                        <span className="hidden sm:inline"><SaleStatusBadge status={s.status} /></span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer} · {formatRelative(s.date)}
                      </p>
                    </div>
                    <div className="hidden md:block"><PaymentBadge methods={s.payments.map((p) => p.method)} /></div>
                    <span className="w-24 shrink-0 text-right text-[13px] font-semibold tabular">{formatMoney(s.total)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Products at or below their minimum stock, most urgent first. */
export function LowStockList({ limit = 6 }: { limit?: number }) {
  const products = useAppStore((s) => s.products);
  const categories = useCategoryMap();
  const rows = React.useMemo(
    () =>
      products
        .filter((p) => p.status === "active" && productStockStatus(p) !== "in_stock")
        .map((p) => ({ p, ratio: p.minStock > 0 ? p.stock / p.minStock : 0 }))
        .sort((a, b) => a.ratio - b.ratio),
    [products],
  );

  return (
    <Card className="flex flex-col">
      <SectionHeader title="Low-stock products" description={`${rows.length} product${rows.length === 1 ? "" : "s"} at or below minimum`} href="/inventory?status=low_stock" linkLabel="Inventory" />
      <CardContent className="flex-1 px-0 pb-3">
        {rows.length === 0 ? (
          <EmptyState compact icon={PackageCheck} title="Stock levels look healthy" description="No active products are below their minimum stock." />
        ) : (
          <ul className="divide-y">
            {rows.slice(0, limit).map(({ p, ratio }) => {
              const out = p.stock <= 0;
              const pct = Math.min(100, Math.round(ratio * 100));
              return (
                <li key={p.id}>
                  <Link href={`/inventory?q=${encodeURIComponent(p.sku)}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/50 outline-none focus-visible:bg-muted/50">
                    <ProductThumb image={p.image} name={p.name} color={categories.get(p.categoryId)?.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium">{p.name}</span>
                        <Badge variant={out ? "destructive" : "warning"} dot className="shrink-0">{out ? "Out" : "Reorder"}</Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Stock vs minimum">
                          <div className={cn("h-full rounded-full", out ? "bg-destructive" : "bg-warning")} style={{ width: `${Math.max(out ? 0 : 4, pct)}%` }} />
                        </div>
                        <span className="shrink-0 text-xs tabular text-muted-foreground">
                          <span className="font-medium text-foreground">{formatQty(p.stock, p.unit)}</span> / min {formatQty(p.minStock, p.unit)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Batches expiring within 7 days (including already expired). */
export function ExpiryAlerts({ limit = 6 }: { limit?: number }) {
  const batches = useAppStore((s) => s.batches);
  const products = useAppStore((s) => s.products);
  const categories = useCategoryMap();
  const rows = React.useMemo(() => expiryRows(batches, products).filter((r) => r.daysLeft <= 7), [batches, products]);

  return (
    <Card className="flex flex-col">
      <SectionHeader title="Expiry alerts" description={`${rows.length} batch${rows.length === 1 ? "" : "es"} expiring within 7 days`} href="/inventory/expiry" linkLabel="Expiry" />
      <CardContent className="flex-1 px-0 pb-3">
        {rows.length === 0 ? (
          <EmptyState compact icon={CalendarClock} title="Nothing expiring soon" description="No batches expire in the next 7 days." />
        ) : (
          <ul className="divide-y">
            {rows.slice(0, limit).map((r) => (
              <li key={r.batch.id} className="flex items-center gap-3 px-5 py-2.5">
                <ProductThumb image={r.product.image} name={r.product.name} color={categories.get(r.product.categoryId)?.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{r.product.name}</p>
                  <p className="truncate text-xs text-muted-foreground tabular">
                    {r.batch.batchNo} · {formatDate(r.batch.expiryDate)} · {formatQty(r.batch.quantity, r.product.unit)}
                  </p>
                </div>
                <ExpiryBadge status={r.status} daysLeft={r.daysLeft} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
