"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, CalendarClock, PackageCheck, PackageSearch, PackageX, SlidersHorizontal, Tags, TriangleAlert, Wallet } from "lucide-react";
import type { Product } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCan, useCategoryMap, useDebounced } from "@/hooks";
import { inventoryRetailValue, inventoryValue, stockStatus, type StockStatus } from "@/lib/calculations/inventory";
import { expiryRows, stockCounts } from "@/lib/analytics";
import { formatMoney, formatMoneyCompact, formatNumber, formatQty, unitShort } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StockStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventorySubnav } from "./inventory-subnav";
import { StockBar } from "./stock-bar";
import { StockAdjustDialog } from "./stock-adjust-dialog";
import { LowStockAlerts } from "./low-stock-alerts";

type StatusFilter = "all" | StockStatus;
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All stock levels" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

export function InventoryOverview() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const suppliers = useAppStore((s) => s.suppliers);
  const batches = useAppStore((s) => s.batches);
  const categoryMap = useCategoryMap();
  const canAdjust = useCan("inventory.adjust");

  const [q, setQ] = React.useState(() => params.get("q") ?? "");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState<StatusFilter>(() => {
    const s = params.get("status");
    return STATUS_OPTIONS.some((o) => o.value === s) ? (s as StatusFilter) : "all";
  });
  const [adjust, setAdjust] = React.useState<{ open: boolean; productId: string | null }>({ open: false, productId: null });
  const debouncedQ = useDebounced(q, 150);

  // Deep link: /inventory?adjust=<productId> opens the adjustment dialog once, then cleans the URL.
  const adjustParam = params.get("adjust");
  React.useEffect(() => {
    if (!adjustParam) return;
    if (canAdjust) setAdjust({ open: true, productId: products.some((p) => p.id === adjustParam) ? adjustParam : null });
    const next = new URLSearchParams(params.toString());
    next.delete("adjust");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustParam]);

  const live = React.useMemo(() => products.filter((p) => p.status !== "archived"), [products]);

  const kpis = React.useMemo(() => {
    const counts = stockCounts(products);
    const nearExpiry = expiryRows(batches, products).filter((r) => r.daysLeft >= 0 && r.daysLeft <= 14);
    return {
      cost: inventoryValue(live),
      retail: inventoryRetailValue(live),
      units: live.length,
      ...counts,
      nearExpiry: nearExpiry.length,
      nearExpiryValue: nearExpiry.reduce((a, r) => a + r.value, 0),
    };
  }, [products, live, batches]);

  const filtered = React.useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    return live.filter((p) => {
      if (category !== "all" && p.categoryId !== category) return false;
      if (status !== "all" && stockStatus(p.stock, p.minStock) !== status) return false;
      if (term && !(p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.barcode.includes(term) || p.brand.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [live, debouncedQ, category, status]);

  const hasFilters = q !== "" || category !== "all" || status !== "all";
  const clearFilters = () => {
    setQ("");
    setCategory("all");
    setStatus("all");
  };

  const openAdjust = React.useCallback((productId: string | null) => setAdjust({ open: true, productId }), []);

  const columns = React.useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        accessorFn: (p) => p.name,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex min-w-48 items-center gap-3">
              <ProductThumb image={p.image} name={p.name} color={categoryMap.get(p.categoryId)?.color} size="sm" />
              <div className="min-w-0">
                <p className="max-w-60 truncate font-medium">{p.name}</p>
                {p.status !== "active" && <p className="text-[11px] text-muted-foreground">Inactive</p>}
              </div>
            </div>
          );
        },
      },
      { id: "sku", header: "SKU", accessorKey: "sku", cell: ({ row }) => <span className="whitespace-nowrap font-mono text-[13px]">{row.original.sku}</span> },
      {
        id: "category",
        header: "Category",
        accessorFn: (p) => categoryMap.get(p.categoryId)?.name ?? "",
        cell: ({ row }) => {
          const cat = categoryMap.get(row.original.categoryId);
          return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
              <span className="size-2 rounded-full" style={{ background: cat?.color }} />
              {cat?.name ?? "—"}
            </span>
          );
        },
      },
      {
        id: "stock",
        header: "Stock qty",
        accessorKey: "stock",
        meta: { align: "right" },
        cell: ({ row }) => {
          const p = row.original;
          const st = stockStatus(p.stock, p.minStock);
          return (
            <span className={cn("tabular font-semibold", st === "out_of_stock" ? "text-destructive-foreground" : st === "low_stock" ? "text-warning-foreground" : "")} data-testid={`stock-qty-${p.sku}`}>
              {formatQty(p.stock)}
            </span>
          );
        },
      },
      { id: "unit", header: "Unit", accessorKey: "unit", cell: ({ row }) => <span className="text-[13px] text-muted-foreground">{unitShort(row.original.unit)}</span> },
      {
        id: "min",
        header: "Min level",
        accessorKey: "minStock",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <span className="tabular w-8 text-right text-[13px] text-muted-foreground">{formatQty(p.minStock)}</span>
              <StockBar stock={p.stock} minStock={p.minStock} />
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (p) => ({ out_of_stock: 0, low_stock: 1, in_stock: 2 })[stockStatus(p.stock, p.minStock)],
        cell: ({ row }) => <StockStatusBadge status={stockStatus(row.original.stock, row.original.minStock)} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) =>
          canAdjust ? (
            <Button variant="outline" size="sm" onClick={() => openAdjust(row.original.id)} data-testid={`adjust-row-${row.original.sku}`}>
              <SlidersHorizontal className="size-3.5" /> Adjust
            </Button>
          ) : null,
      },
    ],
    [categoryMap, canAdjust, openAdjust],
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Real-time stock levels, alerts and adjustments across your catalog."
        actions={
          canAdjust && (
            <Button onClick={() => openAdjust(null)} data-testid="adjust-stock">
              <SlidersHorizontal /> Adjust stock
            </Button>
          )
        }
      />
      <InventorySubnav />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Inventory value (cost)" value={<span title={formatMoney(kpis.cost)}>{formatMoneyCompact(kpis.cost)}</span>} icon={Wallet} tone="primary" hint={formatMoney(kpis.cost)} />
        <KpiCard label="Retail value" value={<span title={formatMoney(kpis.retail)}>{formatMoneyCompact(kpis.retail)}</span>} icon={Tags} tone="info" hint={`${formatMoneyCompact(kpis.retail - kpis.cost)} potential profit`} />
        <KpiCard label="Active products" value={formatNumber(kpis.active)} icon={PackageCheck} tone="success" hint={`${formatNumber(kpis.inStock)} in stock`} />
        <KpiCard label="Low stock" value={formatNumber(kpis.low)} icon={TriangleAlert} tone="warning" hint="At or below minimum" />
        <KpiCard label="Out of stock" value={formatNumber(kpis.out)} icon={PackageX} tone="destructive" hint="Lost sales risk" />
        <KpiCard label="Near-expiry batches" value={formatNumber(kpis.nearExpiry)} icon={CalendarClock} tone="warning" hint={`≤ 14 days · ${formatMoneyCompact(kpis.nearExpiryValue)}`} href="/inventory/expiry" />
      </div>

      <div className="mb-6">
        <LowStockAlerts products={products} suppliers={suppliers} />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, barcode…" aria-label="Search inventory" data-testid="inventory-search" className="sm:w-80" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}><span className="mr-1.5">{c.icon}</span>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by stock status" data-testid="inventory-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-auto">Clear filters</Button>}
        <p className="text-[13px] text-muted-foreground sm:ml-auto">
          <span className="font-medium text-foreground tabular">{formatNumber(filtered.length)}</span> of {formatNumber(live.length)} products
        </p>
      </div>

      <DataTable
        testId="inventory-table"
        columns={columns}
        data={filtered}
        getRowId={(p) => p.id}
        resetKey={`${debouncedQ}|${category}|${status}`}
        initialSorting={[{ id: "status", desc: false }]}
        empty={
          live.length === 0 ? (
            <EmptyState icon={Boxes} title="No products in inventory" description="Add products from the Products page to start tracking stock." />
          ) : (
            <EmptyState icon={PackageSearch} title="No products match your filters" description="Try another search term or clear the filters." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
          )
        }
      />

      <StockAdjustDialog open={adjust.open} productId={adjust.productId} onOpenChange={(open) => setAdjust((s) => ({ ...s, open }))} />
    </>
  );
}
