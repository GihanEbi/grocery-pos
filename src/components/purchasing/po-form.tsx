"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, PackageSearch, Save, Sparkles, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useCan, useCategoryMap, useCurrentUser, useProductMap, useSupplierMap } from "@/hooks";
import { useAppStore } from "@/store/app-store";
import { api } from "@/mocks/services";
import { multiply, roundQty, sum, toCents } from "@/lib/calculations/money";
import { stockStatus } from "@/lib/calculations/inventory";
import { formatQty } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { ProductPicker } from "./product-picker";
import { dateInputFromToday, dateInputToIso, parseQty, qtyError } from "./po-utils";

export interface POFormLine {
  productId: string;
  qty: string;
  cost: string;
}

export interface POFormValues {
  supplierId: string;
  expectedDate: string;
  notes: string;
  lines: POFormLine[];
}

function costError(raw: string): string | null {
  if (raw.trim() === "") return "Enter a cost";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "Invalid amount";
  if (n < 0) return "Can't be negative";
  if (Math.round(n * 100) / 100 !== n) return "Max 2 decimals";
  return null;
}

export function PurchaseOrderForm({ initial, editId, source }: { initial: POFormValues; editId?: string; source: "manual" | "ai" }) {
  const router = useRouter();
  const confirm = useConfirm();
  const user = useCurrentUser();
  const canApprove = useCan("purchasing.approve");
  const suppliers = useAppStore((s) => s.suppliers);
  const supplierMap = useSupplierMap();
  const productMap = useProductMap();
  const categoryMap = useCategoryMap();

  const [values, setValues] = React.useState<POFormValues>(initial);
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(initial));
  const [dateTouched, setDateTouched] = React.useState(!!editId || !!initial.expectedDate);
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState<null | "draft" | "approve">(null);

  const dirty = JSON.stringify(values) !== baseline;
  const supplier = supplierMap.get(values.supplierId);
  const activeSuppliers = React.useMemo(() => suppliers.filter((s) => s.status === "active" || s.id === values.supplierId).sort((a, b) => a.name.localeCompare(b.name)), [suppliers, values.supplierId]);

  const lineInfo = values.lines.map((l) => {
    const product = productMap.get(l.productId);
    const qty = parseQty(l.qty) ?? 0;
    const costRs = Number(l.cost);
    const cost = Number.isFinite(costRs) && costRs >= 0 ? toCents(costRs) : 0;
    return {
      line: l,
      product,
      qty,
      cost,
      total: multiply(cost, Math.max(0, qty)),
      qtyErr: product ? qtyError(l.qty, product.unit) : null,
      costErr: costError(l.cost),
      otherSupplier: product && product.supplierId && values.supplierId && product.supplierId !== values.supplierId ? supplierMap.get(product.supplierId) : undefined,
    };
  });

  const errors = {
    supplier: !values.supplierId ? "Select a supplier" : supplier && supplier.status !== "active" ? "This supplier is inactive" : null,
    lines: values.lines.length === 0 ? "Add at least one product to the order" : null,
    expectedDate: values.expectedDate && dateInputToIso(values.expectedDate) === null ? "Invalid date" : null,
  };
  const hasLineErrors = lineInfo.some((l) => l.qtyErr || l.costErr || !l.product);
  const valid = !errors.supplier && !errors.lines && !errors.expectedDate && !hasLineErrors;

  const totalCost = sum(lineInfo.map((l) => l.total));
  const totalUnits = roundQty(lineInfo.reduce((a, l) => a + Math.max(0, l.qty), 0));
  const mismatched = lineInfo.filter((l) => l.otherSupplier).length;

  const excludeIds = React.useMemo(() => new Set(values.lines.map((l) => l.productId)), [values.lines]);

  function setSupplier(id: string) {
    const s = supplierMap.get(id);
    setValues((v) => ({ ...v, supplierId: id, expectedDate: !dateTouched && s ? dateInputFromToday(s.leadTimeDays) : v.expectedDate }));
  }

  function addProduct(p: Product) {
    setValues((v) => {
      if (v.lines.some((l) => l.productId === p.id)) return v;
      const suggested = Math.max(1, Math.ceil(Math.max(0, p.minStock * 2 - p.stock)));
      return { ...v, lines: [...v.lines, { productId: p.id, qty: String(suggested), cost: (p.purchasePrice / 100).toFixed(2) }] };
    });
  }

  function updateLine(productId: string, patch: Partial<POFormLine>) {
    setValues((v) => ({ ...v, lines: v.lines.map((l) => (l.productId === productId ? { ...l, ...patch } : l)) }));
  }
  function removeLine(productId: string) {
    setValues((v) => ({ ...v, lines: v.lines.filter((l) => l.productId !== productId) }));
  }

  async function leave() {
    if (dirty && !saving) {
      const ok = await confirm({
        title: "Discard unsaved changes?",
        description: "You have changes to this purchase order that haven't been saved.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        tone: "destructive",
      });
      if (!ok) return;
    }
    router.push(editId ? `/purchasing?po=${editId}` : "/purchasing");
  }

  async function save(approve: boolean) {
    setSubmitted(true);
    if (!user) return;
    if (!valid) {
      toast.error(errors.supplier ?? errors.lines ?? "Check the highlighted fields.");
      return;
    }
    if (approve) {
      const ok = await confirm({
        title: "Save and approve this order?",
        description: <>The order of <strong>{values.lines.length} item{values.lines.length === 1 ? "" : "s"}</strong> worth <Money value={totalCost} className="font-semibold" /> to {supplier?.name} will be approved and ready to receive. Approved orders can no longer be edited.</>,
        confirmLabel: "Save & approve",
      });
      if (!ok) return;
    }
    setSaving(approve ? "approve" : "draft");
    const items = lineInfo.map((l) => ({ productId: l.line.productId, quantity: roundQty(l.qty), unitCost: l.cost }));
    const payload = { supplierId: values.supplierId, items, notes: values.notes.trim(), expectedDate: dateInputToIso(values.expectedDate) };

    let id: string | null = null;
    let poNumber = "";
    if (editId) {
      const r = await api.purchasing.update(editId, payload);
      if (!r.ok) {
        setSaving(null);
        toast.error(r.error);
        return;
      }
      id = r.data.id;
      poNumber = r.data.poNumber;
      if (approve) {
        const a = await api.purchasing.approve(editId, user.id);
        if (!a.ok) {
          setSaving(null);
          setBaseline(JSON.stringify(values));
          toast.error(`Changes saved, but approval failed: ${a.error}`);
          return;
        }
      }
    } else {
      const r = await api.purchasing.create({ ...payload, source, userId: user.id, approve });
      if (!r.ok) {
        setSaving(null);
        toast.error(r.error);
        return;
      }
      id = r.data.id;
      poNumber = r.data.poNumber;
    }
    setBaseline(JSON.stringify(values));
    toast.success(approve ? `${poNumber} saved & approved` : editId ? `${poNumber} updated` : `${poNumber} saved as draft`, {
      description: approve ? "Receive the stock when the delivery arrives." : "Nothing is ordered until the draft is approved.",
    });
    router.push(`/purchasing?po=${id}`);
  }

  const showErr = (e: string | null) => (submitted ? e ?? undefined : undefined);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="min-w-0 space-y-6">
        {source === "ai" && (
          <div className="flex gap-3 rounded-xl border border-info/30 bg-info-soft p-4 text-info-foreground" role="note" data-testid="po-ai-banner">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card/70 shadow-soft"><Sparkles className="size-4" /></span>
            <div>
              <p className="text-sm font-semibold">AI reorder suggestion</p>
              <p className="mt-0.5 text-[13px] opacity-90">Suggested by the AI assistant — review quantities and costs, then save. Nothing is ordered until you confirm.</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
            <CardDescription>Who you&apos;re ordering from and when you expect the delivery.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Supplier" htmlFor="po-supplier" required error={showErr(errors.supplier)} hint={supplier ? `${supplier.contactPerson || "No contact"} · ${supplier.phone} · ${supplier.leadTimeDays}-day lead time` : undefined}>
              <Select value={values.supplierId || undefined} onValueChange={setSupplier} disabled={!!saving}>
                <SelectTrigger id="po-supplier" aria-invalid={submitted && !!errors.supplier} data-testid="po-supplier-select">
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {activeSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={s.status !== "active"}>{s.name}{s.status !== "active" ? " (inactive)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Expected delivery" htmlFor="po-expected" error={showErr(errors.expectedDate)} hint={supplier && !dateTouched ? "Based on the supplier's lead time" : undefined}>
              <Input
                id="po-expected"
                type="date"
                value={values.expectedDate}
                onChange={(e) => {
                  setDateTouched(true);
                  setValues((v) => ({ ...v, expectedDate: e.target.value }));
                }}
                disabled={!!saving}
                data-testid="po-expected-date"
              />
            </FormField>
            <FormField label="Notes" htmlFor="po-notes" className="sm:col-span-2" hint="Visible on the order, e.g. delivery instructions.">
              <Textarea id="po-notes" rows={2} value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} placeholder="Optional" maxLength={500} disabled={!!saving} data-testid="po-notes" />
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription className="mt-1">{supplier ? `${supplier.name}'s products are listed first.` : "Select a supplier to see their products first."}</CardDescription>
            </div>
            <ProductPicker supplierId={values.supplierId} supplierName={supplier?.name} excludeIds={excludeIds} onSelect={addProduct} disabled={!!saving} />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {values.lines.length === 0 ? (
              <div className={cn("mx-5 mb-5 rounded-xl border border-dashed", submitted && errors.lines && "border-destructive/50")}>
                <EmptyState compact icon={PackageSearch} title="No items yet" description={submitted && errors.lines ? <span className="text-destructive-foreground">{errors.lines}</span> : "Search above to add products to this order."} />
              </div>
            ) : (
              <div>
                <div className="hidden grid-cols-[minmax(0,1fr)_92px_104px_120px_112px_36px] gap-3 border-y bg-muted/40 px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                  <span>Product</span>
                  <span className="text-right">In stock</span>
                  <span>Qty</span>
                  <span>Unit cost (Rs)</span>
                  <span className="text-right">Line total</span>
                  <span className="sr-only">Remove</span>
                </div>
                <ul className="divide-y border-t md:border-t-0">
                  {lineInfo.map(({ line, product, total, qtyErr, costErr, otherSupplier }) => {
                    if (!product) return null;
                    const status = stockStatus(product.stock, product.minStock);
                    return (
                      <li key={line.productId} className="grid grid-cols-2 gap-x-3 gap-y-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_92px_104px_120px_112px_36px] md:items-start" data-testid={`po-line-${line.productId}`}>
                        <div className="col-span-2 flex min-w-0 items-start gap-3 md:col-span-1">
                          <ProductThumb image={product.image} name={product.name} color={categoryMap.get(product.categoryId)?.color} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{product.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{product.sku}
                              <span className="ml-2 font-sans md:hidden">· Stock <span className={cn(status !== "in_stock" && "text-warning-foreground")}>{formatQty(product.stock, product.unit)}</span></span>
                            </p>
                            {otherSupplier && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-warning-foreground"><AlertTriangle className="size-3 shrink-0" /> Usually supplied by {otherSupplier.name}</p>
                            )}
                          </div>
                          <Button type="button" variant="ghost" size="icon-sm" className="-mr-2 text-muted-foreground hover:text-destructive-foreground md:hidden" onClick={() => removeLine(line.productId)} aria-label={`Remove ${product.name}`} disabled={!!saving}>
                            <Trash2 />
                          </Button>
                        </div>
                        <div className="hidden pt-2 text-right text-[13px] tabular md:block">
                          <span className={cn("font-medium", status === "out_of_stock" ? "text-destructive-foreground" : status === "low_stock" ? "text-warning-foreground" : "")}>{formatQty(product.stock, product.unit)}</span>
                          <span className="block text-[11px] text-muted-foreground">min {formatQty(product.minStock)}</span>
                        </div>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-muted-foreground md:sr-only">Qty ({product.unit})</span>
                          <Input
                            type="number"
                            inputMode={product.unit === "kg" ? "decimal" : "numeric"}
                            min={0}
                            step={product.unit === "kg" ? 0.001 : 1}
                            value={line.qty}
                            onChange={(e) => updateLine(line.productId, { qty: e.target.value })}
                            aria-invalid={!!qtyErr}
                            aria-label={`Quantity for ${product.name}`}
                            className="tabular"
                            disabled={!!saving}
                            data-testid={`po-line-qty-${line.productId}`}
                          />
                          {qtyErr && <span className="text-[11px] text-destructive-foreground" role="alert">{qtyErr}</span>}
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-muted-foreground md:sr-only">Unit cost (Rs)</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.01}
                            value={line.cost}
                            onChange={(e) => updateLine(line.productId, { cost: e.target.value })}
                            aria-invalid={!!costErr}
                            aria-label={`Unit cost for ${product.name}`}
                            className="tabular"
                            disabled={!!saving}
                            data-testid={`po-line-cost-${line.productId}`}
                          />
                          {costErr && <span className="text-[11px] text-destructive-foreground" role="alert">{costErr}</span>}
                        </label>
                        <div className="col-span-2 flex items-center justify-between border-t border-dashed pt-2 md:col-span-1 md:block md:border-0 md:pt-2 md:text-right">
                          <span className="text-xs text-muted-foreground md:hidden">Line total</span>
                          <Money value={total} className="text-sm font-semibold" />
                        </div>
                        <Button type="button" variant="ghost" size="icon-sm" className="hidden text-muted-foreground hover:text-destructive-foreground md:inline-flex" onClick={() => removeLine(line.productId)} aria-label={`Remove ${product.name}`} disabled={!!saving}>
                          <Trash2 />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>Order summary</CardTitle>
          <CardDescription className="flex items-center gap-1.5 truncate"><Truck className="size-3.5 shrink-0" /> {supplier?.name ?? "No supplier selected"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground"><dt>Items</dt><dd className="tabular text-foreground" data-testid="po-summary-items">{values.lines.length}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>Total units</dt><dd className="tabular text-foreground">{formatQty(totalUnits)}</dd></div>
            <div className="flex items-baseline justify-between border-t pt-3"><dt className="font-medium">Total cost</dt><dd><Money value={totalCost} className="text-xl font-semibold tracking-tight" /></dd></div>
          </dl>
          {mismatched > 0 && (
            <p className="flex gap-2 rounded-lg bg-warning-soft p-2.5 text-xs text-warning-foreground">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              {mismatched} item{mismatched === 1 ? " is" : "s are"} usually supplied by a different supplier.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {canApprove && (
              <Button onClick={() => save(true)} loading={saving === "approve"} disabled={!!saving} data-testid="po-save-approve">
                <CheckCircle2 /> Save &amp; approve
              </Button>
            )}
            <Button variant={canApprove ? "outline" : "default"} onClick={() => save(false)} loading={saving === "draft"} disabled={!!saving} data-testid="po-save-draft">
              <Save /> {editId ? "Save changes" : "Save draft"}
            </Button>
            <Button variant="ghost" onClick={leave} disabled={!!saving} data-testid="po-cancel-form">
              <ArrowLeft /> Cancel
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">Drafts can be edited until approved. Stock only changes when you receive the order.</p>
        </CardContent>
      </Card>
    </div>
  );
}
