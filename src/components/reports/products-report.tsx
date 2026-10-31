"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChartCard, CHART_COLORS } from "@/components/shared/chart";
import { ProductThumb } from "@/components/shared/product-thumb";
import type { ColumnDef } from "@/components/shared/data-table";
import { useAppStore } from "@/store/app-store";
import { useCategoryMap, useProductMap } from "@/hooks";
import { categoryPerformance, productPerformance, type ProductPerformance } from "@/lib/analytics";
import { fromCents } from "@/lib/calculations/money";
import { formatMoney, formatNumber, formatPercent, formatQty } from "@/lib/formatting";
import type { ProductUnit } from "@/types";
import { ChartEmpty, DonutChart, HBarChart } from "@/components/dashboard/charts";
import { ChartGrid, categoryName, filterSalesByCategory, KpiRow, ReportTable, Stat, useReport, useReportExport, useTableSearch } from "./report-kit";

interface Row extends ProductPerformance {
  category: string;
  categoryColor?: string;
  image: string;
  sku: string;
  marginBps: number;
}

export function ProductsReport() {
  const { range, rangeText, categoryId } = useReport();
  const router = useRouter();
  const sales = useAppStore((s) => s.sales);
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const productMap = useProductMap();
  const categoryMap = useCategoryMap();

  const filteredSales = React.useMemo(() => filterSalesByCategory(sales, products, categoryId), [sales, products, categoryId]);
  const rows = React.useMemo<Row[]>(
    () =>
      productPerformance(filteredSales, range)
        .map((p) => {
          const prod = productMap.get(p.productId);
          const cat = prod ? categoryMap.get(prod.categoryId) : undefined;
          return {
            ...p,
            category: cat?.name ?? "—",
            categoryColor: cat?.color,
            image: prod?.image ?? "📦",
            sku: prod?.sku ?? "",
            marginBps: p.revenue > 0 ? Math.round((p.profit * 10000) / p.revenue) : 0,
          };
        })
        .sort((a, b) => b.revenue - a.revenue),
    [filteredSales, range, productMap, categoryMap],
  );
  const cats = React.useMemo(() => {
    const list = categoryPerformance(filteredSales, products, categories, range).filter((c) => c.revenue > 0);
    const top = list.slice(0, 5).map((c, i) => ({ name: c.name, value: c.revenue, color: CHART_COLORS[i] }));
    const rest = list.slice(5).reduce((a, c) => a + c.revenue, 0);
    return rest > 0 ? [...top, { name: "Other", value: rest, color: "var(--chart-6)" }] : top;
  }, [filteredSales, products, categories, range]);

  const totals = React.useMemo(() => {
    const revenue = rows.reduce((a, r) => a + r.revenue, 0);
    const profit = rows.reduce((a, r) => a + r.profit, 0);
    const units = rows.reduce((a, r) => a + (r.unit === "kg" ? 0 : r.qty), 0);
    return { revenue, profit, units, top: rows[0] };
  }, [rows]);

  const search = useTableSearch(rows, (r) => [r.name, r.sku, r.category]);
  const csv = React.useMemo(
    () =>
      search.filtered.map((r) => ({
        Product: r.name,
        SKU: r.sku,
        Category: r.category,
        "Qty sold": r.qty,
        Unit: r.unit,
        "Revenue (Rs)": fromCents(r.revenue),
        "Gross profit (Rs)": fromCents(r.profit),
        "Margin %": r.marginBps / 100,
        Transactions: r.transactions,
      })),
    [search.filtered],
  );
  useReportExport("product-sales-report", csv);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Product",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="flex min-w-48 items-center gap-2.5">
            <ProductThumb image={row.original.image} name={row.original.name} color={row.original.categoryColor} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.sku}</p>
            </div>
          </div>
        ),
      },
      { id: "category", header: "Category", accessorKey: "category" },
      { id: "qty", header: "Qty sold", accessorKey: "qty", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatQty(row.original.qty, row.original.unit as ProductUnit)}</span> },
      { id: "revenue", header: "Revenue", accessorKey: "revenue", meta: { align: "right" }, cell: ({ row }) => <span className="font-medium tabular whitespace-nowrap">{formatMoney(row.original.revenue)}</span> },
      { id: "profit", header: "Gross profit", accessorKey: "profit", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatMoney(row.original.profit)}</span> },
      { id: "margin", header: "Margin", accessorKey: "marginBps", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{formatPercent(row.original.marginBps)}</span> },
      { id: "tx", header: "Sales", accessorKey: "transactions", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{row.original.transactions}</span> },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <KpiRow>
        <Stat label="Products sold" value={formatNumber(rows.length)} sub={categoryName(categories, categoryId)} />
        <Stat label="Units sold" value={formatNumber(Math.round(totals.units))} sub="Excludes weighed (kg) items" />
        <Stat label="Revenue (ex-tax)" value={formatMoney(totals.revenue)} sub={`${formatMoney(totals.profit)} gross profit`} />
        <Stat label="Best seller" value={<span className="block truncate text-base">{totals.top?.name ?? "—"}</span>} sub={totals.top ? formatMoney(totals.top.revenue) : "No sales in range"} />
      </KpiRow>
      <ChartGrid className="lg:grid-cols-3">
        <ChartCard title="Top-selling products" description={`Top 10 by revenue · ${rangeText}`} className="lg:col-span-2">
          {rows.length ? <HBarChart data={rows.slice(0, 10).map((r) => ({ name: r.name, value: r.revenue }))} color={CHART_COLORS[0]} labelWidth={132} rowHeight={30} /> : <ChartEmpty />}
        </ChartCard>
        <ChartCard title="Sales by category" description="Revenue share (ex-tax)">
          {cats.length ? <DonutChart data={cats} size={160} className="sm:flex-col lg:flex-col" legendLimit={8} /> : <ChartEmpty />}
        </ChartCard>
      </ChartGrid>
      <ReportTable
        title="Product sales"
        description={`${formatNumber(search.filtered.length)} products · ${rangeText}`}
        columns={columns}
        rows={search.filtered}
        search={search}
        searchPlaceholder="Product, SKU or category…"
        getRowId={(r) => r.productId}
        onRowClick={(r) => router.push(`/products?q=${encodeURIComponent(r.sku)}`)}
        initialSorting={[{ id: "revenue", desc: true }]}
      />
    </div>
  );
}
