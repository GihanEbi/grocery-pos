"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { Customer } from "@/types";
import { api } from "@/mocks/services";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";

const PHONE_HINT = "e.g. +94 77 123 4567 or 0771234567";

/** Accepts local (0771234567) and international (+94 77 123 4567) numbers; spaces, dashes and brackets are ignored. */
export function isValidPhone(raw: string): boolean {
  const v = raw.replace(/[\s\-()]/g, "");
  return /^(\+94\d{9}|0\d{9}|\+?\d{9,15})$/.test(v);
}

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80, "Keep the name under 80 characters."),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .refine(isValidPhone, `Enter a valid phone number (${PHONE_HINT}).`),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address."),
  address: z.string().trim().max(200, "Keep the address under 200 characters."),
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { name: "", phone: "", email: "", address: "", status: "active" };

export function CustomerFormSheet({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Existing customer to edit; null to create. */
  customer: Customer | null;
  onSaved?: (c: Customer) => void;
}) {
  const editing = !!customer;
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: "onTouched" });
  const { register, handleSubmit, control, reset, setError, formState } = form;
  const { errors, isSubmitting } = formState;

  useEffect(() => {
    if (!open) return;
    reset(
      customer
        ? { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, status: customer.status }
        : EMPTY,
    );
  }, [open, customer, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const input = { ...values, phone: values.phone.trim() };
    const r = customer ? await api.customers.update(customer.id, input) : await api.customers.create(input);
    if (!r.ok) {
      if (/phone/i.test(r.error)) setError("phone", { message: r.error }, { shouldFocus: true });
      toast.error(r.error);
      return;
    }
    toast.success(editing ? `${r.data.name} updated` : `${r.data.name} added to customers`);
    onSaved?.(r.data);
    onOpenChange(false);
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !isSubmitting && onOpenChange(v)}>
      <SheetContent size="md" data-testid="customer-form">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit customer" : "Add customer"}</SheetTitle>
          <SheetDescription>
            {editing ? `Update details for ${customer?.name}.` : "Create a customer profile to track purchases and loyalty points."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetBody className="space-y-4">
            <FormField label="Full name" htmlFor="cus-name" required error={errors.name?.message}>
              <Input id="cus-name" autoComplete="off" placeholder="e.g. Nimali Perera" aria-invalid={!!errors.name} data-testid="customer-name" {...register("name")} />
            </FormField>
            <FormField label="Phone number" htmlFor="cus-phone" required error={errors.phone?.message} hint={PHONE_HINT}>
              <Input id="cus-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="+94 77 123 4567" aria-invalid={!!errors.phone} data-testid="customer-phone" {...register("phone")} />
            </FormField>
            <FormField label="Email" htmlFor="cus-email" error={errors.email?.message} hint="Optional">
              <Input id="cus-email" type="email" autoComplete="off" placeholder="name@example.com" aria-invalid={!!errors.email} data-testid="customer-email" {...register("email")} />
            </FormField>
            <FormField label="Address" htmlFor="cus-address" error={errors.address?.message} hint="Optional">
              <Textarea id="cus-address" placeholder="Street, city" className="min-h-16" data-testid="customer-address" {...register("address")} />
            </FormField>
            <FormField label="Status" error={errors.status?.message} hint="Inactive profiles keep their purchase history.">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="customer-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {editing && customer && (
              <div className="rounded-xl border bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground">
                Customer ID <span className="font-mono text-foreground">{customer.id}</span> · {customer.loyaltyPoints.toLocaleString("en-LK")} loyalty points
              </div>
            )}
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" loading={isSubmitting} data-testid="customer-form-submit">
              {editing ? "Save changes" : "Add customer"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
