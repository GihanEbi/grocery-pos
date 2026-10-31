"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, Clock, CreditCard, Lock, LockOpen, QrCode, ReceiptText, RotateCcw, ShoppingCart, Vault, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Shift } from "@/types";
import { api } from "@/mocks/services";
import { useAppStore } from "@/store/app-store";
import { useActiveShift, useCurrentUser, useSettings } from "@/hooks";
import { summarizeShift } from "@/lib/calculations/register";
import { toCents } from "@/lib/calculations/money";
import { formatDateTime, formatMoney } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/shared/form-field";
import { DemoBadge } from "@/components/shared/demo-badge";
import { DifferenceBadge, differenceKind, parseRupees, shiftDuration } from "./shift-utils";

export function CurrentRegister({ onClosed }: { onClosed: (shiftId: string) => void }) {
  const hydrated = useAppStore((s) => s.hydrated);
  const shift = useActiveShift();

  if (!hydrated) return <Skeleton className="h-72 w-full rounded-xl" />;
  return shift ? <OpenRegister shift={shift} onClosed={onClosed} /> : <OpenRegisterForm />;
}

function RupeeInput(props: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rs</span>
      <Input type="text" inputMode="decimal" autoComplete="off" {...props} className={cn("pl-9 tabular", props.className)} />
    </div>
  );
}

/* --------------------------------- Closed --------------------------------- */

function OpenRegisterForm() {
  const user = useCurrentUser();
  const settings = useSettings();
  const [cash, setCash] = useState("10000");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const parsed = parseRupees(cash);
  const error = parsed === null ? "Enter the opening cash in rupees (0 or more, up to 2 decimals)." : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!user || parsed === null) return;
    setBusy(true);
    const r = await api.shifts.open({ cashierId: user.id, openingCash: toCents(parsed), notes: notes.trim() });
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Register opened", { description: `${r.data.register} · opening float ${formatMoney(r.data.openingCash)}` });
  };

  return (
    <Card className="overflow-hidden">
      <div className="grid lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col justify-between gap-6 border-b bg-muted/30 p-6 lg:border-b-0 lg:border-r">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" dot data-testid="register-status">Register closed</Badge>
              <DemoBadge label="Simulated register" />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">Start your shift</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              Count the cash float in the drawer and open <span className="font-medium text-foreground">{settings.pos.registerName}</span>.
              The POS blocks checkout while your register is closed.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-warning-soft text-warning-foreground"><Lock className="size-5" /></span>
            <div className="text-sm">
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">No open register on this account</p>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6" data-testid="open-register" noValidate>
          <FormField label="Opening cash" htmlFor="opening-cash" required error={touched ? error ?? undefined : undefined} hint="Cash float counted in the drawer before the first sale.">
            <RupeeInput id="opening-cash" value={cash} onChange={(e) => setCash(e.target.value)} onBlur={() => setTouched(true)} aria-invalid={touched && !!error} data-testid="opening-cash" className="h-11 text-base" />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {[5000, 10000, 15000, 20000].map((v) => (
              <Button key={v} type="button" variant="outline" size="sm" onClick={() => setCash(String(v))} className={cn(parsed === v && "border-primary/40 bg-primary-soft/50")}>
                Rs {v.toLocaleString("en-LK")}
              </Button>
            ))}
          </div>
          <FormField label="Notes" htmlFor="open-notes" hint="Optional">
            <Textarea id="open-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Float received from manager" className="min-h-16" maxLength={200} />
          </FormField>
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={touched && !!error} data-testid="open-register-submit">
            <LockOpen /> Open register
          </Button>
        </form>
      </div>
    </Card>
  );
}

/* ---------------------------------- Open ---------------------------------- */

function OpenRegister({ shift, onClosed }: { shift: Shift; onClosed: (id: string) => void }) {
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const user = useCurrentUser();
  const summary = useMemo(() => summarizeShift(shift, sales, returns), [shift, sales, returns]);
  const [now, setNow] = useState(() => new Date());
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const stats = [
    { label: "Cash sales", value: summary.cashSales, icon: Banknote },
    { label: "Card sales", value: summary.cardSales, icon: CreditCard },
    { label: "QR sales", value: summary.qrSales, icon: QrCode },
    { label: "Cash refunds", value: summary.cashRefunds, icon: RotateCcw, negative: true },
    { label: "Pay-ins", value: summary.payIns, icon: ArrowDownLeft },
    { label: "Pay-outs", value: summary.payOuts, icon: ArrowUpRight, negative: true },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex size-11 items-center justify-center rounded-xl bg-success-soft text-success-foreground">
            <LockOpen className="size-5" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-success ring-2 ring-card" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">{shift.register}</h2>
              <Badge variant="success" dot data-testid="register-status">Register open</Badge>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {user?.name} · opened {formatDateTime(shift.openedAt)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button asChild variant="outline"><Link href="/pos"><ShoppingCart /> Go to POS</Link></Button>
          <Button variant="outline" onClick={() => setAdjustOpen(true)} data-testid="cash-adjust"><Wallet /> Pay in / out</Button>
          <Button variant="destructive-outline" onClick={() => setCloseOpen(true)} className="col-span-2" data-testid="close-register"><Lock /> Close register</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col justify-between gap-5 border-b bg-primary-soft/30 p-5 lg:border-b-0 lg:border-r">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary-soft-foreground"><Vault className="size-3.5" /> Expected cash in drawer</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular sm:text-5xl" data-testid="expected-cash">{formatMoney(summary.expectedCash)}</p>
            <p className="mt-2 text-xs text-muted-foreground">Opening + cash sales − cash refunds + pay-ins − pay-outs</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Fact icon={Clock} label="Duration" value={shiftDuration(shift.openedAt, null, now)} />
            <Fact icon={Banknote} label="Opening" value={formatMoney(summary.openingCash)} />
            <Fact icon={ReceiptText} label="Sales" value={summary.transactions.toLocaleString("en-LK")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><s.icon className="size-3.5" /> {s.label}</p>
              <p className={cn("mt-1.5 text-lg font-semibold tracking-tight tabular", s.value === 0 && "text-muted-foreground", s.negative && s.value > 0 && "text-destructive-foreground")}>
                {s.negative && s.value > 0 ? "-" : ""}{formatMoney(s.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground">
        <span>Total sales this shift: <span className="font-medium text-foreground tabular">{formatMoney(summary.totalSales)}</span></span>
        <span>The POS blocks checkout while your register is closed.</span>
      </div>

      <CashAdjustDialog shift={shift} open={adjustOpen} onOpenChange={setAdjustOpen} />
      <CloseRegisterDialog shift={shift} expected={summary.expectedCash} open={closeOpen} onOpenChange={setCloseOpen} onClosed={onClosed} />
    </Card>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="size-3" /> {label}</p>
      <p className="truncate font-semibold tabular">{value}</p>
    </div>
  );
}

/* ------------------------------ Pay in / out ------------------------------ */

function CashAdjustDialog({ shift, open, onOpenChange }: { shift: Shift; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [type, setType] = useState<"pay_in" | "pay_out">("pay_out");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setType("pay_out");
      setAmount("");
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const parsed = parseRupees(amount);
  const amountError = parsed === null || parsed <= 0 ? "Enter an amount greater than zero." : null;
  const reasonError = reason.trim().length < 3 ? "Add a short reason (at least 3 characters)." : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (amountError || reasonError || parsed === null) return;
    setBusy(true);
    const r = await api.shifts.adjust(shift.id, { type, amount: toCents(parsed), reason: reason.trim() });
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${type === "pay_in" ? "Pay-in" : "Pay-out"} of ${formatMoney(toCents(parsed))} recorded`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent size="sm" data-testid="cash-adjust-dialog">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Pay in / Pay out</DialogTitle>
            <DialogDescription>Record cash added to or removed from the drawer outside of sales.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <FormField label="Type">
              <Select value={type} onValueChange={(v) => setType(v as "pay_in" | "pay_out")}>
                <SelectTrigger data-testid="cash-adjust-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pay_in">Pay in — add cash to drawer</SelectItem>
                  <SelectItem value="pay_out">Pay out — remove cash from drawer</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Amount" htmlFor="adj-amount" required error={touched ? amountError ?? undefined : undefined}>
              <RupeeInput id="adj-amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" aria-invalid={touched && !!amountError} data-testid="cash-adjust-amount" />
            </FormField>
            <FormField label="Reason" htmlFor="adj-reason" required error={touched ? reasonError ?? undefined : undefined}>
              <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={type === "pay_in" ? "e.g. Extra change from safe" : "e.g. Paid delivery helper"} maxLength={120} aria-invalid={touched && !!reasonError} data-testid="cash-adjust-reason" />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy} data-testid="cash-adjust-submit">Record {type === "pay_in" ? "pay-in" : "pay-out"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Close register ----------------------------- */

function CloseRegisterDialog({ shift, expected, open, onOpenChange, onClosed }: { shift: Shift; expected: number; open: boolean; onOpenChange: (v: boolean) => void; onClosed: (id: string) => void }) {
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCounted("");
      setNotes("");
      setTouched(false);
    }
  }, [open]);

  const parsed = parseRupees(counted);
  const error = parsed === null ? "Enter the cash you counted in the drawer." : null;
  const diff = parsed === null ? null : toCents(parsed) - expected;
  const kind = diff === null ? null : differenceKind(diff);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (parsed === null) return;
    setBusy(true);
    const r = await api.shifts.close(shift.id, toCents(parsed), notes.trim(), expected);
    setBusy(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success("Register closed", { description: diff === 0 ? "Drawer balanced." : `Drawer ${kind} by ${formatMoney(Math.abs(diff ?? 0))}.` });
    onOpenChange(false);
    onClosed(r.data.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent size="sm" data-testid="close-register-dialog">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Close register</DialogTitle>
            <DialogDescription>Count the cash in the drawer and enter the total below.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">Expected cash</span>
              <span className="text-lg font-semibold tabular">{formatMoney(expected)}</span>
            </div>
            <FormField label="Counted cash" htmlFor="counted-cash" required error={touched ? error ?? undefined : undefined}>
              <RupeeInput id="counted-cash" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0.00" autoFocus aria-invalid={touched && !!error} data-testid="counted-cash" className="h-11 text-base" />
            </FormField>
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
                kind === "balanced" && "border-success/30 bg-success-soft/60",
                kind === "over" && "border-info/30 bg-info-soft/60",
                kind === "short" && "border-destructive/30 bg-destructive-soft/60",
              )}
              data-testid="cash-difference"
            >
              <span className="text-sm font-medium">Difference</span>
              {diff === null ? <span className="text-sm text-muted-foreground">Enter counted cash</span> : <DifferenceBadge value={diff} large />}
            </div>
            <FormField label="Notes" htmlFor="close-notes" hint={kind === "short" || kind === "over" ? "Explain the difference for your manager." : "Optional"}>
              <Textarea id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Rs 100 note found under drawer tray" className="min-h-16" maxLength={300} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="destructive" loading={busy} data-testid="close-register-submit"><Lock /> Close register</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
