"use client";

import { useEffect, useState } from "react";
import { Clock, PlayCircle, Scale, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { DiscountType, HeldBill, Product } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCartStore } from "@/store/cart-store";
import { useCurrentUser } from "@/store/auth-store";
import { api } from "@/mocks/services";
import { calculateCart } from "@/lib/calculations/cart";
import { multiply, roundQty, toCents } from "@/lib/calculations/money";
import { formatMoney, formatPercent, formatQty, formatRelative, timeAgo } from "@/lib/formatting";
import { ROLE_LABEL } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/shared/form-field";
import { ProductThumb } from "@/components/shared/product-thumb";
import { EmptyState } from "@/components/shared/empty-state";
import { DemoBadge } from "@/components/shared/demo-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useCategoryMap } from "@/hooks";
import { addToCart, setCartQty } from "./pos-actions";
import { usePosCart } from "./use-pos";

/* ---------------------------------------------------------------- Weight */

/** Weight entry for products sold by the kilogram. Price is calculated live. */
export function WeightDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const inCart = useCartStore((s) => (product ? s.items.find((i) => i.productId === product.id)?.quantity ?? 0 : 0));
  const catMap = useCategoryMap();
  const [unit, setUnit] = useState<"kg" | "g">("kg");
  const [value, setValue] = useState("");
  const editing = inCart > 0;

  useEffect(() => {
    if (product) {
      setUnit("kg");
      setValue(editing ? String(inCart) : "");
    }
  }, [product, editing, inCart]);

  if (!product) return null;
  const kg = roundQty(unit === "kg" ? Number(value) : Number(value) / 1000);
  const valid = Number.isFinite(kg) && kg >= 0.005 && kg <= 100;
  const overStock = valid && kg > product.stock;
  const price = valid ? multiply(product.sellingPrice, kg) : 0;
  const presets = unit === "kg" ? [0.25, 0.5, 1, 1.5, 2, 5] : [100, 250, 500, 750];

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!valid || overStock) return;
    const ok = editing ? setCartQty(product, kg) : addToCart(product, kg);
    if (ok) {
      toast.success(`${formatQty(kg, "kg")} ${product.name} ${editing ? "updated" : "added"}`, { duration: 1000, id: "pos-add" });
      onClose();
    }
  };

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" data-testid="weight-dialog">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Scale className="size-4 text-primary" />Enter weight</DialogTitle>
            <DialogDescription>Weigh the item on the scale and enter the reading.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <ProductThumb image={product.image} name={product.name} color={catMap.get(product.categoryId)?.color} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground tabular">{formatMoney(product.sellingPrice)} / kg · {formatQty(product.stock, "kg")} in stock</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input autoFocus type="number" inputMode="decimal" min={0} step={unit === "kg" ? "0.005" : "1"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={unit === "kg" ? "0.000" : "0"} className="h-14 pr-12 text-2xl font-semibold tabular" data-testid="weight-input" aria-label={`Weight in ${unit}`} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{unit}</span>
              </div>
              <div className="flex rounded-lg border p-1">
                {(["kg", "g"] as const).map((u) => (
                  <button key={u} type="button" onClick={() => { setUnit(u); setValue(""); }} className={cn("w-11 rounded-md text-sm font-medium", unit === u ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>{u}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {presets.map((p) => (
                <Button key={p} type="button" variant="outline" size="sm" onClick={() => setValue(String(p))}>{p}{unit}</Button>
              ))}
            </div>
            <div className={cn("flex items-center justify-between rounded-xl px-4 py-3", overStock ? "bg-destructive-soft" : "bg-primary-soft/60")}>
              <span className="text-sm text-muted-foreground">{valid ? `${formatQty(kg, "kg")} × ${formatMoney(product.sellingPrice)}` : "Price"}</span>
              <span className="text-xl font-semibold tabular" data-testid="weight-price">{formatMoney(price)}</span>
            </div>
            {value !== "" && !valid && <p className="text-xs text-destructive-foreground">Enter a weight between 5 g and 100 kg.</p>}
            {overStock && <p className="text-xs text-destructive-foreground">Only {formatQty(product.stock, "kg")} in stock.</p>}
          </DialogBody>
          <DialogFooter>
            {editing && <Button type="button" variant="destructive-outline" onClick={() => { setCartQty(product, 0); onClose(); }}>Remove</Button>}
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || overStock} data-testid="weight-submit">{editing ? "Update weight" : "Add to bill"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Discount */

export function DiscountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useCurrentUser();
  const current = useCartStore((s) => s.billDiscount);
  const setBillDiscount = useCartStore((s) => s.setBillDiscount);
  const cart = usePosCart();
  const pos = useAppStore((s) => s.settings.pos);
  const [type, setType] = useState<DiscountType>("percent");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      setType(current?.type ?? "percent");
      setValue(current ? String(current.type === "percent" ? current.value / 100 : current.value / 100) : "");
    }
  }, [open, current]);

  if (!user) return null;
  const limit = pos.discountLimits[user.role];
  const num = Number(value || 0);
  const draft = type === "percent" ? { type, value: Math.round(num * 100) } : { type, value: toCents(num) };
  // Preview with the draft discount applied.
  const preview = calculateCart(
    cart.lines.map((l) => ({ productId: l.product.id, unitPrice: l.product.sellingPrice, quantity: l.item.quantity, discount: l.item.discount, taxable: l.product.taxable })),
    num > 0 ? draft : null,
    { rateBps: pos.taxRateBps, mode: pos.taxMode },
  );
  const totalDisc = preview.itemDiscountTotal + preview.billDiscountAmount;
  const effBps = preview.grossTotal ? Math.round((totalDisc * 10000) / preview.grossTotal) : 0;
  const invalid = !Number.isFinite(num) || num < 0 || (type === "percent" && num > 100) || (type === "fixed" && draft.value > preview.subtotal);
  const overLimit = !invalid && effBps > limit;

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid || overLimit) return;
    setBillDiscount(num > 0 ? draft : null);
    toast.success(num > 0 ? `Discount applied: ${formatMoney(preview.billDiscountAmount)}` : "Discount removed");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={apply} className="contents">
          <DialogHeader>
            <DialogTitle>Bill discount</DialogTitle>
            <DialogDescription>Your limit as {ROLE_LABEL[user.role]}: <b className="text-foreground">{formatPercent(limit)}</b> of the bill (item + bill discounts combined).</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["percent", "fixed"] as const).map((t) => (
                <button key={t} type="button" onClick={() => { setType(t); setValue(""); }} className={cn("h-8 rounded-md text-sm font-medium", type === t ? "bg-card shadow-sm" : "text-muted-foreground")} data-testid={`discount-type-${t}`}>
                  {t === "percent" ? "Percentage (%)" : "Fixed amount (Rs)"}
                </button>
              ))}
            </div>
            <Input autoFocus type="number" min={0} step={type === "percent" ? "0.5" : "1"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "percent" ? "e.g. 5" : "e.g. 100"} className="h-12 text-lg tabular" aria-invalid={invalid || overLimit} data-testid="discount-value" />
            <div className="flex flex-wrap gap-2">
              {(type === "percent" ? [2, 5, 10, 15] : [50, 100, 250, 500]).map((v) => (
                <Button key={v} type="button" variant="outline" size="sm" onClick={() => setValue(String(v))}>{type === "percent" ? `${v}%` : `Rs ${v}`}</Button>
              ))}
            </div>
            <div className="space-y-1 rounded-lg border p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular text-success-foreground">− {formatMoney(preview.billDiscountAmount)}</span></div>
              <div className="flex justify-between font-semibold"><span>New total</span><span className="tabular">{formatMoney(preview.grandTotal)}</span></div>
            </div>
            {invalid && <p className="text-xs text-destructive-foreground">{type === "percent" ? "Enter a percentage between 0 and 100." : "Discount cannot exceed the subtotal."}</p>}
            {overLimit && <p className="rounded-md bg-destructive-soft px-3 py-2 text-xs text-destructive-foreground" data-testid="discount-limit-error">This is {formatPercent(effBps)} of the bill — above your {formatPercent(limit)} limit. A manager or admin must apply it.</p>}
          </DialogBody>
          <DialogFooter>
            {current && <Button type="button" variant="destructive-outline" onClick={() => { setBillDiscount(null); onOpenChange(false); }}>Remove discount</Button>}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={invalid || overLimit} data-testid="discount-apply">Apply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Held bills */

export function HeldBillsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const held = useAppStore((s) => s.heldBills);
  const products = useAppStore((s) => s.products);
  const customers = useAppStore((s) => s.customers);
  const users = useAppStore((s) => s.users);
  const removeHeld = useAppStore((s) => s.removeHeldBill);
  const holdBill = useAppStore((s) => s.holdBill);
  const cartItems = useCartStore((s) => s.items);
  const confirm = useConfirm();
  const user = useCurrentUser();

  const resume = async (bill: HeldBill) => {
    if (cartItems.length > 0) {
      const ok = await confirm({ title: "Replace the current bill?", description: "The current bill will be put on hold so you can come back to it.", confirmLabel: "Hold current & resume" });
      if (!ok) return;
      const c = useCartStore.getState();
      holdBill({ label: `Bill at ${formatRelative(new Date())}`, items: c.items, customerId: c.customerId, billDiscount: c.billDiscount, cashierId: user!.id });
    }
    useCartStore.getState().load(bill);
    removeHeld(bill.id);
    onOpenChange(false);
    toast.success(`Resumed “${bill.label}”`);
  };

  const total = (bill: HeldBill) =>
    bill.items.reduce((a, i) => {
      const p = products.find((x) => x.id === i.productId);
      return a + (p ? multiply(p.sellingPrice, i.quantity) - i.discount : 0);
    }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" data-testid="held-bills">
        <DialogHeader>
          <DialogTitle>Held bills</DialogTitle>
          <DialogDescription>Paused bills are kept on this terminal until resumed or discarded.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {held.length === 0 ? (
            <EmptyState icon={Clock} title="No held bills" description="Use Hold (F6) to park a bill while a customer fetches something." compact />
          ) : (
            held.map((b) => {
              const customer = customers.find((c) => c.id === b.customerId);
              const cashier = users.find((u) => u.id === b.cashierId);
              return (
                <div key={b.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning-foreground"><Clock className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.items.length} line{b.items.length === 1 ? "" : "s"} · {customer?.name ?? "Walk-in"} · {cashier?.name.split(" ")[0]} · {timeAgo(b.createdAt)}
                    </p>
                  </div>
                  <span className="hidden text-sm font-semibold tabular sm:block">{formatMoney(total(b))}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Discard held bill" onClick={async () => { if (await confirm({ title: "Discard this held bill?", tone: "destructive", confirmLabel: "Discard" })) { removeHeld(b.id); toast("Held bill discarded"); } }}><Trash2 /></Button>
                  <Button size="sm" onClick={() => resume(b)} data-testid="resume-bill"><PlayCircle />Resume</Button>
                </div>
              );
            })
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- Register */

export function OpenRegisterDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useCurrentUser();
  const registerName = useAppStore((s) => s.settings.pos.registerName);
  const [amount, setAmount] = useState("10000");
  const [saving, setSaving] = useState(false);
  const num = Number(amount);
  const invalid = amount === "" || !Number.isFinite(num) || num < 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid || !user) return;
    setSaving(true);
    const r = await api.shifts.open({ cashierId: user.id, openingCash: toCents(num), notes: "" });
    setSaving(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${registerName} opened`, { description: `Opening float ${formatMoney(toCents(num))}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" data-testid="pos-open-register-dialog">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="size-4 text-primary" />Open register</DialogTitle>
            <DialogDescription>Count the cash float in the drawer before your first sale. <DemoBadge className="ml-1" /></DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <FormField label="Opening cash (Rs)" htmlFor="pos-opening" required error={invalid ? "Enter zero or a positive amount" : undefined}>
              <Input id="pos-opening" autoFocus type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-12 text-lg tabular" data-testid="pos-opening-cash" />
            </FormField>
            <div className="flex flex-wrap gap-2">
              {[5000, 10000, 15000, 20000].map((v) => <Button key={v} type="button" variant="outline" size="sm" onClick={() => setAmount(String(v))}>Rs {v.toLocaleString()}</Button>)}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={invalid} data-testid="pos-open-register-submit">Open register</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
