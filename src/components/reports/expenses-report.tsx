"use client";
import * as React from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ChartCard } from "@/components/shared/chart";
import type { ColumnDef } from "@/components/shared/data-table";
import { useAppStore } from "@/store/app-store";
import { useUserMap } from "@/hooks";
import { EXPENSE_CATEGORIES } from "@/config/defaults";
import { expensesByCategory, expenseTotal, inRange, summarize } from "@/lib/analytics";
import { fromCents } from "@/lib/calculations/money";
import { formatDate, formatMoney, formatNumber } from "@/lib/formatting";
import type { Expense } from "@/types";
import { ChartEmpty, DonutChart } from "@/components/dashboard/charts";
import { MonthlyExpenseChart } from "@/components/expenses/expense-charts";
import { EXPENSE_CATEGORY_MAP, EXPENSE_PAYMENT_LABEL, ExpenseCategoryBadge } from "@/components/expenses/expense-meta";
import { ChartGrid, KpiRow, ReportTable, Stat, useReport, useReportExport, useTableSearch } from "./report-kit";

interface Row {
  expense: Expense;
  createdBy: string;
}

export function ExpensesReport() {
  const { range, rangeText } = useReport();
  const expenses = useAppStore((s) => s.expenses);
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const users = useUserMap();

  const total = React.useMemo(() => expenseTotal(expenses, range), [expenses, range]);
  const gross = React.useMemo(() => summarize(sales, returns, range).grossProfit, [sales, returns, range]);
  const byCat = React.useMemo(() => {
    const m = expensesByCategory(expenses, range);
    return EXPENSE_CATEGORIES.map((c) => ({ name: c.label, value: m.get(c.value) ?? 0, color: c.color })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
  }, [expenses, range]);
  const rows = React.useMemo<Row[]>(
    () => expenses.filter((e) => inRange(e.date, range)).map((e) => ({ expense: e, createdBy: users.get(e.createdBy)?.name ?? "—" })),
    [expenses, range, users],
  );
  const days = Math.max(1, Math.min(differenceInCalendarDays(range.to > new Date() ? new Date() : range.to, range.from) + 1, 3650));

  const search = useTableSearch(rows, (r) => [r.expense.description, EXPENSE_CATEGORY_MAP[r.expense.category]?.label, r.createdBy]);
  const csv = React.useMemo(
    () =>
      search.filtered.map((r) => ({
        Date: format(new Date(r.expense.date), "yyyy-MM-dd"),
        Category: EXPENSE_CATEGORY_MAP[r.expense.category]?.label ?? r.expense.category,
        Description: r.expense.description,
        "Payment method": EXPENSE_PAYMENT_LABEL[r.expense.paymentMethod],
        "Amount (Rs)": fromCents(r.expense.amount),
        "Created by": r.createdBy,
      })),
    [search.filtered],
  );
  useReportExport("expense-report", csv);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "date", header: "Date", accessorFn: (r) => r.expense.date, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.expense.date)}</span> },
      { id: "category", header: "Category", accessorFn: (r) => r.expense.category, cell: ({ row }) => <ExpenseCategoryBadge category={row.original.expense.category} /> },
      { id: "description", header: "Description", accessorFn: (r) => r.expense.description, cell: ({ row }) => <span className="block min-w-44">{row.original.expense.description}</span> },
      { id: "method", header: "Paid by", accessorFn: (r) => r.expense.paymentMethod, cell: ({ row }) => <span className="text-muted-foreground">{EXPENSE_PAYMENT_LABEL[row.original.expense.paymentMethod]}</span> },
      { id: "amount", header: "Amount", accessorFn: (r) => r.expense.amount, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium tabular whitespace-nowrap">{formatMoney(row.original.expense.amount)}</span> },
      { id: "by", header: "Created by", accessorKey: "createdBy", cell: ({ row }) => <span className="text-muted-foreground">{row.original.createdBy}</span> },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <KpiRow>
        <Stat label="Recorded expenses" value={formatMoney(total)} sub={`${formatNumber(rows.length)} entries · ${rangeText}`} />
        <Stat label="Largest category" value={byCat[0]?.name ?? "—"} sub={byCat[0] ? formatMoney(byCat[0].value) : "No expenses"} />
        <Stat label="Average per day" value={formatMoney(Math.round(total / days))} sub={`Over ${days} day${days === 1 ? "" : "s"}`} />
        <Stat label="Est. operating profit" value={formatMoney(gross - total)} tone={gross - total < 0 ? "negative" : "positive"} sub="Gross profit − expenses (simplified)" />
      </KpiRow>
      <ChartGrid className="lg:grid-cols-3">
        <ChartCard title="Expenses by category" description={rangeText}>
          {byCat.length ? <DonutChart data={byCat} size={160} className="sm:flex-col lg:flex-col" legendLimit={7} /> : <ChartEmpty />}
        </ChartCard>
        <ChartCard title="Monthly expenses" description="Last 6 months, stacked by category" className="lg:col-span-2">
          <MonthlyExpenseChart expenses={expenses} height={260} />
        </ChartCard>
      </ChartGrid>
      <ReportTable
        title="Expense entries"
        description={`${formatNumber(search.filtered.length)} entries`}
        columns={columns}
        rows={search.filtered}
        search={search}
        searchPlaceholder="Description, category or user…"
        getRowId={(r) => r.expense.id}
        initialSorting={[{ id: "date", desc: true }]}
      />
    </div>
  );
}
