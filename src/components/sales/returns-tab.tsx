"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Download, PackageCheck, RotateCcw, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import type { SaleReturn } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useDebounced, useUserMap } from "@/hooks";
import { inRange } from "@/lib/analytics";
import { formatDateTime, formatMoney, formatQty, formatRelative, paymentMethodLabel } from "@/lib/formatting";
import { downloadCsv } from "@/lib/utils";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { DateRangePicker, rangeLabel, useRangeState } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reasonLabel } from "./sales-utils";

interface Row {
  ret: SaleReturn;
  summary: string;
  processedBy: string;
  restocked: boolean;
}

function itemsSummary(ret: SaleReturn): string {
  const first = ret.items[0];
  if (!first) return "—";
  const head = `${first.name} × ${formatQty(first.quantity)}`;
  return ret.items.length > 1 ? `${head} +${ret.items.length - 1} more` : head;
}

export function ReturnsTab() {
  const router = useRouter();
  const returns = useAppStore((s) => s.returns);
  const hydrated = useAppStore((s) => s.hydrated);
  const userMap = useUserMap();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim().toLowerCase());
  const [range, setRange] = useRangeState("last30");

  const rows = useMemo<Row[]>(
    () =>
      returns
        .filter((r) => inRange(r.date, range.range))
        .filter(
          (r) =>
            !q ||
            r.returnNo.toLowerCase().includes(q) ||
            r.receiptNo.toLowerCase().includes(q) ||
            r.items.some((i) => i.name.toLowerCase().includes(q)),
        )
        .map((r) => ({
          ret: r,
          summary: itemsSummary(r),
          processedBy: userMap.get(r.userId)?.name ?? "—",
          restocked: r.items.some((i) => i.restocked),
        }))
        .sort((a, b) => b.ret.date.localeCompare(a.ret.date)),
    [returns, range, q, userMap],
  );

  const totals = useMemo(() => {
    const amount = rows.reduce((a, r) => a + r.ret.refundAmount, 0);
    const restocked = rows.filter((r) => r.restocked).length;
    return { amount, restocked };
  }, [rows]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "returnNo", header: "Return", accessorFn: (r) => r.ret.returnNo, cell: ({ getValue }) => <span className="font-mono text-[13px] font-medium">{getValue() as string}</span> },
      { id: "date", header: "Date", accessorFn: (r) => r.ret.date, cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatRelative(row.original.ret.date)}</span> },
      {
        id: "receipt",
        header: "Receipt",
        accessorFn: (r) => r.ret.receiptNo,
        cell: ({ row }) => (
          <Link
            href={`/sales/${row.original.ret.saleId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[13px] text-primary underline-offset-4 hover:underline"
          >
            {row.original.ret.receiptNo}
          </Link>
        ),
      },
      { id: "items", header: "Items", enableSorting: false, accessorFn: (r) => r.summary, cell: ({ getValue }) => <span className="block max-w-56 truncate">{getValue() as string}</span> },
      { id: "reason", header: "Reason", accessorFn: (r) => reasonLabel(r.ret.reason), cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge> },
      { id: "method", header: "Refund via", accessorFn: (r) => paymentMethodLabel[r.ret.refundMethod], cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
      { id: "amount", header: "Refund", meta: { align: "right" }, accessorFn: (r) => r.ret.refundAmount, cell: ({ row }) => <Money value={row.original.ret.refundAmount} className="font-medium text-destructive-foreground" /> },
      { id: "by", header: "Processed by", accessorFn: (r) => r.processedBy, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
      {
        id: "restocked",
        header: "Restocked",
        accessorFn: (r) => (r.restocked ? 1 : 0),
        cell: ({ row }) =>
          row.original.restocked ? (
            <Badge variant="success"><Check /> Yes</Badge>
          ) : (
            <Badge variant="outline"><X /> No</Badge>
          ),
      },
    ],
    [],
  );

  const exportCsv = () => {
    if (rows.length === 0) return toast.error("Nothing to export for the current filters.");
    downloadCsv(
      `returns-${new Date().toISOString().slice(0, 10)}`,
      rows.map((r) => ({
        "Return No": r.ret.returnNo,
        Date: formatDateTime(r.ret.date),
        "Receipt No": r.ret.receiptNo,
        Items: r.ret.items.map((i) => `${i.name} x ${i.quantity}`).join("; "),
        Reason: reasonLabel(r.ret.reason),
        Notes: r.ret.notes,
        "Refund method": paymentMethodLabel[r.ret.refundMethod],
        "Refund amount": (r.ret.refundAmount / 100).toFixed(2),
        "Processed by": r.processedBy,
        Restocked: r.restocked ? "yes" : "no",
      })),
    );
    toast.success(`Exported ${rows.length} returns to CSV.`);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Returns" value={rows.length.toLocaleString("en-LK")} icon={Undo2} tone="warning" hint={rangeLabel(range)} />
        <KpiCard label="Total refunded" value={formatMoney(totals.amount)} icon={RotateCcw} tone="destructive" hint="Simulated refunds" />
        <KpiCard label="Restocked returns" value={totals.restocked.toLocaleString("en-LK")} icon={PackageCheck} tone="success" hint="Items put back on the shelf" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={setSearch} placeholder="Search return, receipt or item" data-testid="returns-search" />
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} className="flex-1 sm:flex-none" />
          <Button variant="outline" onClick={exportCsv} data-testid="returns-export"><Download /> Export</Button>
        </div>
      </div>

      <DataTable
        testId="returns-table"
        columns={columns}
        data={rows}
        loading={!hydrated}
        getRowId={(r) => r.ret.id}
        onRowClick={(r) => router.push(`/sales/${r.ret.saleId}`)}
        resetKey={`${q}|${range.range.from.getTime()}|${range.range.to.getTime()}`}
        empty={
          <EmptyState
            icon={Undo2}
            title="No returns in this period"
            description="Returns are processed from a sale's transaction details page."
          />
        }
      />
    </div>
  );
}
