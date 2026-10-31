"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChartCard } from "@/components/shared/chart";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StockStatusBadge } from "@/components/shared/status-badges";
import type { ColumnDef } from "@/components/shared/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { useCategoryMap } from "@/hooks";
import { productStockStatus, stockCounts } from "@/lib/analytics";
import { fromCents, multiply } from "@/lib/calculations/money";
import type { StockStatus } from "@/lib/calculations/inventory";
import { formatMoney, formatNumber, formatQty } from "@/lib/formatting";
import type { Product } from "@/types";
import { ChartEmpty, DonutChart, HBarChart } from "@/components/dashboard/charts";
import { ChartGrid, categoryName, KpiRow, Note, ReportTable, Stat, useReport, useReportExport, useTableSearch } from "./report-kit";

interface Row {
  product: Product;
  category: string;
  categoryColor?: string;
  status: StockStatus;
  costValue: number;
  retailValue: number;
}

const STATUS_LABEL: Record<StockStatus, string> = { in_stock: "In stock", low_stock: "Low stock", out_of_stock: "Out of stock" };

export function InventoryReport() {
  const { categoryId } = useReport();
  const router = useRouter();
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const categoryMap = useCategoryMap();
  const [status, setStatus] = React.useState<"all" | StockStatus>("all");

  const scoped = React.useMemo(() => products.filter((p) => p.status === "active" && (categoryId === "all" || p.categoryId === categoryId)), [products, categoryId]);
  const counts = React.useMemo(() => stockCounts(scoped), [scoped]);
  const allRows = React.useMemo<Row[]>(
    () =>
      scoped.map((p) => {
        const cat = categoryMap.get(p.categoryId);
        return {
          product: p,
          category: cat?.name ?? "—",
          categoryColor: cat?.color,
          status: productStockStatus(p),
          costValue: multiply(p.purchasePrice, Math.max(0, p.stock)),
          retailValue: multiply(p.sellingPrice, Math.max(0, p.stock)),
        };
      }),
    [scoped, categoryMap],
  );
  const totals = React.useMemo(() => ({ cost: allRows.reduce((a, r) => a + r.costValue, 0), retail: allRows.reduce((a, r) => a + r.retailValue, 0) }), [allRows]);
  const byCategory = React.useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    for (const r of allRows) {
      const cur = map.get(r.product.categoryId) ?? { name: r.category, value: 0 };
      cur.value += r.costValue;
      map.set(r.product.categoryId, cur);
    }
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 10);
  }, [allRows]);

  const statusRows = React.useMemo(() => (status === "all" ? allRows : allRows.filter((r) => r.status === status)), [allRows, status]);
  const search = useTableSearch(statusRows, (r) => [r.product.name, r.product.sku, r.product.barcode, r.category]);
  const csv = React.useMemo(
    () =>
      search.filtered.map((r) => ({
        Product: r.product.name,
        SKU: r.product.sku,
        Category: r.category,
        Stock: r.product.stock,
        Unit: r.product.unit,
        "Min stock": r.product.minStock,
        Status: STATUS_LABEL[r.status],
        "Unit cost (Rs)": fromCents(r.product.purchasePrice),
        "Stock value at cost (Rs)": fromCents(r.costValue),
        "Retail value (Rs)": fromCents(r.retailValue),
      })),
    [search.filtered],
  );
  useReportExport("inventory-report", csv);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Product",
        accessorFn: (r) => r.product.name,
        cell: ({ row }) => (
          <div className="flex min-w-48 items-center gap-2.5">
            <ProductThumb image={row.original.product.image} name={row.original.product.name} color={row.original.categoryColor} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.product.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.product.sku}</p>
            </div>
          </div>
        ),
      },
      { id: "category", header: "Category", accessorKey: "category" },
      { id: "stock", header: "Stock", accessorFn: (r) => r.product.stock, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium tabular whitespace-nowrap">{formatQty(row.original.product.stock, row.original.product.unit)}</span> },
      { id: "min", header: "Minimum", accessorFn: (r) => r.product.minStock, meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{formatQty(row.original.product.minStock, row.original.product.unit)}</span> },
      { id: "status", header: "Status", accessorKey: "status", cell: ({ row }) => <StockStatusBadge status={row.original.status} /> },
      { id: "cost", header: "Value at cost", accessorKey: "costValue", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatMoney(row.original.costValue)}</span> },
      { id: "retail", header: "Retail value", accessorKey: "retailValue", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{formatMoney(row.original.retailValue)}</span> },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <KpiRow>
        <Stat label="Active products" value={formatNumber(counts.active)} sub={categoryName(categories, categoryId)} />
        <Stat label="Stock value (cost)" value={formatMoney(totals.cost)} sub={`${formatMoney(totals.retail)} at retail`} />
        <Stat label="Low stock" value={formatNumber(counts.low)} tone={counts.low ? "warning" : "default"} sub="At or below minimum" />
        <Stat label="Out of stock" value={formatNumber(counts.out)} tone={counts.out ? "negative" : "default"} sub="Zero on hand" />
      </KpiRow>
      <Note>Inventory figures are a live snapshot of current stock — the date range does not apply to this report.</Note>
      <ChartGrid>
        <ChartCard title="Inventory status" description="Active products by stock status">
          {counts.active ? (
            <DonutChart
              money={false}
              centerLabel="Products"
              data={[
                { name: "In stock", value: counts.inStock, color: "var(--success)" },
                { name: "Low stock", value: counts.low, color: "var(--warning)" },
                { name: "Out of stock", value: counts.out, color: "var(--destructive)" },
              ]}
            />
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>
        <ChartCard title="Stock value by category" description="Valued at purchase cost">
          {byCategory.length ? <HBarChart data={byCategory} valueLabel="Value at cost" labelWidth={120} rowHeight={28} /> : <ChartEmpty />}
        </ChartCard>
      </ChartGrid>
      <ReportTable
        title="Stock on hand"
        description={`${formatNumber(search.filtered.length)} products`}
        columns={columns}
        rows={search.filtered}
        search={search}
        searchPlaceholder="Product, SKU or barcode…"
        getRowId={(r) => r.product.id}
        onRowClick={(r) => router.push(`/products?q=${encodeURIComponent(r.product.sku)}`)}
        initialSorting={[{ id: "cost", desc: true }]}
        toolbar={
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="sm:w-40" aria-label="Stock status filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="in_stock">In stock</SelectItem>
              <SelectItem value="low_stock">Low stock</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
