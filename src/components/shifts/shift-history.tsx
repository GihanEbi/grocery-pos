"use client";

import { useMemo, useState } from "react";
import { Download, History } from "lucide-react";
import { toast } from "sonner";
import type { Sale, SaleReturn, Shift } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCan, useCurrentUser, useUserMap } from "@/hooks";
import { summarizeShift, type ShiftSummary } from "@/lib/calculations/register";
import { formatDateTime, formatRelative, formatTime } from "@/lib/formatting";
import { downloadCsv } from "@/lib/utils";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DifferenceBadge } from "./shift-utils";

interface Row {
  shift: Shift;
  cashier: string;
  summary: ShiftSummary;
}

export function ShiftHistory({ onSelect }: { onSelect: (shift: Shift) => void }) {
  const shifts = useAppStore((s) => s.shifts);
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const hydrated = useAppStore((s) => s.hydrated);
  const users = useAppStore((s) => s.users);
  const user = useCurrentUser();
  const viewAll = useCan("shifts.viewAll");
  const userMap = useUserMap();
  const [cashier, setCashier] = useState("all");

  const rows = useMemo<Row[]>(() => {
    const salesBy = new Map<string, Sale[]>();
    for (const s of sales) if (s.shiftId) (salesBy.get(s.shiftId) ?? salesBy.set(s.shiftId, []).get(s.shiftId)!).push(s);
    const returnsBy = new Map<string, SaleReturn[]>();
    for (const r of returns) if (r.shiftId) (returnsBy.get(r.shiftId) ?? returnsBy.set(r.shiftId, []).get(r.shiftId)!).push(r);
    return shifts
      .filter((s) => (viewAll ? true : s.cashierId === user?.id))
      .filter((s) => (viewAll && cashier !== "all" ? s.cashierId === cashier : true))
      .map((s) => ({
        shift: s,
        cashier: userMap.get(s.cashierId)?.name ?? "—",
        summary: summarizeShift(s, salesBy.get(s.id) ?? [], returnsBy.get(s.id) ?? []),
      }))
      .sort((a, b) => b.shift.openedAt.localeCompare(a.shift.openedAt));
  }, [shifts, sales, returns, viewAll, user?.id, cashier, userMap]);

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "cashier", header: "Cashier", accessorFn: (r) => r.cashier, cell: ({ getValue }) => <span className="whitespace-nowrap font-medium">{getValue() as string}</span> },
      { id: "register", header: "Register", accessorFn: (r) => r.shift.register, cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{getValue() as string}</span> },
      { id: "opened", header: "Opened", accessorFn: (r) => r.shift.openedAt, cell: ({ row }) => <span className="whitespace-nowrap">{formatRelative(row.original.shift.openedAt)}</span> },
      {
        id: "closed",
        header: "Closed",
        accessorFn: (r) => r.shift.closedAt ?? "9999",
        cell: ({ row }) =>
          row.original.shift.closedAt ? (
            <span className="whitespace-nowrap text-muted-foreground">{formatTime(row.original.shift.closedAt)}</span>
          ) : (
            <Badge variant="success" dot>Open</Badge>
          ),
      },
      { id: "tx", header: "Transactions", meta: { align: "right" }, accessorFn: (r) => r.summary.transactions, cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span> },
      { id: "total", header: "Total sales", meta: { align: "right" }, accessorFn: (r) => r.summary.totalSales, cell: ({ getValue }) => <Money value={getValue() as number} className="font-medium" /> },
      { id: "expected", header: "Expected", meta: { align: "right" }, accessorFn: (r) => r.summary.expectedCash, cell: ({ getValue }) => <Money value={getValue() as number} /> },
      {
        id: "counted",
        header: "Counted",
        meta: { align: "right" },
        accessorFn: (r) => r.summary.countedCash ?? -1,
        cell: ({ row }) => (row.original.summary.countedCash === null ? <span className="text-muted-foreground">—</span> : <Money value={row.original.summary.countedCash} />),
      },
      {
        id: "difference",
        header: "Difference",
        meta: { align: "right" },
        accessorFn: (r) => r.summary.difference ?? 0,
        cell: ({ row }) => (row.original.summary.difference === null ? <span className="text-muted-foreground">—</span> : <DifferenceBadge value={row.original.summary.difference} />),
      },
    ],
    [],
  );

  const exportCsv = () => {
    if (rows.length === 0) return toast.error("Nothing to export.");
    downloadCsv(
      `shifts-${new Date().toISOString().slice(0, 10)}`,
      rows.map((r) => ({
        Cashier: r.cashier,
        Register: r.shift.register,
        Opened: formatDateTime(r.shift.openedAt),
        Closed: r.shift.closedAt ? formatDateTime(r.shift.closedAt) : "open",
        Transactions: r.summary.transactions,
        "Total sales": (r.summary.totalSales / 100).toFixed(2),
        "Opening cash": (r.summary.openingCash / 100).toFixed(2),
        "Cash sales": (r.summary.cashSales / 100).toFixed(2),
        "Cash refunds": (r.summary.cashRefunds / 100).toFixed(2),
        "Pay-ins": (r.summary.payIns / 100).toFixed(2),
        "Pay-outs": (r.summary.payOuts / 100).toFixed(2),
        Expected: (r.summary.expectedCash / 100).toFixed(2),
        Counted: r.summary.countedCash === null ? "" : (r.summary.countedCash / 100).toFixed(2),
        Difference: r.summary.difference === null ? "" : (r.summary.difference / 100).toFixed(2),
      })),
    );
    toast.success(`Exported ${rows.length} shifts to CSV.`);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Shift history</h2>
          <p className="text-[13px] text-muted-foreground">{viewAll ? "All registers and cashiers." : "Your previous register sessions."} Select a shift to see its summary.</p>
        </div>
        <div className="flex items-center gap-2">
          {viewAll && (
            <Select value={cashier} onValueChange={setCashier}>
              <SelectTrigger className="flex-1 sm:w-44" aria-label="Filter by cashier"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cashiers</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={exportCsv}><Download /> Export</Button>
        </div>
      </div>
      <DataTable
        testId="shift-history"
        columns={columns}
        data={rows}
        loading={!hydrated}
        getRowId={(r) => r.shift.id}
        onRowClick={(r) => onSelect(r.shift)}
        resetKey={cashier}
        empty={<EmptyState icon={History} title="No shifts yet" description="Open the register to start your first shift." />}
      />
    </section>
  );
}
