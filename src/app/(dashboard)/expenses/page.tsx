"use client";
import * as React from "react";
import { toast } from "sonner";
import { Calculator, CircleDollarSign, Info, Pencil, Plus, ReceiptText, ShoppingBasket, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker, rangeLabel, useRangeState } from "@/components/shared/date-range-picker";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { ChartCard } from "@/components/shared/chart";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { useCan, useDebounced, useUserMap } from "@/hooks";
import { api } from "@/mocks/services";
import { EXPENSE_CATEGORIES } from "@/config/defaults";
import { expenseTotal, inRange, summarize } from "@/lib/analytics";
import { formatDate, formatMoney, formatPercent } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { Expense, ExpenseCategory } from "@/types";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpenseCategoryBreakdown, MonthlyExpenseChart } from "@/components/expenses/expense-charts";
import { EXPENSE_CATEGORY_MAP, EXPENSE_PAYMENT_LABEL, ExpenseCategoryBadge } from "@/components/expenses/expense-meta";
import type { LucideIcon } from "lucide-react";

function FinanceCard({ label, value, icon: Icon, sub, tone = "neutral", emphasis }: { label: string; value: number; icon: LucideIcon; sub?: React.ReactNode; tone?: "neutral" | "primary" | "warning" | "success" | "destructive" | "info"; emphasis?: boolean }) {
  const tones = {
    neutral: "bg-secondary text-secondary-foreground",
    primary: "bg-primary-soft text-primary-soft-foreground",
    info: "bg-info-soft text-info-foreground",
    warning: "bg-warning-soft text-warning-foreground",
    success: "bg-success-soft text-success-foreground",
    destructive: "bg-destructive-soft text-destructive-foreground",
  };
  const negative = value < 0;
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-soft", emphasis && (negative ? "border-destructive/40" : "border-primary/30"))}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className={cn("mt-2 text-xl font-semibold tracking-tight tabular xl:text-2xl", negative && "text-destructive-foreground")} data-testid={emphasis ? "operating-profit" : undefined}>
        {formatMoney(value)}
      </p>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function ExpensesPage() {
  const expenses = useAppStore((s) => s.expenses);
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const users = useUserMap();
  const canManage = useCan("expenses.manage");
  const confirm = useConfirm();
  const [value, setValue] = useRangeState("thisMonth");
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<"all" | ExpenseCategory>("all");
  const [dialog, setDialog] = React.useState<{ open: boolean; expense: Expense | null }>({ open: false, expense: null });
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const term = useDebounced(q.trim().toLowerCase(), 150);
  const range = value.range;

  const fin = React.useMemo(() => {
    const s = summarize(sales, returns, range);
    const exp = expenseTotal(expenses, range);
    return { revenue: s.revenue, cogs: s.cogs, gross: s.grossProfit, margin: s.marginBps, expenses: exp, operating: s.grossProfit - exp, count: expenses.filter((e) => inRange(e.date, range)).length };
  }, [sales, returns, expenses, range]);

  const rows = React.useMemo(
    () =>
      expenses.filter((e) => {
        if (!inRange(e.date, range)) return false;
        if (category !== "all" && e.category !== category) return false;
        if (!term) return true;
        const who = users.get(e.createdBy)?.name ?? "";
        return e.description.toLowerCase().includes(term) || EXPENSE_CATEGORY_MAP[e.category]?.label.toLowerCase().includes(term) || who.toLowerCase().includes(term);
      }),
    [expenses, range, category, term, users],
  );
  const filteredTotal = rows.reduce((a, e) => a + e.amount, 0);

  const onDelete = React.useCallback(
    async (e: Expense) => {
      const ok = await confirm({
        title: "Delete this expense?",
        description: `"${e.description}" (${formatMoney(e.amount)}) will be removed and financial totals will update. This can't be undone.`,
        confirmLabel: "Delete expense",
        tone: "destructive",
      });
      if (!ok) return;
      setDeleting(e.id);
      const r = await api.expenses.remove(e.id);
      setDeleting(null);
      if (r.ok) toast.success("Expense deleted");
      else toast.error(r.error);
    },
    [confirm],
  );

  const columns = React.useMemo<ColumnDef<Expense, unknown>[]>(() => {
    const cols: ColumnDef<Expense, unknown>[] = [
      { id: "date", header: "Date", accessorKey: "date", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.date)}</span> },
      { id: "category", header: "Category", accessorKey: "category", cell: ({ row }) => <ExpenseCategoryBadge category={row.original.category} /> },
      { id: "description", header: "Description", accessorKey: "description", cell: ({ row }) => <span className="block min-w-44 max-w-80 truncate font-medium" title={row.original.description}>{row.original.description}</span> },
      { id: "method", header: "Payment", accessorKey: "paymentMethod", cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{EXPENSE_PAYMENT_LABEL[row.original.paymentMethod]}</span> },
      { id: "amount", header: "Amount", accessorKey: "amount", meta: { align: "right" }, cell: ({ row }) => <span className="whitespace-nowrap font-semibold tabular">{formatMoney(row.original.amount)}</span> },
      { id: "by", header: "Created by", accessorFn: (e) => users.get(e.createdBy)?.name ?? "—", cell: ({ getValue }) => <span className="whitespace-nowrap text-muted-foreground">{String(getValue())}</span> },
    ];
    if (canManage)
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${row.original.description}`} onClick={() => setDialog({ open: true, expense: row.original })} data-testid="expense-edit">
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${row.original.description}`} className="text-destructive-foreground hover:bg-destructive-soft" onClick={() => onDelete(row.original)} loading={deleting === row.original.id} data-testid="expense-delete">
              {deleting !== row.original.id && <Trash2 />}
            </Button>
          </div>
        ),
      });
    return cols;
  }, [users, canManage, onDelete, deleting]);

  const rangeText = rangeLabel(value);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Track operating costs and see how they affect profit."
        actions={
          <>
            <DateRangePicker value={value} onChange={setValue} className="min-w-0 flex-1 sm:w-48 sm:flex-none" />
            {canManage && (
              <Button onClick={() => setDialog({ open: true, expense: null })} data-testid="add-expense">
                <Plus />
                Add expense
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <section className="space-y-2.5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <FinanceCard label="Total revenue" value={fin.revenue} icon={CircleDollarSign} tone="primary" sub="Net sales excluding tax" />
            <FinanceCard label="Cost of goods sold" value={fin.cogs} icon={ShoppingBasket} tone="info" sub="Cost snapshots on sold items" />
            <FinanceCard label="Gross profit" value={fin.gross} icon={TrendingUp} tone="success" sub={`Margin ${formatPercent(fin.margin)}`} />
            <FinanceCard label="Recorded expenses" value={fin.expenses} icon={Wallet} tone="warning" sub={`${fin.count} entr${fin.count === 1 ? "y" : "ies"} · ${rangeText}`} />
            <FinanceCard
              label="Est. operating profit"
              value={fin.operating}
              icon={fin.operating < 0 ? TrendingDown : Calculator}
              tone={fin.operating < 0 ? "destructive" : "success"}
              emphasis
              sub="Gross profit − recorded expenses"
            />
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" />
            Simplified demo calculations for a quick overview — not accounting, tax or payroll figures.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-5">
          <ChartCard title="Monthly expenses" description="Last 6 months, stacked by category" className="lg:col-span-3">
            <MonthlyExpenseChart expenses={expenses} />
          </ChartCard>
          <ChartCard title="By category" description={rangeText} className="lg:col-span-2">
            <ExpenseCategoryBreakdown expenses={expenses} range={range} />
          </ChartCard>
        </div>

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Expense records</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {rows.length} shown · <span className="font-medium text-foreground tabular">{formatMoney(filteredTotal)}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                <SelectTrigger className="sm:w-44" aria-label="Filter by category" data-testid="expense-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: c.color }} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SearchInput value={q} onChange={setQ} placeholder="Search expenses…" aria-label="Search expenses" />
            </div>
          </div>
          <DataTable
            testId="expenses-table"
            columns={columns}
            data={rows}
            getRowId={(e) => e.id}
            resetKey={`${term}|${category}|${range.from.getTime()}|${range.to.getTime()}`}
            initialSorting={[{ id: "date", desc: true }]}
            empty={
              <EmptyState
                compact
                icon={ReceiptText}
                title={term || category !== "all" ? "No matching expenses" : "No expenses in this period"}
                description={term || category !== "all" ? "Try a different search or category." : "Record rent, utilities, salaries and other costs to see operating profit."}
                action={
                  canManage && !term && category === "all" ? (
                    <Button size="sm" onClick={() => setDialog({ open: true, expense: null })}>
                      <Plus />
                      Add expense
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </section>
      </div>

      <ExpenseFormDialog open={dialog.open} expense={dialog.expense} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} />
    </div>
  );
}
