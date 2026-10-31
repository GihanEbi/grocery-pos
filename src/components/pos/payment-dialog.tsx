"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Banknote, CheckCircle2, CloudOff, CreditCard, Printer, QrCode, ShoppingCart, Split, Wifi } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod, Sale } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCartStore } from "@/store/cart-store";
import { useCurrentUser } from "@/store/auth-store";
import { api } from "@/mocks/services";
import { validatePayments, type PaymentDraft } from "@/lib/calculations/cart";
import { fromCents, toCents } from "@/lib/calculations/money";
import { formatMoney } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useActiveShift } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Receipt } from "@/components/shared/receipt";
import { usePosCart } from "./use-pos";

type Mode = PaymentMethod | "split";

const MODES: { value: Mode; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "qr", label: "QR Pay", icon: QrCode },
  { value: "split", label: "Split", icon: Split },
];

/** Suggested cash notes the customer is likely to hand over. */
function quickCash(total: number): number[] {
  const rupees = Math.ceil(total / 100);
  const opts = new Set<number>([rupees]);
  for (const step of [100, 500, 1000, 5000]) {
    const v = Math.ceil(rupees / step) * step;
    if (v >= rupees) opts.add(v);
  }
  return [...opts].sort((a, b) => a - b).slice(0, 5).map((r) => r * 100);
}

export function PaymentDialog({ open, onOpenChange, onComplete }: { open: boolean; onOpenChange: (o: boolean) => void; onComplete: (sale: Sale) => void }) {
  const cart = usePosCart();
  const total = cart.totals.grandTotal;
  const defaultMethod = useAppStore((s) => s.settings.pos.defaultPaymentMethod);
  const offline = useAppStore((s) => s.meta.simulatedOffline);
  const user = useCurrentUser();
  const shift = useActiveShift();
  const [mode, setMode] = useState<Mode>("cash");
  const [tendered, setTendered] = useState("");
  const [splitMethod, setSplitMethod] = useState<"card" | "qr">("card");
  const [splitAmount, setSplitAmount] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(offline ? "cash" : defaultMethod);
      setTendered("");
      setSplitAmount(String(fromCents(Math.round(total / 2 / 100) * 100)));
      setProcessing(false);
    }
  }, [open, defaultMethod, offline, total]);

  const drafts: PaymentDraft[] = useMemo(() => {
    if (mode === "cash") return [{ method: "cash", amount: tendered === "" ? 0 : toCents(Number(tendered)) }];
    if (mode === "card" || mode === "qr") return [{ method: mode, amount: total }];
    const other = toCents(Number(splitAmount || 0));
    return [
      { method: splitMethod, amount: other },
      { method: "cash", amount: Math.max(0, total - other) },
    ];
  }, [mode, tendered, total, splitAmount, splitMethod]);

  const validation = validatePayments(total, drafts);
  const cashTendered = mode === "cash" ? drafts[0].amount : 0;
  const change = mode === "cash" ? cashTendered - total : 0;
  const splitInvalid = mode === "split" && (toCents(Number(splitAmount || 0)) <= 0 || toCents(Number(splitAmount || 0)) >= total);

  const complete = async () => {
    if (!validation.ok || splitInvalid || !user || processing) return;
    setProcessing(true);
    const c = useCartStore.getState();
    const r = await api.sales.complete({ items: c.items, customerId: c.customerId, billDiscount: c.billDiscount, payments: drafts, cashierId: user.id, shiftId: shift?.id ?? null });
    setProcessing(false);
    if (!r.ok) {
      toast.error("Payment could not be completed", { description: r.error });
      return;
    }
    useCartStore.getState().clear();
    onOpenChange(false);
    onComplete(r.data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !processing && onOpenChange(o)}>
      <DialogContent size="md" data-testid="payment-dialog" onEscapeKeyDown={(e) => processing && e.preventDefault()}>
        <form onSubmit={(e) => { e.preventDefault(); complete(); }} className="contents">
          <DialogHeader>
            <DialogTitle>Take payment</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">Payments are simulated — no card is charged. <DemoBadge /></DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="rounded-2xl bg-primary-soft/60 px-5 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-soft-foreground">Amount due</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular" data-testid="payment-total">{formatMoney(total)}</p>
            </div>

            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Payment method">
              {MODES.map((m) => {
                const disabled = offline && m.value !== "cash";
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.value}
                    disabled={disabled}
                    onClick={() => setMode(m.value)}
                    data-testid={`pay-method-${m.value}`}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-[13px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
                      mode === m.value ? "border-primary bg-primary-soft text-primary-soft-foreground ring-1 ring-primary" : "hover:border-ring/40 hover:bg-accent",
                    )}
                  >
                    <m.icon className="size-5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
            {offline && (
              <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground"><CloudOff className="size-3.5 shrink-0" />Offline mode: only cash is accepted. The sale will be queued for sync.</p>
            )}

            {mode === "cash" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tendered">Cash received (Rs)</Label>
                  <Input id="tendered" autoFocus type="number" inputMode="decimal" min={0} step="0.01" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={String(fromCents(total))} className="h-14 text-2xl font-semibold tabular" data-testid="cash-tendered" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {quickCash(total).map((v, i) => (
                    <Button key={v} type="button" variant={i === 0 ? "soft" : "outline"} size="sm" onClick={() => setTendered(String(fromCents(v)))} data-testid={i === 0 ? "cash-exact" : undefined}>
                      {i === 0 ? "Exact" : formatMoney(v)}
                    </Button>
                  ))}
                </div>
                <div className={cn("flex items-center justify-between rounded-xl border px-4 py-3", tendered === "" ? "bg-muted/40" : change >= 0 ? "border-success/40 bg-success-soft" : "border-destructive/30 bg-destructive-soft")}>
                  <span className="text-sm font-medium">{tendered !== "" && change < 0 ? "Still due" : "Change due"}</span>
                  <span className={cn("text-2xl font-semibold tabular", tendered !== "" && (change >= 0 ? "text-success-foreground" : "text-destructive-foreground"))} data-testid="change-due">
                    {formatMoney(tendered === "" ? 0 : Math.abs(change))}
                  </span>
                </div>
              </div>
            )}

            {mode === "card" && (
              <div className="space-y-3 rounded-xl border border-dashed p-4 text-center">
                <CreditCard className="mx-auto size-8 text-primary" />
                <p className="text-sm font-medium">Tap, insert or swipe the card on the terminal</p>
                <p className="text-xs text-muted-foreground">Clicking Complete simulates an approved authorisation for {formatMoney(total)}.</p>
              </div>
            )}

            {mode === "qr" && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-4 text-center sm:flex-row sm:text-left">
                <FakeQr seed={total} />
                <div>
                  <p className="text-sm font-medium">Ask the customer to scan with their banking app</p>
                  <p className="mt-1 text-xs text-muted-foreground">LankaQR-style code for {formatMoney(total)}. This QR is a placeholder — scanning it does nothing.</p>
                </div>
              </div>
            )}

            {mode === "split" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(["card", "qr"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setSplitMethod(m)} className={cn("h-9 rounded-lg border text-sm font-medium", splitMethod === m ? "border-primary bg-primary-soft text-primary-soft-foreground" : "hover:bg-accent")}>
                      {m === "card" ? "Card" : "QR Pay"} + Cash
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="split-amt">{splitMethod === "card" ? "Card" : "QR"} amount (Rs)</Label>
                    <Input id="split-amt" type="number" min={0} step="0.01" value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)} className="h-11 tabular" aria-invalid={splitInvalid} data-testid="split-amount" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cash portion</Label>
                    <div className="flex h-11 items-center rounded-lg border bg-muted/50 px-3 font-semibold tabular">{formatMoney(Math.max(0, total - toCents(Number(splitAmount || 0))))}</div>
                  </div>
                </div>
                {splitInvalid && <p className="text-xs text-destructive-foreground">The {splitMethod === "card" ? "card" : "QR"} amount must be more than zero and less than the total.</p>}
              </div>
            )}

            {!validation.ok && mode === "cash" && tendered !== "" && <p className="text-xs text-destructive-foreground" role="alert">{validation.error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>Back to bill</Button>
            <Button type="submit" size="lg" disabled={!validation.ok || splitInvalid} loading={processing} data-testid="complete-payment" className="min-w-44">
              {processing ? (mode === "cash" ? "Recording sale…" : "Authorising…") : <>Complete sale · {formatMoney(total)}</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FakeQr({ seed }: { seed: number }) {
  const cells = useMemo(() => {
    let x = seed % 2147483647 || 1;
    return Array.from({ length: 21 * 21 }, () => ((x = (x * 48271) % 2147483647) & 1) === 1);
  }, [seed]);
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
  return (
    <svg viewBox="0 0 21 21" className="size-32 shrink-0 rounded-lg bg-white p-1.5" shapeRendering="crispEdges" aria-label="Simulated QR code">
      {cells.map((on, i) => {
        const r = Math.floor(i / 21), c = i % 21;
        if (finder(r, c)) {
          const rr = r > 13 ? r - 14 : r, cc = c > 13 ? c - 14 : c;
          const ring = rr === 0 || rr === 6 || cc === 0 || cc === 6 || (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4);
          return ring ? <rect key={i} x={c} y={r} width={1} height={1} fill="#111" /> : null;
        }
        return on ? <rect key={i} x={c} y={r} width={1} height={1} fill="#111" /> : null;
      })}
    </svg>
  );
}

/** Success screen with change due and receipt preview. */
export function SaleCompleteDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const customer = useAppStore((s) => (sale?.customerId ? s.customers.find((c) => c.id === sale.customerId) : null));
  if (!sale) return null;
  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg" data-testid="sale-complete">
        <DialogHeader className="sr-only">
          <DialogTitle>Sale complete</DialogTitle>
          <DialogDescription>Receipt {sale.receiptNo}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-0 p-0 md:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="flex flex-col justify-center gap-5 p-6">
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success-foreground">
              <CheckCircle2 className="size-8" />
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Payment successful</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Receipt <span className="font-mono font-medium text-foreground" data-testid="receipt-number">{sale.receiptNo}</span>
                {customer && <> · {customer.name} earned <b className="text-foreground">{sale.loyaltyEarned}</b> points</>}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">Total paid</p>
                <p className="whitespace-nowrap text-lg font-semibold tabular">{formatMoney(sale.total)}</p>
              </div>
              <div className={cn("rounded-xl border p-3", sale.change > 0 && "border-success/40 bg-success-soft")}>
                <p className="text-xs text-muted-foreground">Change due</p>
                <p className="whitespace-nowrap text-lg font-semibold tabular" data-testid="sale-change">{formatMoney(sale.change)}</p>
              </div>
            </div>
            {sale.offline && (
              <p className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-foreground"><CloudOff className="size-3.5" />Saved offline — will sync when you go back online.</p>
            )}
            {!sale.offline && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Wifi className="size-3.5" />Stock, reports and customer history updated.</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => window.print()} data-testid="print-receipt"><Printer />Print receipt</Button>
              <Button autoFocus className="flex-1" onClick={onClose} data-testid="new-sale"><ShoppingCart />New sale</Button>
            </div>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto bg-muted/50 p-4 scrollbar-thin md:max-h-[75dvh] md:border-l">
            <Receipt sale={sale} className="rounded-md" />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
