"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { ArrowRight, Minus, Plus, Search, X } from "lucide-react";
import type { MovementType, Product } from "@/types";
import { useAppStore } from "@/store/app-store";
import { api } from "@/mocks/services";
import { useCan, useCategoryMap, useCurrentUser } from "@/hooks";
import { ADJUSTMENT_REASONS } from "@/config/defaults";
import { roundQty } from "@/lib/calculations/money";
import { stockStatus } from "@/lib/calculations/inventory";
import { formatQty, unitShort } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StockStatusBadge } from "@/components/shared/status-badges";
import { useConfirm } from "@/components/shared/confirm-dialog";

type ReasonValue = (typeof ADJUSTMENT_REASONS)[number]["value"];

function movementTypeFor(reason: ReasonValue): MovementType {
  if (reason === "damage") return "damage";
  if (reason === "expired") return "expired";
  return "adjustment";
}

function ProductPicker({ products, onPick }: { products: Product[]; onPick: (p: Product) => void }) {
  const categoryMap = useCategoryMap();
  const [term, setTerm] = React.useState("");
  const results = React.useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = t ? products.filter((p) => p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.barcode.includes(t) || p.brand.toLowerCase().includes(t)) : products;
    return list.slice(0, 40);
  }, [products, term]);

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="relative border-b">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name, SKU or barcode…"
          className="h-11 w-full bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/70"
          aria-label="Search products to adjust"
          data-testid="adjust-product-picker"
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) {
              e.preventDefault();
              onPick(results[0]);
            }
          }}
        />
      </div>
      <ul className="max-h-64 overflow-y-auto p-1 scrollbar-thin" role="listbox" aria-label="Products">
        {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No products match “{term}”.</li>}
        {results.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent outline-none"
              data-testid={`adjust-option-${p.sku}`}
            >
              <ProductThumb image={p.image} name={p.name} color={categoryMap.get(p.categoryId)?.color} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">{p.sku}</span>
              </span>
              <span className={cn("tabular text-xs font-medium", stockStatus(p.stock, p.minStock) === "out_of_stock" ? "text-destructive-foreground" : stockStatus(p.stock, p.minStock) === "low_stock" ? "text-warning-foreground" : "text-muted-foreground")}>
                {formatQty(p.stock, p.unit)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StockAdjustDialog({ open, onOpenChange, productId }: { open: boolean; onOpenChange: (o: boolean) => void; productId: string | null }) {
  const allProducts = useAppStore((s) => s.products);
  const categoryMap = useCategoryMap();
  const user = useCurrentUser();
  const canAdjust = useCan("inventory.adjust");
  const confirm = useConfirm();

  const products = React.useMemo(() => allProducts.filter((p) => p.status !== "archived" || p.id === productId), [allProducts, productId]);
  const [selectedId, setSelectedId] = React.useState<string | null>(productId);
  const [reason, setReason] = React.useState<ReasonValue>("count_correction");
  const [direction, setDirection] = React.useState<"in" | "out">("in");
  const [qty, setQty] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSelectedId(productId);
    setReason("count_correction");
    setDirection("in");
    setQty("");
    setNotes("");
    setTouched(false);
  }, [open, productId]);

  const product = selectedId ? allProducts.find((p) => p.id === selectedId) ?? null : null;
  const reasonDef = ADJUSTMENT_REASONS.find((r) => r.value === reason)!;
  const effectiveDir: "in" | "out" = reasonDef.direction === "both" ? direction : reasonDef.direction;

  // Default expiry when switching to a product that tracks expiry.
  React.useEffect(() => {
    if (product?.trackExpiry) setExpiry(format(addDays(new Date(), product.shelfLifeDays || 30), "yyyy-MM-dd"));
    else setExpiry("");
  }, [product?.id, product?.trackExpiry, product?.shelfLifeDays]);

  const qtyNum = Number(qty);
  let qtyError: string | null = null;
  if (qty.trim() === "") qtyError = "Enter a quantity.";
  else if (!Number.isFinite(qtyNum) || qtyNum <= 0) qtyError = "Quantity must be greater than zero.";
  else if (product && product.unit !== "kg" && !Number.isInteger(qtyNum)) qtyError = "Whole numbers only for this product.";
  else if (product && product.unit === "kg" && roundQty(qtyNum) !== qtyNum) qtyError = "Use up to 3 decimal places (grams).";

  const signed = !qtyError ? (effectiveDir === "in" ? qtyNum : -qtyNum) : 0;
  const resulting = product ? roundQty(product.stock + signed) : 0;
  const negative = !!product && !qtyError && resulting < 0;
  const needsExpiry = !!product?.trackExpiry && effectiveDir === "in";
  const expiryError = needsExpiry && !expiry ? "Choose an expiry date for the new batch." : null;
  const valid = !!product && !qtyError && !negative && !expiryError && canAdjust;

  const submit = async () => {
    setTouched(true);
    if (!valid || !product || !user) return;
    const ok = await confirm({
      title: "Confirm stock adjustment",
      description: (
        <div className="space-y-2">
          <p>
            {effectiveDir === "in" ? "Add" : "Remove"} <strong className="text-foreground">{formatQty(Math.abs(signed), product.unit)}</strong> {effectiveDir === "in" ? "to" : "from"} <strong className="text-foreground">{product.name}</strong> ({reasonDef.label.toLowerCase()}).
          </p>
          <p className="tabular">
            Stock will change from {formatQty(product.stock, product.unit)} to <strong className="text-foreground">{formatQty(resulting, product.unit)}</strong>. A stock movement will be recorded.
          </p>
        </div>
      ),
      confirmLabel: "Adjust stock",
      tone: effectiveDir === "out" ? "destructive" : "default",
    });
    if (!ok) return;
    setSubmitting(true);
    const r = await api.inventory.adjust({
      productId: product.id,
      quantity: signed,
      type: movementTypeFor(reason),
      reason: reasonDef.label,
      notes: notes.trim(),
      userId: user.id,
      expiryDate: needsExpiry && expiry ? new Date(`${expiry}T12:00:00`).toISOString() : null,
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Stock adjusted", { description: `${product.name}: ${signed > 0 ? "+" : "−"}${formatQty(Math.abs(signed), product.unit)} · now ${formatQty(r.data.balanceAfter, product.unit)}` });
    onOpenChange(false);
  };

  const showErrors = touched || qty !== "";

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent size="md" data-testid="adjust-dialog">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>Record a stock correction, damage, loss or found stock. Every adjustment creates a movement entry.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          {!canAdjust && <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-foreground">Your role can view inventory but can&apos;t adjust stock.</p>}

          <FormField label="Product" required>
            {product ? (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
                <ProductThumb image={product.image} name={product.name} color={categoryMap.get(product.categoryId)?.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" data-testid="adjust-selected-product">{product.name}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="font-mono">{product.sku}</span>
                    <span>·</span>
                    <span className="tabular">{formatQty(product.stock, product.unit)} on hand</span>
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)} disabled={submitting}>
                  <X className="size-3.5" /> Change
                </Button>
              </div>
            ) : (
              <ProductPicker products={products} onPick={(p) => setSelectedId(p.id)} />
            )}
          </FormField>

          {product && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Reason" required>
                  <Select value={reason} onValueChange={(v) => setReason(v as ReasonValue)}>
                    <SelectTrigger aria-label="Adjustment reason" data-testid="adjust-reason"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_REASONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                          <span className="ml-1.5 text-xs text-muted-foreground">{r.direction === "in" ? "(+)" : r.direction === "out" ? "(−)" : "(±)"}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Direction">
                  <div className="grid h-9 grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Add or remove stock">
                    {(["in", "out"] as const).map((d) => {
                      const disabled = reasonDef.direction !== "both" && reasonDef.direction !== d;
                      const active = effectiveDir === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={disabled}
                          onClick={() => setDirection(d)}
                          data-testid={`adjust-direction-${d}`}
                          className={cn(
                            "inline-flex items-center justify-center gap-1 rounded-md text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
                            active ? (d === "in" ? "bg-card text-success-foreground shadow-sm" : "bg-card text-destructive-foreground shadow-sm") : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {d === "in" ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                          {d === "in" ? "Add" : "Remove"}
                        </button>
                      );
                    })}
                  </div>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={`Quantity (${unitShort(product.unit)})`} htmlFor="adj-qty" required error={showErrors ? qtyError ?? undefined : undefined} hint={product.unit === "kg" ? "Up to 3 decimals, e.g. 1.25" : "Whole units"}>
                  <Input
                    id="adj-qty"
                    inputMode={product.unit === "kg" ? "decimal" : "numeric"}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="0"
                    className="tabular"
                    aria-invalid={showErrors && !!qtyError}
                    data-testid="adjust-qty"
                    autoFocus
                  />
                </FormField>
                {needsExpiry && (
                  <FormField label="Batch expiry date" htmlFor="adj-exp" required error={expiryError ?? undefined} hint="Stock is added as a batch.">
                    <Input id="adj-exp" type="date" value={expiry} min={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setExpiry(e.target.value)} data-testid="adjust-expiry" />
                  </FormField>
                )}
              </div>

              <div className={cn("flex items-center justify-between gap-3 rounded-xl border px-4 py-3", negative ? "border-destructive/40 bg-destructive-soft/50" : "bg-muted/30")} data-testid="adjust-preview">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current</p>
                  <p className="text-lg font-semibold tabular">{formatQty(product.stock, product.unit)}</p>
                </div>
                <div className="flex flex-col items-center text-xs font-medium tabular">
                  <span className={cn(signed > 0 ? "text-success-foreground" : signed < 0 ? "text-destructive-foreground" : "text-muted-foreground")}>
                    {signed > 0 ? "+" : signed < 0 ? "−" : ""}{formatQty(Math.abs(signed), product.unit)}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Resulting</p>
                  <p className={cn("text-lg font-semibold tabular", negative && "text-destructive-foreground")} data-testid="adjust-resulting">{formatQty(resulting, product.unit)}</p>
                </div>
                <div className="hidden sm:block">
                  {!negative && <StockStatusBadge status={stockStatus(resulting, product.minStock)} />}
                </div>
              </div>
              {negative && <p className="-mt-3 text-xs text-destructive-foreground" role="alert">You can&apos;t remove more than the {formatQty(product.stock, product.unit)} in stock.</p>}

              <FormField label="Notes" htmlFor="adj-notes" hint="Optional — e.g. shelf count by Kasun, bag torn in storage.">
                <Textarea id="adj-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} data-testid="adjust-notes" />
              </FormField>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} loading={submitting} disabled={!product || !canAdjust || (showErrors && !valid)} data-testid="adjust-submit">
            Review & adjust
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
