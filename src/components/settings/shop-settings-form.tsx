"use client";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ImagePlus, Store, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useSettings } from "@/hooks";
import { sleep } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { SettingsSection, UnsavedPill } from "./settings-section";

const MAX_LOGO_BYTES = 300 * 1024;

const schema = z.object({
  name: z.string().trim().min(2, "Shop name is required.").max(80, "Keep the name under 80 characters."),
  address: z.string().trim().min(5, "Enter the shop address.").max(200, "Keep the address under 200 characters."),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .refine((v) => /^\+?\d{9,15}$/.test(v.replace(/[\s\-()]/g, "")), "Enter a valid phone number, e.g. +94 81 222 4567."),
  email: z.string().trim().min(1, "Email is required.").pipe(z.email("Enter a valid email address.")),
  currency: z.enum(["LKR", "USD"]),
  registrationNo: z.string().trim().max(40, "Keep it under 40 characters."),
  logo: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function ShopSettingsForm() {
  const { shop } = useSettings();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const defaults = React.useMemo<FormValues>(
    () => ({ name: shop.name, address: shop.address, phone: shop.phone, email: shop.email, currency: shop.currency === "USD" ? "USD" : "LKR", registrationNo: shop.registrationNo, logo: shop.logo }),
    [shop],
  );
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults, mode: "onTouched" });
  const { register, handleSubmit, control, reset, setValue, watch, formState } = form;
  const { errors, isSubmitting, isDirty } = formState;
  const logo = watch("logo");

  // Follow external changes (e.g. demo reset) unless the user is mid-edit.
  React.useEffect(() => {
    if (!form.formState.isDirty) reset(defaults);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults]);

  const onLogo = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file (PNG, JPG, SVG or WebP).");
    if (file.size > MAX_LOGO_BYTES) return toast.error(`Logo is ${Math.round(file.size / 1024)} KB — the limit is 300 KB.`);
    const reader = new FileReader();
    reader.onload = () => setValue("logo", String(reader.result), { shouldDirty: true });
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const onSubmit = handleSubmit(async (values) => {
    await sleep(500); // simulated save
    useAppStore.getState().updateSettings({ shop: values });
    reset(values);
    toast.success("Shop settings saved");
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="Shop details"
        description="Shown on receipts, the sidebar and printed documents."
        footer={
          <>
            <UnsavedPill show={isDirty} />
            <Button type="button" variant="outline" disabled={!isDirty || isSubmitting} onClick={() => reset(defaults)}>
              Discard
            </Button>
            <Button type="submit" loading={isSubmitting} data-testid="save-shop-settings">
              Save shop settings
            </Button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Shop name" htmlFor="shop-name" required error={errors.name?.message} className="sm:col-span-2">
              <Input id="shop-name" aria-invalid={!!errors.name} data-testid="shop-name" {...register("name")} />
            </FormField>
            <FormField label="Address" htmlFor="shop-address" required error={errors.address?.message} className="sm:col-span-2">
              <Textarea id="shop-address" className="min-h-16" aria-invalid={!!errors.address} {...register("address")} />
            </FormField>
            <FormField label="Phone number" htmlFor="shop-phone" required error={errors.phone?.message}>
              <Input id="shop-phone" type="tel" inputMode="tel" aria-invalid={!!errors.phone} {...register("phone")} />
            </FormField>
            <FormField label="Email" htmlFor="shop-email" required error={errors.email?.message}>
              <Input id="shop-email" type="email" aria-invalid={!!errors.email} data-testid="shop-email" {...register("email")} />
            </FormField>
            <FormField label="Currency" error={errors.currency?.message} hint="Display currency only — amounts are stored in LKR cents.">
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger data-testid="shop-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LKR">LKR — Sri Lankan Rupee</SelectItem>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField label="Business registration no." htmlFor="shop-reg" error={errors.registrationNo?.message} hint="Optional">
              <Input id="shop-reg" {...register("registrationNo")} />
            </FormField>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Logo</p>
            <div className="flex aspect-square w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/30">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Shop logo preview" className="max-h-full max-w-full object-contain p-4" data-testid="shop-logo-preview" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                  <Store className="size-8" />
                  <span className="text-xs">No logo uploaded</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ""; }} data-testid="shop-logo-input" aria-label="Upload logo" />
            <div className="flex max-w-[220px] gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
                <ImagePlus />
                {logo ? "Replace" : "Upload"}
              </Button>
              {logo && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue("logo", "", { shouldDirty: true })} aria-label="Remove logo">
                  <Trash2 />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG or SVG up to 300 KB. Stored in this browser.</p>
          </div>
        </div>
      </SettingsSection>
    </form>
  );
}
