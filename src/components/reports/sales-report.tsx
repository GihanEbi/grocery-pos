"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChartCard, CHART_COLORS } from "@/components/shared/chart";
import { PaymentBadge, SaleStatusBadge } from "@/components/shared/status-badges";
import type { ColumnDef } from "@/components/shared/data-table";
import { useAppStore } from "@/store/app-store";
import { useCustomerMap, useUserMap } from "@/hooks";
import { categoryPerformance, dailySeries, salesInRange, summarize } from "@/lib/analytics";
import { fromCents } from "@/lib/calculations/money";
import { formatDateTime, formatMoney, formatNumber, paymentMethodLabel } from "@/lib/formatting";
import { ChartEmpty, DonutChart, TrendAreaChart } from "@/components/dashboard/charts";
import { ChartGrid, KpiRow, ReportTable, Stat, useReport, useReportExport, useTableSearch } from "./report-kit";
import type { Sale } from "@/types";

interface Row {
  sale: Sale;
  customer: string;
  cashier: string;
  items: number;
  discount: number;
}

export function SalesReport() {
  const { range, rangeText } = useReport();
  const router = useRouter();
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const customers = useCustomerMap();
  const users = useUserMap();

  const summary = React.useMemo(() => summarize(sales, returns, range), [sales, returns, range]);
  const daily = React.useMemo(() => dailySeries(sales, returns, range), [sales, returns, range]);
  const cats = React.useMemo(() => {
    const rows = categoryPerformance(sales, products, categories, range).filter((c) => c.revenue > 0);
    const top = rows.slice(0, 5).map((c, i) => ({ name: c.name, value: c.revenue, color: CHART_COLORS[i] }));
    const rest = rows.slice(5).reduce((a, c) => a + c.revenue, 0);
    return rest > 0 ? [...top, { name: "Other", value: rest, color: "var(--chart-6)" }] : top;
  }, [sales, products, categories, range]);

  const rows = React.useMemo<Row[]>(
    () =>
      salesInRange(sales, range)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((s) => ({
          sale: s,
          customer: s.customerId ? customers.get(s.customerId)?.name ?? "Customer" : "Walk-in",
          cashier: users.get(s.cashierId)?.name ?? "—",
          items: s.items.length,
          discount: s.itemDiscountTotal + (s.billDiscount?.amount ?? 0),
        })),
    [sales, range, customers, users],
  );
  const search = useTableSearch(rows, (r) => [r.sale.receiptNo, r.customer, r.cashier]);

  const csv = React.useMemo(
    () =>
      search.filtered.map((r) => ({
        Receipt: r.sale.receiptNo,
        Date: format(new Date(r.sale.date), "yyyy-MM-dd HH:mm"),
        Customer: r.customer,
        Cashier: r.cashier,
        Lines: r.items,
        "Subtotal (Rs)": fromCents(r.sale.subtotal),
        "Discount (Rs)": fromCents(r.discount),
        "Tax (Rs)": fromCents(r.sale.taxTotal),
        "Total (Rs)": fromCents(r.sale.total),
        Payment: [...new Set(r.sale.payments.map((p) => paymentMethodLabel[p.method]))].join(" + "),
        Status: r.sale.status,
      })),
    [search.filtered],
  );
  useReportExport("sales-report", csv);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "receipt", header: "Receipt", accessorFn: (r) => r.sale.receiptNo, cell: ({ row }) => <span className="whitespace-nowrap font-medium">{row.original.sale.receiptNo}</span> },
      { id: "date", header: "Date", accessorFn: (r) => r.sale.date, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.original.sale.date)}</span> },
      { id: "customer", header: "Customer", accessorKey: "customer" },
      { id: "cashier", header: "Cashier", accessorKey: "cashier" },
      { id: "items", header: "Lines", accessorKey: "items", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap">{row.original.items}</span> },
      { id: "discount", header: "Discount", accessorKey: "discount", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{formatMoney(row.original.discount)}</span> },
      { id: "total", header: "Total", accessorFn: (r) => r.sale.total, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium tabular whitespace-nowrap">{formatMoney(row.original.sale.total)}</span> },
      { id: "payment", header: "Payment", enableSorting: false, cell: ({ row }) => <PaymentBadge methods={row.original.sale.payments.map((p) => p.method)} /> },
      { id: "status", header: "Status", accessorFn: (r) => r.sale.status, cell: ({ row }) => <SaleStatusBadge status={row.original.sale.status} /> },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <KpiRow>
        <Stat label="Gross sales" value={formatMoney(summary.grossSales)} sub={`Incl. ${formatMoney(summary.tax)} tax`} />
        <Stat label="Net sales" value={formatMoney(summary.netSales)} sub={`After ${formatMoney(summary.refunds)} refunds`} />
        <Stat label="Transactions" value={formatNumber(summary.transactions)} sub={`${formatNumber(summary.itemsSold)} items sold`} />
        <Stat label="Average basket" value={formatMoney(summary.avgBasket)} sub={`${formatMoney(summary.discounts)} discounts given`} />
      </KpiRow>
      <ChartGrid className="lg:grid-cols-3">
        <ChartCard title="Revenue trend" description={`${rangeText} · daily sales incl. tax`} className="lg:col-span-2">
          {daily.some((d) => d.sales > 0) ? (
            <TrendAreaChart
              data={daily}
              xKey="label"
              series={[{ key: "sales", label: "Sales (incl. tax)", color: CHART_COLORS[0] }]}
            />
          ) : (
            <ChartEmpty height={260} />
          )}
        </ChartCard>
        <ChartCard title="Sales by category" description="Revenue share (ex-tax)">
          {cats.length ? <DonutChart data={cats} size={160} className="sm:flex-col lg:flex-col" legendLimit={7} /> : <ChartEmpty />}
        </ChartCard>
      </ChartGrid>
      <ReportTable
        title="Transactions"
        description={`${formatNumber(search.filtered.length)} sale${search.filtered.length === 1 ? "" : "s"} · ${rangeText}`}
        columns={columns}
        rows={search.filtered}
        search={search}
        searchPlaceholder="Receipt, customer or cashier…"
        getRowId={(r) => r.sale.id}
        onRowClick={(r) => router.push(`/sales/${r.sale.id}`)}
      />
    </div>
  );
}
