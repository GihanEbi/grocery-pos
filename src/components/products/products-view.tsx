"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreHorizontal, PackageCheck, PackageSearch, PackageX, Pencil, Plus, SlidersHorizontal, Boxes, TriangleAlert } from "lucide-react";
import type { Product, ProductStatus } from "@/types";
import { useAppStore } from "@/store/app-store";
import { api } from "@/mocks/services";
import { useCan, useCategoryMap, useDebounced } from "@/hooks";
import { stockStatus, type StockStatus } from "@/lib/calculations/inventory";
import { marginBps } from "@/lib/calculations/money";
import { formatNumber, formatPercent, formatQty } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Money } from "@/components/shared/money";
import { ProductStatusBadge, StockStatusBadge } from "@/components/shared/status-badges";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProductFormSheet } from "./product-form-sheet";

type StatusFilter = "default" | ProductStatus | "all";
type StockFilter = "all" | StockStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "default", label: "Active & inactive" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All statuses" },
];
const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: "all", label: "All stock levels" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

function parseStatus(v: string | null): StatusFilter {
  return STATUS_OPTIONS.some((o) => o.value === v) ? (v as StatusFilter) : "default";
}

export function ProductsView() {
  const params = useSearchParams();
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const categoryMap = useCategoryMap();
  const canManage = useCan("products.manage");
  const canAdjust = useCan("inventory.adjust");
  const confirm = useConfirm();

  const [q, setQ] = React.useState(() => params.get("q") ?? "");
  const [category, setCategory] = React.useState("all");
  const [stock, setStock] = React.useState<StockFilter>(() => {
    const s = params.get("stock");
    return STOCK_OPTIONS.some((o) => o.value === s) ? (s as StockFilter) : "all";
  });
  const [status, setStatus] = React.useState<StatusFilter>(() => parseStatus(params.get("status")));
  const [sheet, setSheet] = React.useState<{ open: boolean; product: Product | null }>({ open: false, product: null });
  const debouncedQ = useDebounced(q, 150);

  const counts = React.useMemo(() => {
    const live = products.filter((p) => p.status !== "archived");
    const active = live.filter((p) => p.status === "active");
    return {
      total: live.length,
      active: active.length,
      inactive: live.length - active.length,
      low: active.filter((p) => stockStatus(p.stock, p.minStock) === "low_stock").length,
      out: active.filter((p) => stockStatus(p.stock, p.minStock) === "out_of_stock").length,
      archived: products.length - live.length,
    };
  }, [products]);

  const filtered = React.useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    return products.filter((p) => {
      if (status === "default" ? p.status === "archived" : status !== "all" && p.status !== status) return false;
      if (category !== "all" && p.categoryId !== category) return false;
      if (stock !== "all" && stockStatus(p.stock, p.minStock) !== stock) return false;
      if (term && !(p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.barcode.includes(term) || p.brand.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [products, debouncedQ, status, category, stock]);

  const hasFilters = q !== "" || category !== "all" || stock !== "all" || status !== "default";
  const clearFilters = () => {
    setQ("");
    setCategory("all");
    setStock("all");
    setStatus("default");
  };

  const openCreate = React.useCallback(() => setSheet({ open: true, product: null }), []);
  const openEdit = React.useCallback((p: Product) => setSheet({ open: true, product: p }), []);

  const toggleArchive = React.useCallback(
    async (p: Product) => {
      const archiving = p.status !== "archived";
      const ok = await confirm(
        archiving
          ? { title: `Archive ${p.name}?`, description: "Archived products are hidden from the POS and product lists. Sales history and stock records are kept, and you can restore it any time.", confirmLabel: "Archive product", tone: "destructive" }
          : { title: `Restore ${p.name}?`, description: "The product will be set to Active and become available at the POS again (if in stock).", confirmLabel: "Restore product" },
      );
      if (!ok) return;
      const r = archiving ? await api.products.archive(p.id) : await api.products.restore(p.id);
      if (r.ok) toast.success(archiving ? `${p.name} archived` : `${p.name} restored`);
      else toast.error(r.error);
    },
    [confirm],
  );

  const columns = React.useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        accessorFn: (p) => p.name,
        cell: ({ row }) => {
          const p = row.original;
          const cat = categoryMap.get(p.categoryId);
          return (
            <div className="flex min-w-52 items-center gap-3">
              <ProductThumb image={p.image} name={p.name} color={cat?.color} />
              <div className="min-w-0">
                {canManage ? (
                  <button type="button" onClick={() => openEdit(p)} className="block max-w-64 truncate text-left font-medium hover:text-primary hover:underline underline-offset-2" data-testid={`product-row-${p.sku}`}>
                    {p.name}
                  </button>
                ) : (
                  <p className="max-w-64 truncate font-medium" data-testid={`product-row-${p.sku}`}>{p.name}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">{p.brand || "—"}</p>
              </div>
            </div>
          );
        },
      },
      { id: "sku", header: "SKU", accessorKey: "sku", cell: ({ row }) => <span className="whitespace-nowrap font-mono text-[13px]">{row.original.sku}</span> },
      {
        id: "barcode",
        header: "Barcode",
        accessorKey: "barcode",
        enableSorting: false,
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.barcode || "—"}</span>,
      },
      {
        id: "category",
        header: "Category",
        accessorFn: (p) => categoryMap.get(p.categoryId)?.name ?? "",
        cell: ({ row }) => {
          const cat = categoryMap.get(row.original.categoryId);
          return cat ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
              <span className="size-2 rounded-full" style={{ background: cat.color }} />
              {cat.name}
            </span>
          ) : <span className="text-muted-foreground">—</span>;
        },
      },
      { id: "cost", header: "Cost", accessorKey: "purchasePrice", meta: { align: "right" }, cell: ({ row }) => <Money value={row.original.purchasePrice} muted /> },
      { id: "price", header: "Price", accessorKey: "sellingPrice", meta: { align: "right" }, cell: ({ row }) => <Money value={row.original.sellingPrice} className="font-medium" /> },
      {
        id: "margin",
        header: "Margin",
        accessorFn: (p) => marginBps(p.sellingPrice, p.purchasePrice),
        meta: { align: "right" },
        cell: ({ getValue }) => {
          const m = getValue() as number;
          return <span className={cn("tabular text-[13px] font-medium", m < 0 ? "text-destructive-foreground" : m < 1000 ? "text-warning-foreground" : "text-success-foreground")}>{formatPercent(m)}</span>;
        },
      },
      {
        id: "stock",
        header: "Stock",
        accessorKey: "stock",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="tabular w-16 text-right text-[13px] font-medium">{formatQty(p.stock, p.unit)}</span>
              <StockStatusBadge status={stockStatus(p.stock, p.minStock)} />
            </div>
          );
        },
      },
      { id: "status", header: "Status", accessorKey: "status", cell: ({ row }) => <ProductStatusBadge status={row.original.status} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => {
          const p = row.original;
          if (!canManage && !canAdjust) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`} data-testid={`product-actions-${p.sku}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {canManage && (
                  <DropdownMenuItem onSelect={() => openEdit(p)}>
                    <Pencil /> Edit product
                  </DropdownMenuItem>
                )}
                {canAdjust && (
                  <DropdownMenuItem asChild>
                    <Link href={`/inventory?adjust=${p.id}`}>
                      <SlidersHorizontal /> Adjust stock
                    </Link>
                  </DropdownMenuItem>
                )}
                {canManage && (
                  <>
                    <DropdownMenuSeparator />
                    {p.status === "archived" ? (
                      <DropdownMenuItem onSelect={() => void toggleArchive(p)}>
                        <ArchiveRestore /> Restore
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem destructive onSelect={() => void toggleArchive(p)}>
                        <Archive /> Archive
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [categoryMap, canManage, canAdjust, openEdit, toggleArchive],
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your catalog, pricing and product availability."
        actions={
          canManage && (
            <Button onClick={openCreate} data-testid="add-product">
              <Plus /> Add product
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Total products" value={formatNumber(counts.total)} icon={Boxes} tone="neutral" hint={counts.archived ? `${counts.archived} archived not counted` : "Excludes archived"} />
        <KpiCard label="Active" value={formatNumber(counts.active)} icon={PackageCheck} tone="success" hint={`${counts.inactive} inactive`} />
        <KpiCard label="Low stock" value={formatNumber(counts.low)} icon={TriangleAlert} tone="warning" hint="At or below minimum" href="/inventory?status=low_stock" />
        <KpiCard label="Out of stock" value={formatNumber(counts.out)} icon={PackageX} tone="destructive" hint="Active products at zero" href="/inventory?status=out_of_stock" />
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, SKU, barcode, brand…" aria-label="Search products" data-testid="product-search" className="sm:w-80" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by category" data-testid="product-category-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}><span className="mr-1.5">{c.icon}</span>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={stock} onValueChange={(v) => setStock(v as StockFilter)}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by stock status" data-testid="product-stock-filter"><SelectValue /></SelectTrigger>
            <SelectContent>{STOCK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="col-span-2 sm:w-44" aria-label="Filter by product status" data-testid="product-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-auto">Clear filters</Button>
        )}
        <p className="text-[13px] text-muted-foreground sm:ml-auto">
          <span className="font-medium text-foreground tabular">{formatNumber(filtered.length)}</span> {filtered.length === 1 ? "product" : "products"}
        </p>
      </div>

      <DataTable
        testId="products-table"
        columns={columns}
        data={filtered}
        getRowId={(p) => p.id}
        resetKey={`${debouncedQ}|${category}|${stock}|${status}`}
        initialSorting={[{ id: "product", desc: false }]}
        rowClassName={(p) => (p.status === "archived" ? "opacity-60" : undefined)}
        empty={
          products.length === 0 ? (
            <EmptyState icon={PackageSearch} title="No products yet" description="Add your first product to start selling and tracking stock." action={canManage && <Button onClick={openCreate}><Plus /> Add product</Button>} />
          ) : (
            <EmptyState icon={PackageSearch} title="No products match your filters" description="Try a different search term or clear the filters." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
          )
        }
      />

      {canManage && <ProductFormSheet open={sheet.open} product={sheet.product} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} />}
    </>
  );
}
