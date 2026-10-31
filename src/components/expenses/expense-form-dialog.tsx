"use client";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { EXPENSE_CATEGORIES } from "@/config/defaults";
import { api } from "@/mocks/services";
import { useCurrentUser } from "@/hooks";
import { fromCents, toCents } from "@/lib/calculations/money";
import type { Expense, ExpenseCategory } from "@/types";
import { EXPENSE_PAYMENT_LABEL } from "./expense-meta";

const CATEGORY_VALUES = EXPENSE_CATEGORIES.map((c) => c.value) as [ExpenseCategory, ...ExpenseCategory[]];
const todayStr = () => format(new Date(), "yyyy-MM-dd");

const schema = z.object({
  category: z.enum(CATEGORY_VALUES, { message: "Choose a category" }),
  description: z.string().trim().min(1, "Description is required").max(120, "Keep it under 120 characters"),
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount (up to 2 decimals)")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero")
    .refine((v) => Number(v) <= 100_000_000, "Amount looks too large"),
  date: z
    .string()
    .min(1, "Date is required")
    .refine((v) => v <= todayStr(), "Date can't be in the future"),
  paymentMethod: z.enum(["cash", "bank", "card"]),
});

type FormValues = z.infer<typeof schema>;

/** ISO timestamp for the chosen day: keep the original time when editing the same day, "now" for today, else midday. */
function toIsoDate(day: string, original?: string) {
  if (original && format(new Date(original), "yyyy-MM-dd") === day) return original;
  if (day === todayStr()) return new Date().toISOString();
  return new Date(`${day}T12:00:00`).toISOString();
}

export function ExpenseFormDialog({ open, onOpenChange, expense }: { open: boolean; onOpenChange: (o: boolean) => void; expense: Expense | null }) {
  const user = useCurrentUser();
  const editing = !!expense;
  const defaults = React.useMemo<FormValues>(
    () =>
      expense
        ? { category: expense.category, description: expense.description, amount: String(fromCents(expense.amount)), date: format(new Date(expense.date), "yyyy-MM-dd"), paymentMethod: expense.paymentMethod }
        : { category: "other", description: "", amount: "", date: todayStr(), paymentMethod: "cash" },
    [expense],
  );
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults, mode: "onTouched" });
  const { register, handleSubmit, control, reset, formState } = form;
  const { errors, isSubmitting } = formState;

  React.useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const onSubmit = async (v: FormValues) => {
    if (!user) return;
    const payload = {
      category: v.category,
      description: v.description.trim(),
      amount: toCents(Number(v.amount)),
      date: toIsoDate(v.date, expense?.date),
      paymentMethod: v.paymentMethod,
    };
    const r = expense ? await api.expenses.update(expense.id, payload) : await api.expenses.create({ ...payload, createdBy: user.id });
    if (r.ok) {
      toast.success(editing ? "Expense updated" : "Expense added", { description: `${payload.description}` });
      onOpenChange(false);
    } else {
      toast.error(r.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription>{editing ? "Update the details of this expense." : "Record a business expense such as rent, utilities or transport."}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" htmlFor="exp-category" error={errors.category?.message} required>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="exp-category" aria-invalid={!!errors.category} data-testid="expense-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
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
                )}
              />
            </FormField>
            <FormField label="Payment method" htmlFor="exp-method" error={errors.paymentMethod?.message} required>
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="exp-method" data-testid="expense-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["cash", "bank", "card"] as const).map((m) => (
                        <SelectItem key={m} value={m}>
                          {EXPENSE_PAYMENT_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Description" htmlFor="exp-description" error={errors.description?.message} required className="sm:col-span-2">
              <Input id="exp-description" placeholder="e.g. October electricity bill" autoComplete="off" aria-invalid={!!errors.description} data-testid="expense-description" {...register("description")} />
            </FormField>
            <FormField label="Amount (Rs)" htmlFor="exp-amount" error={errors.amount?.message} required>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs</span>
                <Input id="exp-amount" inputMode="decimal" placeholder="0.00" className="pl-9 tabular" aria-invalid={!!errors.amount} data-testid="expense-amount" {...register("amount")} />
              </div>
            </FormField>
            <FormField label="Date" htmlFor="exp-date" error={errors.date?.message} required>
              <Input id="exp-date" type="date" max={todayStr()} aria-invalid={!!errors.date} data-testid="expense-date" {...register("date")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} data-testid="expense-form-submit">
              {editing ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
