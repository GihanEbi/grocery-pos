"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, PackageCheck, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod, ReturnReason, Sale } from "@/types";
import { api } from "@/mocks/services";
import { useAppStore } from "@/store/app-store";
import { useActiveShift, useCurrentUser } from "@/hooks";
import { RETURN_REASONS } from "@/config/defaults";
import { refundAmount, returnableQty, validateReturnQty } from "@/lib/calculations/returns";
import { roundQty } from "@/lib/calculations/money";
import { formatMoney, formatQty, paymentMethodLabel } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/shared/form-field";
import { Money } from "@/components/shared/money";
import { DemoBadge } from "@/components/shared/demo-badge";

interface LineState {
  checked: boolean;
  qty: string;
}

interface PreparedLine {
  productId: string;
  name: string;
  unit: Sale["items"][number]["unit"];
  quantity: number;
  refund: number;
}

const NO_RESTOCK_REASONS: ReturnReason[] = ["damaged", "expired"];

export function ReturnDialog({ sale, open, onOpenChange }: { sale: Sale; open: boolean; onOpenChange: (v: boolean) => void }) {
  const user = useCurrentUser();
  const shift = useActiveShift();
  const offline = useAppStore((s) => s.meta.simulatedOffline);

  const eligible = useMemo(() => sale.items.filter((i) => returnableQty(i) > 0), [sale.items]);
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [reason, setReason] = useState<ReturnReason | "">("");
  const [notes, setNotes] = useState("");
  const [restock, setRestock] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setLines(Object.fromEntries(eligible.map((i) => [i.productId, { checked: false, qty: String(returnableQty(i)) }])));
    setReason("");
    setNotes("");
    setRestock(true);
    setMethod("cash");
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const originalMethods = useMemo(
    () => [...new Set(sale.payments.filter((p) => p.amount > 0 && p.method !== "cash").map((p) => p.method))],
    [sale.payments],
  );

  const evaluated = useMemo(
    () =>
      eligible.map((item) => {
        const st = lines[item.productId] ?? { checked: false, qty: "" };
        const qty = Number(st.qty);
        let error: string | null = null;
        if (st.checked) {
          if (st.qty.trim() === "") error = "Enter a quantity.";
          else if (item.unit !== "kg" && !Number.isInteger(qty)) error = "Enter a whole number.";
          else {
            const v = validateReturnQty(item, qty);
            if (!v.ok) error = v.error;
          }
        }
        const refund = st.checked && !error ? refundAmount(item, roundQty(qty)) : 0;
        return { item, st, qty: roundQty(qty), error, refund };
      }),
    [eligible, lines],
  );

  const selected = evaluated.filter((e) => e.st.checked);
  const hasErrors = selected.some((e) => e.error);
  const total = selected.reduce((a, e) => a + e.refund, 0);
  const allChecked = eligible.length > 0 && selected.length === eligible.length;
  const canReview = selected.length > 0 && !hasErrors && !!reason && !(offline && method !== "cash");

  const prepared: PreparedLine[] = selected
    .filter((e) => !e.error)
    .map((e) => ({ productId: e.item.productId, name: e.item.name, unit: e.item.unit, quantity: e.qty, refund: e.refund }));

  const setLine = (id: string, patch: Partial<LineState>) => setLines((l) => ({ ...l, [id]: { ...l[id]!, ...patch } }));

  const onReasonChange = (v: string) => {
    const r = v as ReturnReason;
    setReason(r);
    setRestock(!NO_RESTOCK_REASONS.includes(r));
  };

  const onReview = () => {
    setTouched(true);
    if (!canReview) return;
    setReviewOpen(true);
  };

  const confirm = async () => {
    if (!user || !reason) return;
    setSubmitting(true);
    const r = await api.sales.processReturn({
      saleId: sale.id,
      items: prepared.map((p) => ({ productId: p.productId, quantity: p.quantity })),
      reason,
      notes: notes.trim(),
      refundMethod: method,
      restock,
      userId: user.id,
      shiftId: shift?.id ?? null,
    });
    setSubmitting(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Return ${r.data.returnNo} processed`, {
      description: `${formatMoney(r.data.refundAmount)} refunded via ${paymentMethodLabel[method]}${restock ? " · items restocked" : ""}.`,
    });
    setReviewOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg" data-testid="return-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Undo2 className="size-4 text-primary" /> Process return</DialogTitle>
            <DialogDescription>
              Receipt <span className="font-mono">{sale.receiptNo}</span> · select items and quantities to return.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Checkbox
                  aria-label="Select all items"
                  checked={allChecked ? true : selected.length > 0 ? "indeterminate" : false}
                  onCheckedChange={(v) =>
                    setLines((l) => Object.fromEntries(Object.entries(l).map(([k, s]) => [k, { ...s, checked: v === true }])))
                  }
                />
                <span className="flex-1">Item</span>
                <span className="hidden w-28 sm:block">Return qty</span>
                <span className="w-24 text-right">Refund</span>
              </div>
              <ul className="divide-y">
                {evaluated.map(({ item, st, error, refund }) => {
                  const max = returnableQty(item);
                  return (
                    <li key={item.productId} className={cn("px-3 py-3 transition-colors", st.checked && "bg-primary-soft/30")}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          className="mt-0.5"
                          checked={st.checked}
                          onCheckedChange={(v) => setLine(item.productId, { checked: v === true })}
                          aria-label={`Return ${item.name}`}
                          data-testid={`return-check-${item.productId}`}
                        />
                        <div className="grid min-w-0 flex-1 gap-2 sm:flex sm:items-start sm:gap-3">
                          <div className="min-w-0 sm:flex-1">
                            <button type="button" className="block max-w-full truncate text-left text-sm font-medium" onClick={() => setLine(item.productId, { checked: !st.checked })}>
                              {item.name}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              Bought {formatQty(item.quantity, item.unit)}
                              {item.returnedQty > 0 && <> · returned {formatQty(item.returnedQty, item.unit)}</>} · eligible{" "}
                              <span className="font-medium text-foreground">{formatQty(max, item.unit)}</span>
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="w-28">
                              <QtyInput item={item} st={st} error={error} onChange={(qty) => setLine(item.productId, { qty, checked: true })} />
                            </div>
                            <div className="w-24 text-right">
                              <Money value={refund} className={cn("text-sm font-medium", !st.checked && "text-muted-foreground")} />
                            </div>
                          </div>
                        </div>
                      </div>
                      {st.checked && error && (
                        <p className="mt-1.5 pl-7 text-xs text-destructive-foreground" role="alert">{error}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            {touched && selected.length === 0 && (
              <p className="-mt-3 text-xs text-destructive-foreground" role="alert">Select at least one item to return.</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Return reason" required error={touched && !reason ? "Choose a reason for the return." : undefined}>
                <Select value={reason} onValueChange={onReasonChange}>
                  <SelectTrigger data-testid="return-reason" aria-invalid={touched && !reason}>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Refund method"
                hint={offline ? "Offline mode: only cash refunds are available." : "Defaults to cash from the drawer."}
                error={offline && method !== "cash" ? "Card/QR refunds need a connection." : undefined}
              >
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger data-testid="return-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    {originalMethods.map((m) => (
                      <SelectItem key={m} value={m} disabled={offline}>
                        {paymentMethodLabel[m]} (original payment)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="Notes" htmlFor="return-notes" hint="Optional — visible in the return history.">
              <Textarea id="return-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Customer brought back an unopened pack" maxLength={300} className="min-h-16" data-testid="return-notes" />
            </FormField>

            <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-3.5">
              <div className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success-foreground"><PackageCheck className="size-4" /></span>
                <div>
                  <Label htmlFor="return-restock" className="text-sm">Return items to stock</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reason && NO_RESTOCK_REASONS.includes(reason)
                      ? "Turned off because damaged or expired goods usually can't be resold. You can override this."
                      : "Adds the returned quantities back to inventory."}
                  </p>
                </div>
              </div>
              <Switch id="return-restock" checked={restock} onCheckedChange={setRestock} data-testid="return-restock" />
            </div>
          </DialogBody>
          <DialogFooter className="sm:items-center sm:justify-between">
            <div className="flex items-baseline justify-between gap-3 sm:justify-start">
              <span className="text-sm text-muted-foreground">Refundable total</span>
              <Money value={total} className="text-lg font-semibold" />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={onReview} disabled={touched && !canReview} data-testid="return-review">
                <ShieldCheck /> Review refund
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RefundConfirmDialog
        open={reviewOpen}
        onOpenChange={(v) => !submitting && setReviewOpen(v)}
        sale={sale}
        lines={prepared}
        total={total}
        method={method}
        restock={restock}
        reason={reason}
        submitting={submitting}
        onConfirm={confirm}
      />
    </>
  );
}

function QtyInput({ item, st, error, onChange }: { item: Sale["items"][number]; st: LineState; error: string | null; onChange: (v: string) => void }) {
  const kg = item.unit === "kg";
  return (
    <div className="relative">
      <Input
        type="number"
        inputMode={kg ? "decimal" : "numeric"}
        step={kg ? 0.001 : 1}
        min={kg ? 0.001 : 1}
        max={returnableQty(item)}
        value={st.qty}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Return quantity for ${item.name}`}
        aria-invalid={st.checked && !!error}
        className="h-8 pr-10 text-right tabular"
        data-testid={`return-qty-${item.productId}`}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{kg ? "kg" : "qty"}</span>
    </div>
  );
}

function RefundConfirmDialog({
  open,
  onOpenChange,
  sale,
  lines,
  total,
  method,
  restock,
  reason,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sale: Sale;
  lines: PreparedLine[];
  total: number;
  method: PaymentMethod;
  restock: boolean;
  reason: ReturnReason | "";
  submitting: boolean;
  onConfirm: () => void;
}) {
  const reasonText = RETURN_REASONS.find((r) => r.value === reason)?.label ?? "—";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" data-testid="refund-confirm-dialog" hideClose={submitting}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RotateCcw className="size-4 text-destructive-foreground" /> Confirm refund</DialogTitle>
          <DialogDescription>Review the return before it is recorded against {sale.receiptNo}.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Refund amount</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular" data-testid="refund-total">{formatMoney(total)}</p>
            <p className="mt-1 text-sm text-muted-foreground">via {paymentMethodLabel[method]}</p>
          </div>
          <ul className="divide-y rounded-xl border">
            {lines.map((l) => (
              <li key={l.productId} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  {l.name} <span className="text-muted-foreground">× {formatQty(l.quantity, l.unit)}</span>
                </span>
                <Money value={l.refund} className="font-medium" />
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Reason</dt>
            <dd className="text-right font-medium">{reasonText}</dd>
            <dt className="text-muted-foreground">Restock items</dt>
            <dd className="text-right font-medium">{restock ? "Yes — add back to inventory" : "No — keep out of stock"}</dd>
          </dl>
          <div className="flex items-start gap-2.5 rounded-lg border border-info/30 bg-info-soft/60 px-3 py-2.5 text-xs text-info-foreground">
            <AlertTriangle className="mt-px size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold">Simulated refund — no money is transferred.</p>
              <p>This demo records the return, updates the sale and {restock ? "restocks the items" : "leaves stock unchanged"}.</p>
            </div>
          </div>
          <DemoBadge label="Simulated payment reversal" />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Back</Button>
          <Button variant="destructive" onClick={onConfirm} loading={submitting} data-testid="return-confirm">
            Confirm refund {formatMoney(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
