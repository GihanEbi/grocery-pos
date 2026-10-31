"use client";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { PaymentMethod, PosSettings, Role } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useSettings } from "@/hooks";
import { ROLE_LABEL } from "@/lib/permissions";
import { formatMoney, formatPercent } from "@/lib/formatting";
import { percentOf } from "@/lib/calculations/money";
import { sleep } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { SettingsSection, UnsavedPill } from "./settings-section";

/** Percent string with up to 2 decimals, within [0, max]. Inputs stay strings; converted to bps on submit. */
const percentString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "Enter a number with up to 2 decimals.")
    .refine((v) => Number(v) >= 0 && Number(v) <= max, `Must be between 0 and ${max}%.`);

const schema = z.object({
  receiptHeader: z.string().max(160, "Keep the header under 160 characters."),
  receiptFooter: z.string().max(300, "Keep the footer under 300 characters."),
  taxName: z.string().trim().min(1, "Tax name is required.").max(12, "Keep it short, e.g. VAT."),
  taxRate: percentString(30, "Tax rate"),
  taxMode: z.enum(["exclusive", "inclusive"]),
  defaultPaymentMethod: z.enum(["cash", "card", "qr"]),
  discountAdmin: percentString(100, "Limit"),
  discountManager: percentString(100, "Limit"),
  discountCashier: percentString(100, "Limit"),
  registerName: z.string().trim().min(1, "Register name is required.").max(30, "Keep it under 30 characters."),
  requireOpenRegister: z.boolean(),
  loyaltyPointsPer100: z
    .string()
    .trim()
    .min(1, "Required.")
    .refine((v) => /^\d{1,3}$/.test(v) && Number(v) <= 100, "Whole number between 0 and 100."),
  allowNegativeStock: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const pctStr = (bps: number) => String(Math.round(bps) / 100);
const toBps = (v: string) => Math.round(Number(v) * 100);

function toForm(pos: PosSettings): FormValues {
  return {
    receiptHeader: pos.receiptHeader,
    receiptFooter: pos.receiptFooter,
    taxName: pos.taxName,
    taxRate: pctStr(pos.taxRateBps),
    taxMode: pos.taxMode,
    defaultPaymentMethod: pos.defaultPaymentMethod,
    discountAdmin: pctStr(pos.discountLimits.admin),
    discountManager: pctStr(pos.discountLimits.manager),
    discountCashier: pctStr(pos.discountLimits.cashier),
    registerName: pos.registerName,
    requireOpenRegister: pos.requireOpenRegister,
    loyaltyPointsPer100: String(pos.loyaltyPointsPer100),
    allowNegativeStock: pos.allowNegativeStock,
  };
}

const ROLE_FIELDS: { role: Role; name: "discountAdmin" | "discountManager" | "discountCashier" }[] = [
  { role: "admin", name: "discountAdmin" },
  { role: "manager", name: "discountManager" },
  { role: "cashier", name: "discountCashier" },
];

export function PosSettingsForm() {
  const { pos, shop } = useSettings();
  const defaults = React.useMemo(() => toForm(pos), [pos]);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults, mode: "onTouched" });
  const { register, handleSubmit, control, reset, formState } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const live = useWatch({ control });

  React.useEffect(() => {
    if (!form.formState.isDirty) reset(defaults);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults]);

  const onSubmit = handleSubmit(async (v) => {
    const patch: Partial<PosSettings> = {
      receiptHeader: v.receiptHeader.trim(),
      receiptFooter: v.receiptFooter.trim(),
      taxName: v.taxName,
      taxRateBps: toBps(v.taxRate),
      taxMode: v.taxMode,
      defaultPaymentMethod: v.defaultPaymentMethod as PaymentMethod,
      discountLimits: { admin: toBps(v.discountAdmin), manager: toBps(v.discountManager), cashier: toBps(v.discountCashier) },
      registerName: v.registerName,
      requireOpenRegister: v.requireOpenRegister,
      loyaltyPointsPer100: Number(v.loyaltyPointsPer100),
      allowNegativeStock: v.allowNegativeStock,
    };
    await sleep(500); // simulated save
    useAppStore.getState().updateSettings({ pos: patch });
    reset(toForm({ ...pos, ...patch }));
    toast.success("POS settings saved");
  });

  // Live preview of a sample receipt (Rs 1,000 item).
  const rateValid = /^\d{1,2}(\.\d{1,2})?$/.test(live.taxRate ?? "") && Number(live.taxRate) <= 30;
  const previewRate = rateValid ? toBps(live.taxRate!) : pos.taxRateBps;
  const sample = 100_000;
  const tax = live.taxMode === "inclusive" ? Math.round((sample * previewRate) / (10000 + previewRate)) : percentOf(sample, previewRate);
  const total = live.taxMode === "inclusive" ? sample : sample + tax;

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="POS & receipts"
        description="Checkout behaviour, tax, discounts and the printed receipt."
        footer={
          <>
            <UnsavedPill show={isDirty} />
            <Button type="button" variant="outline" disabled={!isDirty || isSubmitting} onClick={() => reset(defaults)}>
              Discard
            </Button>
            <Button type="submit" loading={isSubmitting} data-testid="save-pos-settings">
              Save POS settings
            </Button>
          </>
        }
      >
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-8">
            <Group title="Receipt">
              <FormField label="Receipt header" htmlFor="pos-header" error={errors.receiptHeader?.message} hint="Printed under the shop details." className="sm:col-span-2">
                <Textarea id="pos-header" className="min-h-16" data-testid="pos-receipt-header" {...register("receiptHeader")} />
              </FormField>
              <FormField label="Receipt footer" htmlFor="pos-footer" error={errors.receiptFooter?.message} hint="Return policy, thank-you note, etc." className="sm:col-span-2">
                <Textarea id="pos-footer" className="min-h-20" {...register("receiptFooter")} />
              </FormField>
            </Group>

            <Group title="Tax">
              <FormField label="Tax name" htmlFor="pos-tax-name" required error={errors.taxName?.message}>
                <Input id="pos-tax-name" {...register("taxName")} />
              </FormField>
              <FormField label="Tax rate (%)" htmlFor="pos-tax-rate" required error={errors.taxRate?.message} hint="0–30%. Applied to taxable products.">
                <Input id="pos-tax-rate" inputMode="decimal" aria-invalid={!!errors.taxRate} data-testid="pos-tax-rate" {...register("taxRate")} />
              </FormField>
              <FormField label="Tax mode" hint={live.taxMode === "inclusive" ? "Prices already include tax." : "Tax is added on top of prices."}>
                <Controller
                  control={control}
                  name="taxMode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="pos-tax-mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exclusive">Exclusive (add tax at checkout)</SelectItem>
                        <SelectItem value="inclusive">Inclusive (prices include tax)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Default payment method">
                <Controller
                  control={control}
                  name="defaultPaymentMethod"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="pos-default-payment"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="qr">QR Pay</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            </Group>

            <Group title="Maximum bill discount by role" description="Cashiers cannot apply a bill discount above their limit.">
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                {ROLE_FIELDS.map((r) => (
                  <FormField key={r.role} label={ROLE_LABEL[r.role]} htmlFor={`pos-disc-${r.role}`} error={errors[r.name]?.message}>
                    <div className="relative">
                      <Input id={`pos-disc-${r.role}`} inputMode="decimal" className="pr-8" aria-invalid={!!errors[r.name]} data-testid={`pos-discount-${r.role}`} {...register(r.name)} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </FormField>
                ))}
              </div>
            </Group>

            <Group title="Register & stock">
              <FormField label="Register name" htmlFor="pos-register" required error={errors.registerName?.message}>
                <Input id="pos-register" {...register("registerName")} />
              </FormField>
              <FormField label="Loyalty points per Rs 100" htmlFor="pos-loyalty" required error={errors.loyaltyPointsPer100?.message} hint="0 disables loyalty points.">
                <Input id="pos-loyalty" inputMode="numeric" {...register("loyaltyPointsPer100")} />
              </FormField>
              <Controller
                control={control}
                name="requireOpenRegister"
                render={({ field }) => (
                  <SwitchRow id="pos-require-register" label="Require an open register" description="Cashiers must open a shift before taking payments." checked={field.value} onChange={field.onChange} />
                )}
              />
              <Controller
                control={control}
                name="allowNegativeStock"
                render={({ field }) => (
                  <SwitchRow id="pos-negative-stock" label="Allow negative stock" description="Let the POS sell items even when recorded stock is zero." checked={field.value} onChange={field.onChange} />
                )}
              />
            </Group>
          </div>

          <div className="xl:sticky xl:top-20 xl:self-start">
            <p className="mb-2 text-sm font-medium">Live receipt preview</p>
            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="mx-auto max-w-[260px] bg-white px-4 py-5 font-mono text-[11px] leading-relaxed text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)]" data-testid="receipt-preview">
                <div className="text-center">
                  <p className="text-[12px] font-bold uppercase tracking-wide">{shop.name}</p>
                  <p>{shop.address}</p>
                  <p>Tel: {shop.phone}</p>
                  {live.receiptHeader?.trim() && <p className="mt-2 whitespace-pre-line italic">{live.receiptHeader}</p>}
                </div>
                <div className="my-2 border-t border-dashed border-neutral-400" />
                <div className="flex justify-between"><span>{live.registerName || "Register"}</span><span>Sample</span></div>
                <div className="my-2 border-t border-dashed border-neutral-400" />
                <p className="font-semibold">Sample item</p>
                <div className="flex justify-between"><span>1 × 1,000.00</span><span>1,000.00</span></div>
                <div className="my-2 border-t border-dashed border-neutral-400" />
                <div className="flex justify-between">
                  <span>{live.taxName || "Tax"} {formatPercent(previewRate)}{live.taxMode === "inclusive" ? " (incl.)" : ""}</span>
                  <span>{formatMoney(tax, { symbol: false })}</span>
                </div>
                <div className="my-1.5 flex justify-between border-y border-dashed border-neutral-400 py-1.5 text-[12px] font-bold">
                  <span>TOTAL ({shop.currency})</span>
                  <span>{formatMoney(total, { symbol: false })}</span>
                </div>
                <div className="flex justify-between"><span>Paid by</span><span>{{ cash: "Cash", card: "Card", qr: "QR Pay" }[live.defaultPaymentMethod ?? "cash"]}</span></div>
                <div className="my-2 border-t border-dashed border-neutral-400" />
                <p className="whitespace-pre-line text-center text-[10px]">{live.receiptFooter}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Updates as you type. Saved settings apply to new sales and reprinted receipts.</p>
          </div>
        </div>
      </SettingsSection>
    </form>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-semibold">{title}</legend>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function SwitchRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3 sm:col-span-2">
      <div>
        <Label htmlFor={id} className="text-[13px]">{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} data-testid={id} />
    </div>
  );
}
