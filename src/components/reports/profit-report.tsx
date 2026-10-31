"use client";
import * as React from "react";
import { format } from "date-fns";
import { ChartCard, CHART_COLORS } from "@/components/shared/chart";
import type { ColumnDef } from "@/components/shared/data-table";
import { useAppStore } from "@/store/app-store";
import { useCategoryMap, useProductMap } from "@/hooks";
import { dailySeries, productPerformance, summarize } from "@/lib/analytics";
import { fromCents } from "@/lib/calculations/money";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { ChartEmpty, GroupedBarChart, HBarChart, TrendAreaChart } from "@/components/dashboard/charts";
import { ChartGrid, categoryName, filterSalesByCategory, KpiRow, ReportTable, Stat, useReport, useReportExport, useTableSearch, type CsvRow } from "./report-kit";

interface ProfitRow {
  key: string;
  label: string;
  sub?: string;
  revenue: number;
  cogs: number;
  profit: number;
  marginBps: number;
}

const margin = (revenue: number, profit: number) => (revenue > 0 ? Math.round((profit * 10000) / revenue) : 0);

function MarginCell({ bps }: { bps: number }) {
  return <span className={cn("tabular", bps < 0 ? "text-destructive-foreground" : bps < 1000 ? "text-warning-foreground" : "text-muted-foreground")}>{formatPercent(bps)}</span>;
}

export function ProfitReport() {
  const { range, rangeText, categoryId } = useReport();
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const productMap = useProductMap();
  const categoryMap = useCategoryMap();
  const [view, setView] = React.useState<"day" | "product">("day");

  const filtered = React.useMemo(() => filterSalesByCategory(sales, products, categoryId), [sales, products, categoryId]);
  // Returns are only attributable to categories line-by-line (already reflected via returnedQty), so pass none when filtering.
  const summary = React.useMemo(() => summarize(filtered, categoryId === "all" ? returns : [], range), [filtered, returns, categoryId, range]);
  const daily = React.useMemo(() => dailySeries(filtered, [], range), [filtered, range]);

  const dayRows = React.useMemo<ProfitRow[]>(
    () =>
      daily
        .filter((d) => d.revenue !== 0 || d.transactions > 0)
        .map((d) => ({ key: d.date, label: formatDate(d.date + "T00:00"), sub: format(new Date(d.date + "T00:00"), "EEEE"), revenue: d.revenue, cogs: d.revenue - d.profit, profit: d.profit, marginBps: margin(d.revenue, d.profit) }))
        .reverse(),
    [daily],
  );
  const productRows = React.useMemo<ProfitRow[]>(
    () =>
      productPerformance(filtered, range)
        .map((p) => {
          const prod = productMap.get(p.productId);
          return { key: p.productId, label: p.name, sub: prod ? categoryMap.get(prod.categoryId)?.name : undefined, revenue: p.revenue, cogs: p.revenue - p.profit, profit: p.profit, marginBps: margin(p.revenue, p.profit) };
        })
        .sort((a, b) => b.profit - a.profit),
    [filtered, range, productMap, categoryMap],
  );

  const rows = view === "day" ? dayRows : productRows;
  const search = useTableSearch(rows, (r) => [r.label, r.sub]);
  const csv = React.useMemo<CsvRow[]>(
    () =>
      search.filtered.map((r) => ({
        [view === "day" ? "Date" : "Product"]: view === "day" ? r.key : r.label,
        ...(view === "product" ? { Category: r.sub ?? "" } : {}),
        "Revenue (Rs)": fromCents(r.revenue),
        "COGS (Rs)": fromCents(r.cogs),
        "Gross profit (Rs)": fromCents(r.profit),
        "Margin %": r.marginBps / 100,
      })),
    [search.filtered, view],
  );
  useReportExport(view === "day" ? "profit-by-day" : "profit-by-product", csv);

  const columns = React.useMemo<ColumnDef<ProfitRow, unknown>[]>(
    () => [
      {
        id: "label",
        header: view === "day" ? "Date" : "Product",
        accessorFn: (r) => (view === "day" ? r.key : r.label),
        cell: ({ row }) => (
          <div className="min-w-36">
            <p className="font-medium">{row.original.label}</p>
            {row.original.sub && <p className="text-xs text-muted-foreground">{row.original.sub}</p>}
          </div>
        ),
      },
      { id: "revenue", header: "Revenue", accessorKey: "revenue", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatMoney(row.original.revenue)}</span> },
      { id: "cogs", header: "COGS", accessorKey: "cogs", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{formatMoney(row.original.cogs)}</span> },
      { id: "profit", header: "Gross profit", accessorKey: "profit", meta: { align: "right" }, cell: ({ row }) => <span className="font-medium tabular whitespace-nowrap">{formatMoney(row.original.profit)}</span> },
      { id: "margin", header: "Margin", accessorKey: "marginBps", meta: { align: "right" }, cell: ({ row }) => <MarginCell bps={row.original.marginBps} /> },
    ],
    [view],
  );

  const series = [
    { key: "revenue", label: "Revenue", color: CHART_COLORS[0] },
    { key: "profit", label: "Gross profit", color: CHART_COLORS[1] },
  ];

  return (
    <div className="space-y-6">
      <KpiRow>
        <Stat label="Revenue (ex-tax)" value={formatMoney(summary.revenue)} sub={categoryName(categories, categoryId)} />
        <Stat label="Cost of goods sold" value={formatMoney(summary.cogs)} sub="From cost snapshots on each sale" />
        <Stat label="Gross profit" value={formatMoney(summary.grossProfit)} tone={summary.grossProfit < 0 ? "negative" : "positive"} sub={`${formatNumber(summary.transactions)} transactions`} />
        <Stat label="Gross margin" value={formatPercent(summary.marginBps)} sub="Gross profit ÷ revenue" />
      </KpiRow>
      <ChartGrid className="lg:grid-cols-3">
        <ChartCard title="Revenue vs gross profit" description={`Daily · ${rangeText}`} className="lg:col-span-2">
          {daily.some((d) => d.revenue > 0) ? (
            daily.length <= 31 ? <GroupedBarChart data={daily} xKey="label" series={series} /> : <TrendAreaChart data={daily} xKey="label" series={series} />
          ) : (
            <ChartEmpty height={260} />
          )}
        </ChartCard>
        <ChartCard title="Most profitable products" description="Top 8 by gross profit">
          {productRows.length ? <HBarChart data={productRows.slice(0, 8).map((r) => ({ name: r.label, value: r.profit }))} color={CHART_COLORS[1]} valueLabel="Gross profit" labelWidth={112} rowHeight={30} /> : <ChartEmpty />}
        </ChartCard>
      </ChartGrid>
      <ReportTable
        title={view === "day" ? "Profit by day" : "Profit by product"}
        description="Revenue excludes tax; COGS uses the unit cost frozen on each sale line, net of returns."
        columns={columns}
        rows={search.filtered}
        search={search}
        searchPlaceholder={view === "day" ? "Search dates…" : "Product or category…"}
        getRowId={(r) => r.key}
        initialSorting={view === "product" ? [{ id: "profit", desc: true }] : undefined}
        toolbar={
          <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label="Group profit by">
            {(["day", "product"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn("h-7 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-all hover:text-foreground", view === v && "bg-card text-foreground shadow-sm")}
              >
                By {v}
              </button>
            ))}
          </div>
        }
      />
    </div>
  );
}
