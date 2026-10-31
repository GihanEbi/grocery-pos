"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { api } from "@/mocks/services";
import { useAppStore } from "@/store/app-store";
import type { Supplier } from "@/types";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the supplier name").max(80, "Keep the name under 80 characters"),
  contactPerson: z.string().trim().max(60, "Keep it under 60 characters"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(/^\+?[\d\s()-]{7,20}$/, "Enter a valid phone number"),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address"),
  address: z.string().trim().max(200, "Keep the address under 200 characters"),
  leadTimeDays: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 60, "Lead time must be a whole number between 1 and 60 days"),
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof schema>;

const toForm = (s?: Supplier | null): FormValues => ({
  name: s?.name ?? "",
  contactPerson: s?.contactPerson ?? "",
  phone: s?.phone ?? "",
  email: s?.email ?? "",
  address: s?.address ?? "",
  leadTimeDays: String(s?.leadTimeDays ?? 3),
  status: s?.status ?? "active",
});

export function SupplierFormSheet({ open, onOpenChange, supplier, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; supplier?: Supplier | null; onSaved?: (s: Supplier) => void }) {
  const confirm = useConfirm();
  const editing = !!supplier;
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(supplier) });

  React.useEffect(() => {
    if (open) reset(toForm(supplier));
  }, [open, supplier, reset]);

  async function requestClose(o: boolean) {
    if (o) return onOpenChange(true);
    if (isSubmitting) return;
    if (isDirty) {
      const ok = await confirm({ title: "Discard unsaved changes?", description: "The supplier details you entered will be lost.", confirmLabel: "Discard", cancelLabel: "Keep editing", tone: "destructive" });
      if (!ok) return;
    }
    onOpenChange(false);
  }

  const onSubmit = handleSubmit(async (v) => {
    const duplicate = useAppStore.getState().suppliers.some((x) => x.id !== supplier?.id && x.name.trim().toLowerCase() === v.name.toLowerCase());
    if (duplicate) {
      setError("name", { message: "A supplier with this name already exists" }, { shouldFocus: true });
      return;
    }
    const input = {
      name: v.name,
      contactPerson: v.contactPerson,
      phone: v.phone,
      email: v.email.toLowerCase(),
      address: v.address,
      leadTimeDays: Number(v.leadTimeDays),
      status: v.status,
    };
    const r = supplier ? await api.suppliers.update(supplier.id, input) : await api.suppliers.create(input);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(supplier ? "Supplier updated" : "Supplier added", { description: r.data.name });
    reset(toForm(r.data));
    onSaved?.(r.data);
    onOpenChange(false);
  });

  return (
    <Sheet open={open} onOpenChange={requestClose}>
      <SheetContent size="md" data-testid="supplier-form">
        <form onSubmit={onSubmit} className="flex h-full flex-col" noValidate>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit supplier" : "Add supplier"}</SheetTitle>
            <SheetDescription>{editing ? `Update ${supplier!.name}'s details.` : "Suppliers can be selected on purchase orders and linked to products."}</SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <FormField label="Supplier name" htmlFor="sup-name" required error={errors.name?.message}>
              <Input id="sup-name" {...register("name")} aria-invalid={!!errors.name} placeholder="e.g. Lanka Rice Mills (Pvt) Ltd" autoComplete="organization" data-testid="supplier-name" />
            </FormField>
            <FormField label="Contact person" htmlFor="sup-contact" error={errors.contactPerson?.message}>
              <Input id="sup-contact" {...register("contactPerson")} aria-invalid={!!errors.contactPerson} placeholder="Full name" autoComplete="name" data-testid="supplier-contact" />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Phone" htmlFor="sup-phone" required error={errors.phone?.message}>
                <Input id="sup-phone" type="tel" inputMode="tel" {...register("phone")} aria-invalid={!!errors.phone} placeholder="+94 77 123 4567" data-testid="supplier-phone" />
              </FormField>
              <FormField label="Email" htmlFor="sup-email" error={errors.email?.message}>
                <Input id="sup-email" type="email" inputMode="email" {...register("email")} aria-invalid={!!errors.email} placeholder="orders@supplier.lk" data-testid="supplier-email" />
              </FormField>
            </div>
            <FormField label="Address" htmlFor="sup-address" error={errors.address?.message}>
              <Textarea id="sup-address" rows={2} {...register("address")} aria-invalid={!!errors.address} placeholder="Street, city" data-testid="supplier-address" />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Lead time (days)" htmlFor="sup-lead" required error={errors.leadTimeDays?.message} hint="Typical days from order to delivery.">
                <Input id="sup-lead" type="number" inputMode="numeric" min={1} max={60} step={1} {...register("leadTimeDays")} aria-invalid={!!errors.leadTimeDays} className="tabular" data-testid="supplier-lead-time" />
              </FormField>
              <FormField label="Status" htmlFor="sup-status" hint="Inactive suppliers can't receive new orders.">
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="sup-status" data-testid="supplier-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => requestClose(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" loading={isSubmitting} data-testid="supplier-form-submit">{editing ? "Save changes" : "Add supplier"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
