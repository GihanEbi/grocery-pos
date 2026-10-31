"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CloudOff, Download, ReceiptText, RotateCcw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import type { Sale } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCustomerMap, useDebounced, useUserMap } from "@/hooks";
import { salesInRange, summarize } from "@/lib/analytics";
import { formatDateTime, formatMoney, formatRelative, paymentMethodLabel } from "@/lib/formatting";
import { downloadCsv } from "@/lib/utils";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { DateRangePicker, rangeLabel, useRangeState } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { PaymentBadge, SaleStatusBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAYMENT_FILTERS, SALE_STATUS_OPTIONS, paymentKind, saleRefunded } from "./sales-utils";

interface Row {
  sale: Sale;
  customer: string;
  cashier: string;
  items: number;
}

export function SalesTab() {
  const router = useRouter();
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const users = useAppStore((s) => s.users);
  const hydrated = useAppStore((s) => s.hydrated);
  const customerMap = useCustomerMap();
  const userMap = useUserMap();

  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim().toLowerCase());
  const [range, setRange] = useRangeState("last7");
  const [cashier, setCashier] = useState("all");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");

  const summary = useMemo(() => summarize(sales, returns, range.range), [sales, returns, range]);

  const rows = useMemo<Row[]>(() => {
    return salesInRange(sales, range.range)
      .filter((s) => (cashier === "all" ? true : s.cashierId === cashier))
      .filter((s) => (method === "all" ? true : paymentKind(s) === method))
      .filter((s) => (status === "all" ? true : s.status === status))
      .map((s) => ({
        sale: s,
        customer: s.customerId ? customerMap.get(s.customerId)?.name ?? "Unknown customer" : "Walk-in",
        cashier: userMap.get(s.cashierId)?.name ?? "—",
        items: s.items.length,
      }))
      .filter((r) => !q || r.sale.receiptNo.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q))
      .sort((a, b) => b.sale.date.localeCompare(a.sale.date));
  }, [sales, range, cashier, method, status, q, customerMap, userMap]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "receipt",
        header: "Receipt",
        accessorFn: (r) => r.sale.receiptNo,
        cell: ({ row }) => (
          <span className="font-mono text-[13px] font-medium" data-testid={`sale-row-${row.original.sale.receiptNo}`}>
            {row.original.sale.receiptNo}
          </span>
        ),
      },
      {
        id: "date",
        header: "Date",
        accessorFn: (r) => r.sale.date,
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatRelative(row.original.sale.date)}</span>,
      },
      {
        id: "customer",
        header: "Customer",
        accessorFn: (r) => r.customer,
        cell: ({ row }) => (
          <span className={row.original.sale.customerId ? "font-medium" : "text-muted-foreground"}>{row.original.customer}</span>
        ),
      },
      { id: "cashier", header: "Cashier", accessorFn: (r) => r.cashier, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
      { id: "items", header: "Items", accessorFn: (r) => r.items, meta: { align: "right" }, cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span> },
      {
        id: "payment",
        header: "Payment",
        enableSorting: false,
        cell: ({ row }) => <PaymentBadge methods={row.original.sale.payments.filter((p) => p.amount > 0).map((p) => p.method)} />,
      },
      {
        id: "total",
        header: "Total",
        accessorFn: (r) => r.sale.total,
        meta: { align: "right" },
        cell: ({ row }) => <Money value={row.original.sale.total} className="font-medium" />,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => r.sale.status,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <SaleStatusBadge status={row.original.sale.status} />
            {!row.original.sale.synced && (
              <Badge variant="warning" title="Created offline — waiting to sync"><CloudOff /> Pending sync</Badge>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const exportCsv = () => {
    if (rows.length === 0) return toast.error("Nothing to export for the current filters.");
    downloadCsv(
      `sales-${new Date().toISOString().slice(0, 10)}`,
      rows.map((r) => ({
        "Receipt No": r.sale.receiptNo,
        Date: formatDateTime(r.sale.date),
        Customer: r.customer,
        Cashier: r.cashier,
        Items: r.items,
        Payment: paymentMethodLabel[paymentKind(r.sale)],
        Subtotal: (r.sale.subtotal / 100).toFixed(2),
        Tax: (r.sale.taxTotal / 100).toFixed(2),
        Total: (r.sale.total / 100).toFixed(2),
        Refunded: (saleRefunded(r.sale) / 100).toFixed(2),
        Status: r.sale.status,
        Synced: r.sale.synced ? "yes" : "no",
      })),
    );
    toast.success(`Exported ${rows.length} sales to CSV.`);
  };

  const filtersActive = !!search || cashier !== "all" || method !== "all" || status !== "all";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Transactions" value={summary.transactions.toLocaleString("en-LK")} icon={ReceiptText} tone="info" hint={rangeLabel(range)} />
        <KpiCard label="Gross sales" value={formatMoney(summary.grossSales)} icon={Banknote} tone="primary" hint={`Avg basket ${formatMoney(summary.avgBasket)}`} />
        <KpiCard label="Refunds" value={formatMoney(summary.refunds)} icon={RotateCcw} tone="destructive" hint="Returns processed in range" />
        <KpiCard label="Net sales" value={formatMoney(summary.netSales)} icon={TrendingUp} tone="success" hint="Gross sales minus refunds" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search receipt no. or customer" data-testid="sales-search" className="lg:w-72" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <DateRangePicker value={range} onChange={setRange} className="col-span-2 sm:w-auto" />
          <Select value={cashier} onValueChange={setCashier}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by cashier" data-testid="sales-cashier-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cashiers</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="sm:w-36" aria-label="Filter by payment method" data-testid="sales-payment-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              {PAYMENT_FILTERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by status" data-testid="sales-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {SALE_STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} data-testid="sales-export"><Download /> Export</Button>
        </div>
      </div>

      <DataTable
        testId="sales-table"
        columns={columns}
        data={rows}
        loading={!hydrated}
        getRowId={(r) => r.sale.id}
        onRowClick={(r) => router.push(`/sales/${r.sale.id}`)}
        resetKey={`${q}|${range.range.from.getTime()}|${range.range.to.getTime()}|${cashier}|${method}|${status}`}
        empty={
          <EmptyState
            icon={ReceiptText}
            title="No sales match these filters"
            description={filtersActive ? "Try a different receipt number, cashier or payment method." : "No transactions were recorded in this date range."}
            action={
              filtersActive ? (
                <Button variant="outline" size="sm" onClick={() => { setSearch(""); setCashier("all"); setMethod("all"); setStatus("all"); }}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
