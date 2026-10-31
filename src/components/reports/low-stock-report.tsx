"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChartCard, CHART_COLORS } from "@/components/shared/chart";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StockStatusBadge } from "@/components/shared/status-badges";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { ColumnDef } from "@/components/shared/data-table";
import { useAppStore } from "@/store/app-store";
import { useCategoryMap, useSupplierMap } from "@/hooks";
import { productStockStatus, reorderSuggestions, type ReorderSuggestion } from "@/lib/analytics";
import { fromCents, multiply } from "@/lib/calculations/money";
import type { StockStatus } from "@/lib/calculations/inventory";
import { formatMoney, formatNumber, formatQty } from "@/lib/formatting";
import type { Product } from "@/types";
import { ChartEmpty, GroupedBarChart } from "@/components/dashboard/charts";
import { categoryName, KpiRow, Note, ReportTable, Stat, useReport, useReportExport, useTableSearch } from "./report-kit";

interface Row {
  product: Product;
  category: string;
  categoryColor?: string;
  supplier: string;
  status: StockStatus;
  suggestion: ReorderSuggestion | null;
  suggestedQty: number;
  estimatedCost: number;
}

const PRIORITY: Record<string, [string, BadgeVariant]> = {
  critical: ["Critical", "destructive"],
  high: ["High", "warning"],
  medium: ["Medium", "info"],
  low: ["Low", "secondary"],
};

export function LowStockReport() {
  const { categoryId } = useReport();
  const router = useRouter();
  const products = useAppStore((s) => s.products);
  const suppliers = useAppStore((s) => s.suppliers);
  const sales = useAppStore((s) => s.sales);
  const categories = useAppStore((s) => s.categories);
  const categoryMap = useCategoryMap();
  const supplierMap = useSupplierMap();

  const suggestions = React.useMemo(() => new Map(reorderSuggestions(products, suppliers, sales).map((s) => [s.product.id, s])), [products, suppliers, sales]);
  const rows = React.useMemo<Row[]>(
    () =>
      products
        .filter((p) => p.status === "active" && (categoryId === "all" || p.categoryId === categoryId) && productStockStatus(p) !== "in_stock")
        .map((p) => {
          const s = suggestions.get(p.id) ?? null;
          // Fall back to topping up to 2× minimum if the forecast has no suggestion.
          const suggestedQty = s?.suggestedQty ?? Math.max(0, Math.ceil(p.minStock * 2 - p.stock));
          const cat = categoryMap.get(p.categoryId);
          return {
            product: p,
            category: cat?.name ?? "—",
            categoryColor: cat?.color,
            supplier: p.supplierId ? supplierMap.get(p.supplierId)?.name ?? "—" : "—",
            status: productStockStatus(p),
            suggestion: s,
            suggestedQty,
            estimatedCost: s?.estimatedCost ?? multiply(p.purchasePrice, suggestedQty),
          };
        })
        .sort((a, b) => a.product.stock / Math.max(1, a.product.minStock) - b.product.stock / Math.max(1, b.product.minStock)),
    [products, categoryId, suggestions, categoryMap, supplierMap],
  );

  const kpi = React.useMemo(
    () => ({
      low: rows.filter((r) => r.status === "low_stock").length,
      out: rows.filter((r) => r.status === "out_of_stock").length,
      critical: rows.filter((r) => r.suggestion?.priority === "critical").length,
      cost: rows.reduce((a, r) => a + r.estimatedCost, 0),
    }),
    [rows],
  );
  const chart = React.useMemo(() => rows.slice(0, 10).map((r) => ({ name: r.product.name.length > 12 ? `${r.product.name.slice(0, 11)}…` : r.product.name, full: r.product.name, stock: r.product.stock, minimum: r.product.minStock })), [rows]);

  const search = useTableSearch(rows, (r) => [r.product.name, r.product.sku, r.category, r.supplier]);
  const csv = React.useMemo(
    () =>
      search.filtered.map((r) => ({
        Product: r.product.name,
        SKU: r.product.sku,
        Category: r.category,
        Supplier: r.supplier,
        Available: r.product.stock,
        Minimum: r.product.minStock,
        Unit: r.product.unit,
        Status: r.status === "out_of_stock" ? "Out of stock" : "Low stock",
        "Daily velocity": r.suggestion ? Math.round(r.suggestion.dailyVelocity * 100) / 100 : 0,
        "Days of cover": r.suggestion && Number.isFinite(r.suggestion.daysOfCover) ? Math.round(r.suggestion.daysOfCover * 10) / 10 : "",
        Priority: r.suggestion?.priority ?? "",
        "Suggested reorder qty": r.suggestedQty,
        "Estimated cost (Rs)": fromCents(r.estimatedCost),
      })),
    [search.filtered],
  );
  useReportExport("low-stock-report", csv);

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
              <p className="text-xs text-muted-foreground">{row.original.supplier}</p>
            </div>
          </div>
        ),
      },
      { id: "category", header: "Category", accessorKey: "category" },
      { id: "stock", header: "Available", accessorFn: (r) => r.product.stock, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium tabular whitespace-nowrap">{formatQty(row.original.product.stock, row.original.product.unit)}</span> },
      { id: "min", header: "Minimum", accessorFn: (r) => r.product.minStock, meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{formatQty(row.original.product.minStock, row.original.product.unit)}</span> },
      { id: "status", header: "Status", accessorKey: "status", cell: ({ row }) => <StockStatusBadge status={row.original.status} /> },
      {
        id: "priority",
        header: "Priority",
        accessorFn: (r) => ["critical", "high", "medium", "low"].indexOf(r.suggestion?.priority ?? "low"),
        cell: ({ row }) => {
          const p = row.original.suggestion?.priority;
          if (!p) return <span className="text-xs text-muted-foreground">—</span>;
          const [label, v] = PRIORITY[p];
          return <Badge variant={v}>{label}</Badge>;
        },
      },
      { id: "suggested", header: "Suggested qty", accessorKey: "suggestedQty", meta: { align: "right" }, cell: ({ row }) => <span className="font-semibold tabular whitespace-nowrap text-primary">{formatQty(row.original.suggestedQty, row.original.product.unit)}</span> },
      { id: "cost", header: "Est. cost", accessorKey: "estimatedCost", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatMoney(row.original.estimatedCost)}</span> },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <KpiRow>
        <Stat label="Low stock" value={formatNumber(kpi.low)} tone={kpi.low ? "warning" : "default"} sub={categoryName(categories, categoryId)} />
        <Stat label="Out of stock" value={formatNumber(kpi.out)} tone={kpi.out ? "negative" : "default"} sub="Cannot be sold until restocked" />
        <Stat label="Critical priority" value={formatNumber(kpi.critical)} sub="Less cover than supplier lead time" />
        <Stat label="Estimated reorder cost" value={formatMoney(kpi.cost)} sub="At current purchase prices" />
      </KpiRow>
      <Note>Suggested quantities use 14-day sales velocity and each supplier&apos;s lead time — the same forecast the AI assistant and purchasing use. Stock is a live snapshot.</Note>
      <ChartCard title="Available vs minimum stock" description="Most urgent 10 products">
        {chart.length ? (
          <GroupedBarChart
            data={chart}
            xKey="name"
            money={false}
            height={260}
            series={[
              { key: "stock", label: "Available", color: CHART_COLORS[4] },
              { key: "minimum", label: "Minimum", color: CHART_COLORS[5] },
            ]}
          />
        ) : (
          <ChartEmpty message="No products are below their minimum stock." />
        )}
      </ChartCard>
      <ReportTable
        title="Products to reorder"
        description={`${formatNumber(search.filtered.length)} products at or below minimum`}
        columns={columns}
        rows={search.filtered}
        search={search}
        searchPlaceholder="Product, category or supplier…"
        getRowId={(r) => r.product.id}
        onRowClick={(r) => router.push(`/inventory?q=${encodeURIComponent(r.product.sku)}`)}
        emptyTitle="No low-stock products"
      />
    </div>
  );
}
