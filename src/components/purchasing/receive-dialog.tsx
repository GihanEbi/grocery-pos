"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, CheckCheck, PackageCheck, RotateCcw } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductThumb } from "@/components/shared/product-thumb";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useCategoryMap, useCurrentUser, useProductMap } from "@/hooks";
import { api } from "@/mocks/services";
import { formatQty } from "@/lib/formatting";
import { roundQty } from "@/lib/calculations/money";
import { cn } from "@/lib/utils";
import type { PurchaseOrder } from "@/types";
import { parseQty, qtyError } from "./po-utils";

interface LineState {
  qty: string;
  expiry: string;
}

export function ReceiveDialog({ po, open, onOpenChange }: { po: PurchaseOrder; open: boolean; onOpenChange: (open: boolean) => void }) {
  const productMap = useProductMap();
  const categoryMap = useCategoryMap();
  const user = useCurrentUser();
  const confirm = useConfirm();
  const [lines, setLines] = React.useState<Record<string, LineState>>({});
  const [saving, setSaving] = React.useState(false);

  const pending = React.useMemo(() => po.items.filter((i) => roundQty(i.quantity - i.receivedQty) > 0), [po.items]);
  const today = format(new Date(), "yyyy-MM-dd");

  const remainingOf = React.useCallback((productId: string) => {
    const i = po.items.find((x) => x.productId === productId);
    return i ? Math.max(0, roundQty(i.quantity - i.receivedQty)) : 0;
  }, [po.items]);

  const buildDefaults = React.useCallback(
    (fill: boolean) => {
      const next: Record<string, LineState> = {};
      for (const item of pending) {
        const p = productMap.get(item.productId);
        next[item.productId] = {
          qty: fill ? String(roundQty(item.quantity - item.receivedQty)) : "0",
          expiry: p?.trackExpiry ? format(addDays(new Date(), Math.max(1, p.shelfLifeDays || 7)), "yyyy-MM-dd") : "",
        };
      }
      return next;
    },
    [pending, productMap],
  );

  // Reset the form each time the dialog opens.
  React.useEffect(() => {
    if (open) setLines(buildDefaults(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = React.useMemo(() => {
    const out: Record<string, { qty?: string; expiry?: string }> = {};
    for (const item of pending) {
      const p = productMap.get(item.productId);
      const l = lines[item.productId];
      if (!p || !l) continue;
      const qErr = qtyError(l.qty, p.unit, { min: "zero", max: remainingOf(item.productId) });
      const e: { qty?: string; expiry?: string } = {};
      if (qErr) e.qty = qErr;
      if (p.trackExpiry && (parseQty(l.qty) ?? 0) > 0) {
        if (!l.expiry) e.expiry = "Expiry date required";
        else if (l.expiry < today) e.expiry = "Date is in the past";
      }
      if (e.qty || e.expiry) out[item.productId] = e;
    }
    return out;
  }, [lines, pending, productMap, remainingOf, today]);

  const receiving = pending
    .map((i) => ({ item: i, product: productMap.get(i.productId), qty: parseQty(lines[i.productId]?.qty ?? "") ?? 0 }))
    .filter((x) => x.qty > 0 && x.product);
  const hasErrors = Object.keys(errors).length > 0;
  const allFull = pending.every((i) => (parseQty(lines[i.productId]?.qty ?? "") ?? 0) === remainingOf(i.productId));

  const setLine = (id: string, patch: Partial<LineState>) => setLines((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  async function submit() {
    if (!user) return;
    if (hasErrors) {
      toast.error("Check the highlighted quantities before receiving.");
      return;
    }
    if (receiving.length === 0) {
      toast.error("Enter a received quantity for at least one item.");
      return;
    }
    const completes = allFull;
    const ok = await confirm({
      title: `Receive ${receiving.length} item${receiving.length === 1 ? "" : "s"} into stock?`,
      description: (
        <div className="space-y-2">
          <p>Inventory will increase and stock movements will be recorded against {po.poNumber}.</p>
          <ul className="max-h-40 overflow-y-auto rounded-lg border bg-muted/40 p-2 text-[13px] text-foreground scrollbar-thin">
            {receiving.map(({ item, product, qty }) => (
              <li key={item.productId} className="flex justify-between gap-3 py-0.5">
                <span className="truncate">{product!.name}</span>
                <span className="tabular shrink-0 font-medium">+{formatQty(qty, product!.unit)}</span>
              </li>
            ))}
          </ul>
          {!completes && <p className="text-xs">The order will stay <strong>partially received</strong> until the rest arrives.</p>}
        </div>
      ),
      confirmLabel: "Receive stock",
    });
    if (!ok) return;
    setSaving(true);
    const r = await api.purchasing.receive(
      po.id,
      receiving.map(({ item, product }) => {
        const l = lines[item.productId];
        return {
          productId: item.productId,
          quantity: roundQty(parseQty(l.qty) ?? 0),
          expiryDate: product!.trackExpiry && l.expiry ? new Date(`${l.expiry}T12:00:00`).toISOString() : null,
        };
      }),
      user.id,
    );
    setSaving(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    const units = receiving.reduce((a, x) => a + x.qty, 0);
    const names = receiving.slice(0, 2).map((x) => x.product!.name).join(", ");
    toast.success("Stock updated", {
      description: `${po.poNumber}: ${receiving.length} product${receiving.length === 1 ? "" : "s"} (${roundQty(units)} units) added to inventory — ${names}${receiving.length > 2 ? ` +${receiving.length - 2} more` : ""}.`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageCheck className="size-4 text-primary" /> Receive stock · <span className="font-mono">{po.poNumber}</span></DialogTitle>
          <DialogDescription>Enter what was delivered. Quantities can be received in several deliveries.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">
              {pending.length} line{pending.length === 1 ? "" : "s"} awaiting delivery
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setLines(buildDefaults(false))} disabled={saving}>
                <RotateCcw /> Clear
              </Button>
              <Button type="button" size="sm" variant="soft" onClick={() => setLines(buildDefaults(true))} disabled={saving || allFull} data-testid="receive-mark-all">
                <CheckCheck /> Mark all as received
              </Button>
            </div>
          </div>

          <ul className="divide-y rounded-xl border">
            {pending.map((item) => {
              const p = productMap.get(item.productId);
              if (!p) return null;
              const l = lines[item.productId] ?? { qty: "", expiry: "" };
              const err = errors[item.productId];
              const remaining = remainingOf(item.productId);
              return (
                <li key={item.productId} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="flex min-w-0 items-start gap-3">
                    <ProductThumb image={p.image} name={p.name} color={categoryMap.get(p.categoryId)?.color} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular">
                        <span>Ordered <span className="font-medium text-foreground">{formatQty(item.quantity, p.unit)}</span></span>
                        <span>Received <span className="font-medium text-foreground">{formatQty(item.receivedQty, p.unit)}</span></span>
                        <span>Remaining <span className="font-medium text-warning-foreground">{formatQty(remaining, p.unit)}</span></span>
                      </p>
                      {p.trackExpiry && (
                        <Badge variant="outline" className="mt-1.5"><CalendarClock /> Expiry tracked · {p.shelfLifeDays}d shelf life</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:items-start">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Receiving now ({p.unit})</span>
                      <Input
                        type="number"
                        inputMode={p.unit === "kg" ? "decimal" : "numeric"}
                        min={0}
                        max={remaining}
                        step={p.unit === "kg" ? 0.001 : 1}
                        value={l.qty}
                        onChange={(e) => setLine(item.productId, { qty: e.target.value })}
                        aria-invalid={!!err?.qty}
                        className="tabular sm:w-28"
                        data-testid={`receive-qty-${item.productId}`}
                        disabled={saving}
                      />
                      {err?.qty && <span className="text-[11px] text-destructive-foreground" role="alert">{err.qty}</span>}
                    </label>
                    {p.trackExpiry ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Expiry date</span>
                        <Input
                          type="date"
                          min={today}
                          value={l.expiry}
                          onChange={(e) => setLine(item.productId, { expiry: e.target.value })}
                          aria-invalid={!!err?.expiry}
                          className={cn("sm:w-40")}
                          disabled={saving}
                        />
                        {err?.expiry && <span className="text-[11px] text-destructive-foreground" role="alert">{err.expiry}</span>}
                      </label>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogBody>
        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted-foreground tabular">
            {receiving.length} of {pending.length} line{pending.length === 1 ? "" : "s"} · {allFull ? "completes the order" : "partial delivery"}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} loading={saving} disabled={receiving.length === 0} data-testid="receive-confirm">
              <PackageCheck /> Receive stock
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
