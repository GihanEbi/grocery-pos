"use client";
import * as React from "react";
import { ChartCard } from "@/components/shared/chart";
import { ProductThumb } from "@/components/shared/product-thumb";
import { ExpiryBadge } from "@/components/shared/status-badges";
import type { ColumnDef } from "@/components/shared/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { useCategoryMap } from "@/hooks";
import { expiryRows, type ExpiryRow } from "@/lib/analytics";
import { fromCents } from "@/lib/calculations/money";
import { formatDate, formatMoney, formatNumber, formatQty } from "@/lib/formatting";
import { ChartEmpty, GroupedBarChart } from "@/components/dashboard/charts";
import { categoryName, KpiRow, Note, ReportTable, Stat, useReport, useReportExport, useTableSearch } from "./report-kit";

interface Row extends ExpiryRow {
  category: string;
  categoryColor?: string;
}

const WINDOWS = [
  { value: "7", label: "Next 7 days" },
  { value: "14", label: "Next 14 days" },
  { value: "30", label: "Next 30 days" },
  { value: "90", label: "Next 90 days" },
];

export function ExpiryReport() {
  const { categoryId } = useReport();
  const batches = useAppStore((s) => s.batches);
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const categoryMap = useCategoryMap();
  const [win, setWin] = React.useState("30");

  const all = React.useMemo<Row[]>(
    () =>
      expiryRows(batches, products)
        .filter((r) => r.product.status !== "archived" && (categoryId === "all" || r.product.categoryId === categoryId))
        .map((r) => {
          const cat = categoryMap.get(r.product.categoryId);
          return { ...r, category: cat?.name ?? "—", categoryColor: cat?.color };
        }),
    [batches, products, categoryId, categoryMap],
  );
  const rows = React.useMemo(() => all.filter((r) => r.daysLeft <= Number(win)), [all, win]);

  const kpi = React.useMemo(() => {
    const expired = all.filter((r) => r.daysLeft < 0);
    const week = all.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 7);
    return {
      expired: expired.length,
      expiredValue: expired.reduce((a, r) => a + r.value, 0),
      week: week.length,
      weekValue: week.reduce((a, r) => a + r.value, 0),
      windowValue: rows.reduce((a, r) => a + r.value, 0),
      products: new Set(rows.map((r) => r.product.id)).size,
    };
  }, [all, rows]);

  const buckets = React.useMemo(() => {
    const defs: [string, (d: number) => boolean][] = [
      ["Expired", (d) => d < 0],
      ["0–3 d", (d) => d >= 0 && d <= 3],
      ["4–7 d", (d) => d >= 4 && d <= 7],
      ["8–14 d", (d) => d >= 8 && d <= 14],
      ["15–30 d", (d) => d >= 15 && d <= 30],
      ["31–90 d", (d) => d >= 31 && d <= 90],
    ];
    return defs.map(([label, fn]) => ({ label, value: all.filter((r) => fn(r.daysLeft)).reduce((a, r) => a + r.value, 0) }));
  }, [all]);

  const search = useTableSearch(rows, (r) => [r.product.name, r.batch.batchNo, r.category]);
  const csv = React.useMemo(
    () =>
      search.filtered.map((r) => ({
        Product: r.product.name,
        SKU: r.product.sku,
        Category: r.category,
        Batch: r.batch.batchNo,
        "Received date": r.batch.receivedDate.slice(0, 10),
        "Expiry date": r.batch.expiryDate.slice(0, 10),
        "Days left": r.daysLeft,
        Quantity: r.batch.quantity,
        Unit: r.product.unit,
        "Value at cost (Rs)": fromCents(r.value),
      })),
    [search.filtered],
  );
  useReportExport("expiry-report", csv);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Product",
        accessorFn: (r) => r.product.name,
        cell: ({ row }) => (
          <div className="flex min-w-44 items-center gap-2.5">
            <ProductThumb image={row.original.product.image} name={row.original.product.name} color={row.original.categoryColor} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.product.name}</p>
              <p className="text-xs text-muted-foreground">{row.original.category}</p>
            </div>
          </div>
        ),
      },
      { id: "batch", header: "Batch", accessorFn: (r) => r.batch.batchNo, cell: ({ row }) => <span className="font-mono text-xs">{row.original.batch.batchNo}</span> },
      { id: "expiry", header: "Expiry date", accessorFn: (r) => r.batch.expiryDate, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.batch.expiryDate)}</span> },
      { id: "qty", header: "Quantity", accessorFn: (r) => r.batch.quantity, meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatQty(row.original.batch.quantity, row.original.product.unit)}</span> },
      { id: "value", header: "Value at cost", accessorKey: "value", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatMoney(row.original.value)}</span> },
      { id: "days", header: "Days left", accessorKey: "daysLeft", cell: ({ row }) => <ExpiryBadge status={row.original.status} daysLeft={row.original.daysLeft} /> },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <KpiRow>
        <Stat label="Expired batches" value={formatNumber(kpi.expired)} tone={kpi.expired ? "negative" : "default"} sub={`${formatMoney(kpi.expiredValue)} at cost`} />
        <Stat label="Expiring ≤ 7 days" value={formatNumber(kpi.week)} tone={kpi.week ? "warning" : "default"} sub={`${formatMoney(kpi.weekValue)} at cost`} />
        <Stat label="Products affected" value={formatNumber(kpi.products)} sub={`${WINDOWS.find((w) => w.value === win)?.label} · ${categoryName(categories, categoryId)}`} />
        <Stat label="Value at risk" value={formatMoney(kpi.windowValue)} sub="Including expired stock" />
      </KpiRow>
      <Note>Expiry tracking uses batch expiry dates as of today — the date range does not apply to this report.</Note>
      <ChartCard title="Value at risk by time to expiry" description="Stock value at cost per expiry window">
        {buckets.some((b) => b.value > 0) ? (
          <GroupedBarChart data={buckets} xKey="label" height={240} series={[{ key: "value", label: "Value at cost", color: "var(--chart-3)" }]} />
        ) : (
          <ChartEmpty message="No batches expire in the next 90 days." />
        )}
      </ChartCard>
      <ReportTable
        title="Expiring batches"
        description={`${formatNumber(search.filtered.length)} batches`}
        columns={columns}
        rows={search.filtered}
        search={search}
        searchPlaceholder="Product, batch or category…"
        getRowId={(r) => r.batch.id}
        emptyTitle="No batches in this window"
        toolbar={
          <Select value={win} onValueChange={setWin}>
            <SelectTrigger className="sm:w-40" aria-label="Expiry window"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
