"use client";
import * as React from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { EXPENSE_CATEGORIES } from "@/config/defaults";
import { expensesByCategory, inRange, type DateRange } from "@/lib/analytics";
import { formatMoney } from "@/lib/formatting";
import type { Expense } from "@/types";
import { ChartEmpty, GroupedBarChart, ShareBar } from "@/components/dashboard/charts";

/** Last `months` months of expenses, one stacked bar per month, segmented by category. */
export function MonthlyExpenseChart({ expenses, months = 6, height = 280 }: { expenses: Expense[]; months?: number; height?: number }) {
  const { data, series } = React.useMemo(() => {
    const now = new Date();
    const used = new Set<string>();
    const data = Array.from({ length: months }, (_, i) => {
      const d = subMonths(now, months - 1 - i);
      const byCat = expensesByCategory(expenses, { from: startOfMonth(d), to: endOfMonth(d) });
      const row: Record<string, string | number> = { label: format(d, "MMM yy") };
      for (const c of EXPENSE_CATEGORIES) {
        const v = byCat.get(c.value) ?? 0;
        row[c.value] = v;
        if (v) used.add(c.value);
      }
      return row;
    });
    const series = EXPENSE_CATEGORIES.filter((c) => used.has(c.value)).map((c) => ({ key: c.value, label: c.label, color: c.color }));
    return { data, series };
  }, [expenses, months]);

  if (!series.length) return <ChartEmpty height={height} message="No expenses recorded in the last 6 months." />;
  return <GroupedBarChart stacked data={data} xKey="label" series={series} height={height} />;
}

/** Ranked category list with share bars for a date range. */
export function ExpenseCategoryBreakdown({ expenses, range }: { expenses: Expense[]; range: DateRange }) {
  const rows = React.useMemo(() => {
    const map = expensesByCategory(expenses, range);
    const total = [...map.values()].reduce((a, v) => a + v, 0);
    return {
      total,
      list: EXPENSE_CATEGORIES.map((c) => ({ ...c, amount: map.get(c.value) ?? 0, count: expenses.filter((e) => e.category === c.value && inRange(e.date, range)).length }))
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount),
    };
  }, [expenses, range]);

  if (!rows.list.length) return <ChartEmpty height={200} message="No expenses in this period." />;
  return (
    <ul className="space-y-3.5">
      {rows.list.map((c) => {
        const pct = rows.total ? (c.amount / rows.total) * 100 : 0;
        return (
          <li key={c.value}>
            <div className="mb-1.5 flex items-center gap-2 text-[13px]">
              <span className="size-2.5 rounded-sm" style={{ background: c.color }} />
              <span className="flex-1 truncate font-medium">{c.label}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">{c.count} item{c.count === 1 ? "" : "s"}</span>
              <span className="w-28 text-right font-medium tabular">{formatMoney(c.amount)}</span>
              <span className="w-10 text-right text-xs tabular text-muted-foreground">{pct.toFixed(0)}%</span>
            </div>
            <ShareBar value={pct} color={c.color} />
          </li>
        );
      })}
    </ul>
  );
}
