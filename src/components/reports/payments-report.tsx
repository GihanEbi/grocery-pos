"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { eachDayOfInterval, format } from "date-fns";
import { ChartCard } from "@/components/shared/chart";
import { PaymentBadge } from "@/components/shared/status-badges";
import type { ColumnDef } from "@/components/shared/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { useCustomerMap } from "@/hooks";
import { paymentBreakdown, salesInRange } from "@/lib/analytics";
import { fromCents } from "@/lib/calculations/money";
import { formatDateTime, formatMoney, formatNumber, paymentMethodLabel } from "@/lib/formatting";
import type { PaymentMethod, Sale } from "@/types";
import { ChartEmpty, DonutChart, GroupedBarChart, PAYMENT_COLORS } from "@/components/dashboard/charts";
import { ChartGrid, KpiRow, Note, ReportTable, Stat, useReport, useReportExport, useTableSearch } from "./report-kit";

interface Row {
  sale: Sale;
  customer: string;
  methods: PaymentMethod[];
  cash: number;
  card: number;
  qr: number;
  reference: string;
}

export function PaymentsReport() {
  const { range, rangeText } = useReport();
  const router = useRouter();
  const sales = useAppStore((s) => s.sales);
  const customers = useCustomerMap();
  const [method, setMethod] = React.useState<"all" | PaymentMethod>("all");

  const breakdown = React.useMemo(() => paymentBreakdown(sales, range), [sales, range]);
  const total = breakdown.reduce((a, r) => a + r.amount, 0);
  const inRange = React.useMemo(() => salesInRange(sales, range), [sales, range]);

  const daily = React.useMemo(() => {
    const to = range.to.getTime() > Date.now() ? new Date() : range.to;
    const days = eachDayOfInterval({ start: range.from, end: to });
    const long = days.length > 31;
    const map = new Map(days.map((d) => [format(d, "yyyy-MM-dd"), { label: format(d, long ? "dd MMM" : "EEE dd"), cash: 0, card: 0, qr: 0 }]));
    for (const s of inRange) {
      const p = map.get(format(new Date(s.date), "yyyy-MM-dd"));
      if (!p) continue;
      for (const pay of s.payments) p[pay.method] += pay.amount;
    }
    return [...map.values()];
  }, [inRange, range]);

  const rows = React.useMemo<Row[]>(
    () =>
      [...inRange]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((s) => {
          const sum = (m: PaymentMethod) => s.payments.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0);
          return {
            sale: s,
            customer: s.customerId ? customers.get(s.customerId)?.name ?? "Customer" : "Walk-in",
            methods: s.payments.map((p) => p.method),
            cash: sum("cash"),
            card: sum("card"),
            qr: sum("qr"),
            reference: s.payments.map((p) => p.reference).filter(Boolean).join(", "),
          };
        })
        .filter((r) => method === "all" || r.methods.includes(method)),
    [inRange, customers, method],
  );
  const search = useTableSearch(rows, (r) => [r.sale.receiptNo, r.customer, r.reference]);
  const csv = React.useMemo(
    () =>
      search.filtered.map((r) => ({
        Receipt: r.sale.receiptNo,
        Date: format(new Date(r.sale.date), "yyyy-MM-dd HH:mm"),
        Customer: r.customer,
        Methods: [...new Set(r.methods)].map((m) => paymentMethodLabel[m]).join(" + "),
        "Cash (Rs)": fromCents(r.cash),
        "Card (Rs)": fromCents(r.card),
        "QR (Rs)": fromCents(r.qr),
        "Total (Rs)": fromCents(r.sale.total),
        Reference: r.reference,
      })),
    [search.filtered],
  );
  useReportExport("payment-report", csv);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "receipt", header: "Receipt", accessorFn: (r) => r.sale.receiptNo, cell: ({ row }) => <span className="whitespace-nowrap font-medium">{row.original.sale.receiptNo}</span> },
      { id: "date", header: "Date", accessorFn: (r) => r.sale.date, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(row.original.sale.date)}</span> },
      { id: "customer", header: "Customer", accessorKey: "customer" },
      { id: "method", header: "Method", enableSorting: false, cell: ({ row }) => <PaymentBadge methods={row.original.methods} /> },
      { id: "cash", header: "Cash", accessorKey: "cash", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{row.original.cash ? formatMoney(row.original.cash) : "—"}</span> },
      { id: "card", header: "Card", accessorKey: "card", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{row.original.card ? formatMoney(row.original.card) : "—"}</span> },
      { id: "qr", header: "QR", accessorKey: "qr", meta: { align: "right" }, cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{row.original.qr ? formatMoney(row.original.qr) : "—"}</span> },
      { id: "total", header: "Total", accessorFn: (r) => r.sale.total, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium tabular whitespace-nowrap">{formatMoney(row.original.sale.total)}</span> },
    ],
    [],
  );

  const share = (amount: number) => (total > 0 ? `${Math.round((amount / total) * 1000) / 10}% of collections` : "No collections");

  return (
    <div className="space-y-6">
      <KpiRow>
        <Stat label="Total collected" value={formatMoney(total)} sub={`${formatNumber(inRange.length)} transactions`} />
        {breakdown.map((b) => (
          <Stat key={b.method} label={b.label} value={formatMoney(b.amount)} sub={`${formatNumber(b.count)} payments · ${share(b.amount)}`} />
        ))}
      </KpiRow>
      <ChartGrid className="lg:grid-cols-3">
        <ChartCard title="Payment method distribution" description={rangeText}>
          {total ? (
            <DonutChart className="sm:flex-col lg:flex-col" size={160} centerLabel="Collected" data={breakdown.map((b) => ({ name: b.label, value: b.amount, color: PAYMENT_COLORS[b.method], meta: `${b.count} txn` }))} />
          ) : (
            <ChartEmpty />
          )}
        </ChartCard>
        <ChartCard title="Daily collections by method" description="Stacked by payment method" className="lg:col-span-2">
          {total ? (
            <GroupedBarChart
              stacked
              data={daily}
              xKey="label"
              series={[
                { key: "cash", label: "Cash", color: PAYMENT_COLORS.cash },
                { key: "card", label: "Card", color: PAYMENT_COLORS.card },
                { key: "qr", label: "QR Pay", color: PAYMENT_COLORS.qr },
              ]}
            />
          ) : (
            <ChartEmpty height={260} />
          )}
        </ChartCard>
      </ChartGrid>
      <Note>Amounts are what was applied to each bill (cash tendered minus change). Refunds are reported in the Sales report.</Note>
      <ReportTable
        title="Payments"
        description={`${formatNumber(search.filtered.length)} transactions · ${rangeText}`}
        columns={columns}
        rows={search.filtered}
        search={search}
        searchPlaceholder="Receipt, customer or reference…"
        getRowId={(r) => r.sale.id}
        onRowClick={(r) => router.push(`/sales/${r.sale.id}`)}
        toolbar={
          <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
            <SelectTrigger className="sm:w-36" aria-label="Payment method filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="qr">QR Pay</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
