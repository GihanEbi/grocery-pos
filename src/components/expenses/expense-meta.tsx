import { EXPENSE_CATEGORIES } from "@/config/defaults";
import type { Expense, ExpenseCategory } from "@/types";
import { cn } from "@/lib/utils";

export const EXPENSE_CATEGORY_MAP = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c])) as Record<ExpenseCategory, (typeof EXPENSE_CATEGORIES)[number]>;

export const EXPENSE_PAYMENT_LABEL: Record<Expense["paymentMethod"], string> = {
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
};

/** Category chip with its colored dot. */
export function ExpenseCategoryBadge({ category, className }: { category: ExpenseCategory; className?: string }) {
  const c = EXPENSE_CATEGORY_MAP[category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium text-foreground/85", className)}>
      <span className="size-2 rounded-full" style={{ background: c?.color }} />
      {c?.label ?? category}
    </span>
  );
}
