"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Barcode, ImageUp, Info, Sparkles, Trash2, Wand2 } from "lucide-react";
import type { Product, ProductStatus, ProductUnit } from "@/types";
import { useAppStore } from "@/store/app-store";
import { api } from "@/mocks/services";
import { useCategoryMap, useCurrentUser } from "@/hooks";
import { UNITS } from "@/config/defaults";
import { fromCents, marginBps, toCents } from "@/lib/calculations/money";
import { formatMoney, formatPercent, formatQty } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/shared/form-field";
import { ProductThumb } from "@/components/shared/product-thumb";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { MAX_IMAGE_BYTES, PRODUCT_EMOJIS, generateBarcode, suggestSku } from "./product-utils";

const UNIT_VALUES = UNITS.map((u) => u.value) as [ProductUnit, ...ProductUnit[]];
const STATUS_VALUES = ["active", "inactive", "archived"] as const satisfies readonly ProductStatus[];

const isNum = (v: string) => v.trim() !== "" && Number.isFinite(Number(v));
const moneyField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine(isNum, `${label} must be a number.`)
    .refine((v) => Number(v) >= 0, `${label} cannot be negative.`)
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Use at most 2 decimal places.");
const qtyField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine(isNum, `${label} must be a number.`)
    .refine((v) => Number(v) >= 0, `${label} cannot be negative.`);

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter a product name (at least 2 characters).").max(80, "Keep the name under 80 characters."),
    sku: z
      .string()
      .trim()
      .min(2, "SKU is required.")
      .max(24, "SKU is too long.")
      .regex(/^[A-Za-z0-9-_]+$/, "Use letters, numbers and dashes only."),
    barcode: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{8,14}$/.test(v), "Barcodes are 8–14 digits."),
    categoryId: z.string().min(1, "Choose a category."),
    brand: z.string().trim().max(60),
    description: z.string().trim().max(500, "Keep the description under 500 characters."),
    purchasePrice: moneyField("Purchase price"),
    sellingPrice: moneyField("Selling price").refine((v) => Number(v) > 0, "Selling price must be greater than zero."),
    unit: z.enum(UNIT_VALUES),
    openingStock: qtyField("Opening stock"),
    minStock: qtyField("Minimum stock"),
    image: z.string().min(1, "Choose an image."),
    status: z.enum(STATUS_VALUES),
    supplierId: z.string(),
    taxable: z.boolean(),
    trackExpiry: z.boolean(),
    shelfLifeDays: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.unit !== "kg") {
      if (isNum(v.openingStock) && !Number.isInteger(Number(v.openingStock)))
        ctx.addIssue({ code: "custom", path: ["openingStock"], message: "Whole numbers only for this unit." });
      if (isNum(v.minStock) && !Number.isInteger(Number(v.minStock)))
        ctx.addIssue({ code: "custom", path: ["minStock"], message: "Whole numbers only for this unit." });
    }
    if (v.trackExpiry) {
      const d = Number(v.shelfLifeDays);
      if (!isNum(v.shelfLifeDays) || !Number.isInteger(d) || d < 1 || d > 3650)
        ctx.addIssue({ code: "custom", path: ["shelfLifeDays"], message: "Enter shelf life in days (1–3650)." });
    }
  });

type FormValues = z.infer<typeof schema>;

const NONE = "none";

function toFormValues(p: Product | null, defaults: { categoryId: string; sku: string }): FormValues {
  if (!p)
    return {
      name: "",
      sku: defaults.sku,
      barcode: "",
      categoryId: defaults.categoryId,
      brand: "",
      description: "",
      purchasePrice: "",
      sellingPrice: "",
      unit: "pcs",
      openingStock: "0",
      minStock: "10",
      image: "📦",
      status: "active",
      supplierId: NONE,
      taxable: true,
      trackExpiry: false,
      shelfLifeDays: "30",
    };
  return {
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    categoryId: p.categoryId,
    brand: p.brand,
    description: p.description,
    purchasePrice: String(fromCents(p.purchasePrice)),
    sellingPrice: String(fromCents(p.sellingPrice)),
    unit: p.unit,
    openingStock: String(p.stock),
    minStock: String(p.minStock),
    image: p.image,
    status: p.status,
    supplierId: p.supplierId ?? NONE,
    taxable: p.taxable,
    trackExpiry: p.trackExpiry,
    shelfLifeDays: String(p.shelfLifeDays || 30),
  };
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
      {hint}
    </div>
  );
}

export function ProductFormSheet({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product: Product | null }) {
  const isEdit = !!product;
  const user = useCurrentUser();
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const suppliers = useAppStore((s) => s.suppliers);
  const categoryMap = useCategoryMap();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [skuTouchedByUser, setSkuTouchedByUser] = React.useState(false);

  const firstCategory = categories[0]?.id ?? "";
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(product, { categoryId: firstCategory, sku: suggestSku(categoryMap.get(firstCategory), products) }),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, reset, setValue, setError, formState } = form;
  const { errors } = formState;

  // Reset whenever the sheet opens for a different record.
  React.useEffect(() => {
    if (!open) return;
    const cat = product?.categoryId ?? firstCategory;
    reset(toFormValues(product, { categoryId: cat, sku: suggestSku(categoryMap.get(cat), products) }));
    setImageError(null);
    setSkuTouchedByUser(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const [sku, barcode, categoryId, purchasePrice, sellingPrice, unit, image, trackExpiry, supplierId] = useWatch({
    control,
    name: ["sku", "barcode", "categoryId", "purchasePrice", "sellingPrice", "unit", "image", "trackExpiry", "supplierId"],
  });

  const skuDup = React.useMemo(() => {
    const v = sku.trim().toLowerCase();
    return !!v && products.some((p) => p.id !== product?.id && p.sku.toLowerCase() === v);
  }, [sku, products, product?.id]);
  const barcodeDup = React.useMemo(() => {
    const v = barcode.trim();
    return !!v && products.some((p) => p.id !== product?.id && p.barcode === v);
  }, [barcode, products, product?.id]);

  const purchaseCents = isNum(purchasePrice) ? toCents(Number(purchasePrice)) : null;
  const sellingCents = isNum(sellingPrice) ? toCents(Number(sellingPrice)) : null;
  const margin = purchaseCents !== null && sellingCents !== null && sellingCents > 0 ? marginBps(sellingCents, purchaseCents) : null;
  const belowCost = purchaseCents !== null && sellingCents !== null && sellingCents > 0 && sellingCents < purchaseCents;

  const activeSuppliers = suppliers.filter((s) => s.status === "active" || s.id === product?.supplierId);
  const category = categoryMap.get(categoryId);

  const onCategoryChange = (id: string, onChange: (v: string) => void) => {
    onChange(id);
    if (!isEdit && !skuTouchedByUser) setValue("sku", suggestSku(categoryMap.get(id), products), { shouldValidate: true });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Choose an image file (PNG, JPG, WebP or GIF).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(`Image is ${Math.round(file.size / 1024)} KB — the limit is 300 KB. Try a smaller or compressed image.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageError(null);
      setValue("image", String(reader.result), { shouldDirty: true, shouldValidate: true });
    };
    reader.onerror = () => setImageError("Couldn't read that file. Try another image.");
    reader.readAsDataURL(file);
  };

  const onSubmit = async (v: FormValues) => {
    if (!user) return;
    let blocked = false;
    if (skuDup) {
      setError("sku", { message: "Another product already uses this SKU." });
      blocked = true;
    }
    if (barcodeDup) {
      setError("barcode", { message: "Another product already uses this barcode." });
      blocked = true;
    }
    if (imageError) blocked = true;
    if (blocked) return;

    const base = {
      name: v.name.trim(),
      sku: v.sku.trim().toUpperCase(),
      barcode: v.barcode.trim(),
      categoryId: v.categoryId,
      brand: v.brand.trim(),
      description: v.description.trim(),
      purchasePrice: toCents(Number(v.purchasePrice)),
      sellingPrice: toCents(Number(v.sellingPrice)),
      unit: v.unit,
      minStock: Number(v.minStock),
      image: v.image,
      status: v.status,
      supplierId: v.supplierId === NONE ? null : v.supplierId,
      taxable: v.taxable,
      trackExpiry: v.trackExpiry,
      shelfLifeDays: v.trackExpiry ? Number(v.shelfLifeDays) : product?.shelfLifeDays ?? 0,
    };
    setSubmitting(true);
    const r = product ? await api.products.update(product.id, base) : await api.products.create({ ...base, stock: Number(v.openingStock) }, user.id);
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      if (/sku/i.test(r.error)) setError("sku", { message: r.error });
      if (/barcode/i.test(r.error)) setError("barcode", { message: r.error });
      return;
    }
    toast.success(product ? `${r.data.name} updated` : `${r.data.name} added to the catalog`, {
      description: product ? undefined : r.data.status === "active" && r.data.stock > 0 ? "It's now available at the POS." : "It won't appear at the POS until it's active and in stock.",
    });
    onOpenChange(false);
  };

  const skuError = errors.sku?.message ?? (skuDup ? "Another product already uses this SKU." : undefined);
  const barcodeError = errors.barcode?.message ?? (barcodeDup ? "Another product already uses this barcode." : undefined);
  const isImg = image.startsWith("data:");
  const confirm = useConfirm();

  const requestClose = async () => {
    if (submitting) return;
    if (formState.isDirty && !(await confirm({ title: "Discard unsaved changes?", description: "The changes you made to this product will be lost.", confirmLabel: "Discard", tone: "destructive" }))) return;
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : void requestClose())}>
      <SheetContent size="lg" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit product" : "Add product"}</SheetTitle>
          <SheetDescription>{isEdit ? `Update ${product.name}. Stock changes are made with an inventory adjustment.` : "Add a new item to the catalog. Fields marked * are required."}</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <SheetBody className="space-y-7">
            {/* Image + identity */}
            <section>
              <SectionTitle>Image</SectionTitle>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <ProductThumb image={image} name="Preview" color={category?.color} size="xl" className="!size-24 rounded-2xl border" />
                  {isImg && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setValue("image", category?.icon ?? "📦", { shouldDirty: true })}>
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Product emoji">
                    {PRODUCT_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        role="radio"
                        aria-checked={image === e}
                        aria-label={`Use ${e}`}
                        onClick={() => {
                          setImageError(null);
                          setValue("image", e, { shouldDirty: true, shouldValidate: true });
                        }}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-lg border text-xl transition-all hover:border-primary/40 hover:bg-accent",
                          image === e ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "bg-card",
                        )}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="product-image-upload" />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <ImageUp /> Upload image
                    </Button>
                    <span className="text-xs text-muted-foreground">PNG/JPG up to 300 KB · stored locally</span>
                  </div>
                  {imageError && <p className="mt-1.5 text-xs text-destructive-foreground" role="alert">{imageError}</p>}
                </div>
              </div>
            </section>

            <section>
              <SectionTitle>Details</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Product name" htmlFor="pf-name" required error={errors.name?.message} className="sm:col-span-2">
                  <Input id="pf-name" placeholder="e.g. Basmati Rice 5kg" aria-invalid={!!errors.name} {...register("name")} data-testid="product-name" />
                </FormField>
                <FormField label="Category" required error={errors.categoryId?.message}>
                  <Controller
                    control={control}
                    name="categoryId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={(v) => onCategoryChange(v, field.onChange)}>
                        <SelectTrigger aria-label="Category" data-testid="product-category"><SelectValue placeholder="Choose category" /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}><span className="mr-1.5">{c.icon}</span>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label="Brand" htmlFor="pf-brand" error={errors.brand?.message}>
                  <Input id="pf-brand" placeholder="e.g. Araliya" {...register("brand")} />
                </FormField>
                <FormField label="SKU" htmlFor="pf-sku" required error={skuError} hint={!isEdit ? "Suggested from the category prefix — edit if needed." : undefined}>
                  <div className="flex gap-2">
                    <Input id="pf-sku" className="font-mono uppercase" aria-invalid={!!skuError} {...register("sku", { onChange: () => setSkuTouchedByUser(true) })} data-testid="product-sku" />
                    {!isEdit && (
                      <Button type="button" variant="outline" size="icon" aria-label="Suggest SKU" title="Suggest SKU" onClick={() => { setSkuTouchedByUser(false); setValue("sku", suggestSku(category, products), { shouldValidate: true }); }}>
                        <Wand2 />
                      </Button>
                    )}
                  </div>
                </FormField>
                <FormField label="Barcode" htmlFor="pf-barcode" error={barcodeError} hint="EAN-13. Leave blank for weighed items labelled in store.">
                  <div className="flex gap-2">
                    <Input id="pf-barcode" inputMode="numeric" className="font-mono" placeholder="479…" aria-invalid={!!barcodeError} {...register("barcode")} data-testid="product-barcode" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setValue("barcode", generateBarcode(new Set(products.map((p) => p.barcode))), { shouldValidate: true, shouldDirty: true })}
                    >
                      <Barcode /> Generate
                    </Button>
                  </div>
                </FormField>
                <FormField label="Description" htmlFor="pf-desc" error={errors.description?.message} className="sm:col-span-2">
                  <Textarea id="pf-desc" rows={2} placeholder="Short description shown to staff" {...register("description")} />
                </FormField>
              </div>
            </section>

            <section>
              <SectionTitle
                hint={
                  margin !== null && (
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium tabular", belowCost ? "bg-destructive-soft text-destructive-foreground" : margin < 1000 ? "bg-warning-soft text-warning-foreground" : "bg-success-soft text-success-foreground")} data-testid="margin-preview">
                      Margin {formatPercent(margin)}
                    </span>
                  )
                }
              >
                Pricing
              </SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Purchase price (Rs)" htmlFor="pf-cost" required error={errors.purchasePrice?.message}>
                  <Input id="pf-cost" inputMode="decimal" placeholder="0.00" className="tabular" aria-invalid={!!errors.purchasePrice} {...register("purchasePrice")} data-testid="product-cost" />
                </FormField>
                <FormField label="Selling price (Rs)" htmlFor="pf-price" required error={errors.sellingPrice?.message}>
                  <Input id="pf-price" inputMode="decimal" placeholder="0.00" className="tabular" aria-invalid={!!errors.sellingPrice} {...register("sellingPrice")} data-testid="product-price" />
                </FormField>
              </div>
              {margin !== null && purchaseCents !== null && sellingCents !== null && (
                <div className={cn("mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]", belowCost ? "border-warning/40 bg-warning-soft/60 text-warning-foreground" : "bg-muted/40 text-muted-foreground")}>
                  {belowCost ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />}
                  <span>
                    {belowCost
                      ? `Selling price is below cost — you'd lose ${formatMoney(purchaseCents - sellingCents)} per ${unit}. You can still save if this is intentional.`
                      : `Profit of ${formatMoney(sellingCents - purchaseCents)} per ${unit} (${formatPercent(margin)} margin on selling price).`}
                  </span>
                </div>
              )}
            </section>

            <section>
              <SectionTitle>Stock</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Unit" required error={errors.unit?.message}>
                  <Controller
                    control={control}
                    name="unit"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Unit"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                {isEdit ? (
                  <FormField label="Current stock" hint="Change via Inventory → Adjust stock.">
                    <div className="flex h-9 items-center rounded-lg border border-dashed bg-muted/40 px-3 text-sm tabular text-muted-foreground">{formatQty(product.stock, product.unit)}</div>
                  </FormField>
                ) : (
                  <FormField label="Opening stock" htmlFor="pf-open" required error={errors.openingStock?.message}>
                    <Input id="pf-open" inputMode="decimal" className="tabular" aria-invalid={!!errors.openingStock} {...register("openingStock")} data-testid="product-opening-stock" />
                  </FormField>
                )}
                <FormField label="Minimum stock" htmlFor="pf-min" required error={errors.minStock?.message}>
                  <Input id="pf-min" inputMode="decimal" className="tabular" aria-invalid={!!errors.minStock} {...register("minStock")} data-testid="product-min-stock" />
                </FormField>
              </div>
              <p className="mt-2.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" />
                {isEdit ? "Stock can't be edited here — use a stock adjustment so the movement ledger stays accurate." : "Opening stock is recorded as an \"opening\" stock movement. Later changes are made via inventory adjustments."}
              </p>
            </section>

            <section>
              <SectionTitle>Availability & sourcing</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Status" required>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active — sellable at POS</SelectItem>
                          <SelectItem value="inactive">Inactive — hidden from POS</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label="Supplier">
                  <Controller
                    control={control}
                    name="supplierId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Supplier"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {activeSuppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.status !== "active" ? " (inactive)" : ""}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>
              {supplierId === NONE && <p className="mt-2 text-xs text-muted-foreground">Without a supplier, low-stock alerts can&apos;t suggest a purchase order.</p>}

              <div className="mt-4 divide-y rounded-xl border">
                <Controller
                  control={control}
                  name="taxable"
                  render={({ field }) => (
                    <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                      <span>
                        <span className="block text-sm font-medium">Taxable</span>
                        <span className="block text-xs text-muted-foreground">Apply VAT to this product at checkout.</span>
                      </span>
                      <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Taxable" />
                    </label>
                  )}
                />
                <div className="px-4 py-3">
                  <Controller
                    control={control}
                    name="trackExpiry"
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-center justify-between gap-4">
                        <span>
                          <span className="block text-sm font-medium">Track expiry</span>
                          <span className="block text-xs text-muted-foreground">Record batches with expiry dates (perishables).</span>
                        </span>
                        <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Track expiry" data-testid="product-track-expiry" />
                      </label>
                    )}
                  />
                  {trackExpiry && (
                    <FormField label="Shelf life (days)" htmlFor="pf-shelf" required error={errors.shelfLifeDays?.message} hint="Used as the default expiry when receiving new stock." className="mt-3 max-w-48">
                      <Input id="pf-shelf" inputMode="numeric" className="tabular" aria-invalid={!!errors.shelfLifeDays} {...register("shelfLifeDays")} />
                    </FormField>
                  )}
                </div>
              </div>
            </section>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()} disabled={submitting}>Cancel</Button>
            <Button type="submit" loading={submitting} disabled={skuDup || barcodeDup} data-testid="product-form-submit">
              {isEdit ? "Save changes" : "Add product"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
