"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Star, UserPlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import { useCartStore } from "@/store/cart-store";
import { api } from "@/mocks/services";
import { useCan } from "@/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/shared/form-field";
import { UserAvatar } from "@/components/ui/avatar";

const PHONE_RE = /^(\+94\s?\d{2}\s?\d{3}\s?\d{4}|0\d{9}|\+?\d[\d\s]{8,14})$/;

/** Attach an existing customer, keep walk-in, or quick-create a customer at the counter. */
export function CustomerPicker() {
  const customers = useAppStore((s) => s.customers);
  const customerId = useCartStore((s) => s.customerId);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const canCreate = useCan("customers.manage");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const selected = customers.find((c) => c.id === customerId) ?? null;

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const active = customers.filter((c) => c.status === "active");
    if (!s) return active.slice(0, 8);
    const digits = s.replace(/\D/g, "");
    return active.filter((c) => c.name.toLowerCase().includes(s) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))).slice(0, 8);
  }, [customers, q]);

  return (
    <>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
        <PopoverTrigger asChild>
          <button type="button" className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2 text-left transition-colors hover:border-ring/40" data-testid="pos-customer">
            {selected ? <UserAvatar name={selected.name} color="var(--chart-2)" className="size-7 text-[10px] ring-0" /> : <span className="flex size-7 items-center justify-center rounded-full bg-muted"><UserRound className="size-3.5 text-muted-foreground" /></span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{selected ? selected.name : "Walk-in customer"}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{selected ? <>{selected.phone} · <Star className="inline size-2.5 -translate-y-px fill-current text-warning" /> {selected.loyaltyPoints} pts</> : "Tap to attach a customer for loyalty points"}</span>
            </span>
            {selected ? (
              <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setCustomer(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setCustomer(null); } }} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Remove customer">
                <X className="size-3.5" />
              </span>
            ) : (
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0">
          <div className="border-b p-2">
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…" data-testid="pos-customer-search" />
          </div>
          <div className="max-h-72 overflow-y-auto p-1 scrollbar-thin">
            <Option active={!customerId} onClick={() => { setCustomer(null); setOpen(false); }} title="Walk-in customer" subtitle="No loyalty points" />
            {results.map((c) => (
              <Option key={c.id} active={c.id === customerId} onClick={() => { setCustomer(c.id); setOpen(false); toast.success(`${c.name} attached`, { duration: 1200 }); }} title={c.name} subtitle={`${c.phone} · ${c.loyaltyPoints} pts`} testId={`pos-customer-option-${c.id}`} />
            ))}
            {results.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matching customers</p>}
          </div>
          {canCreate && (
            <div className="border-t p-2">
              <Button variant="soft" size="sm" className="w-full" onClick={() => { setOpen(false); setCreateOpen(true); }} data-testid="pos-new-customer"><UserPlus />New customer</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <QuickCustomerDialog open={createOpen} onOpenChange={setCreateOpen} initialName={q} />
    </>
  );
}

function Option({ title, subtitle, active, onClick, testId }: { title: string; subtitle: string; active: boolean; onClick: () => void; testId?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} className={cn("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-accent", active && "bg-primary-soft/40")}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      {active && <Check className="size-4 text-primary" />}
    </button>
  );
}

function QuickCustomerDialog({ open, onOpenChange, initialName }: { open: boolean; onOpenChange: (o: boolean) => void; initialName: string }) {
  const setCustomer = useCartStore((s) => s.setCustomer);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(/\d/.test(initialName) ? "" : initialName);
    setPhone(/\d/.test(initialName) ? initialName : "");
    setEmail("");
    setErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Enter the customer's name";
    if (!PHONE_RE.test(phone.trim())) errs.phone = "Enter a valid phone number, e.g. 077 123 4567";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email address";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const r = await api.customers.create({ name: name.trim(), phone: phone.trim(), email: email.trim(), address: "", status: "active" });
    setSaving(false);
    if (!r.ok) {
      setErrors({ phone: r.error });
      return;
    }
    setCustomer(r.data.id);
    toast.success("Customer created and attached", { description: r.data.name });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) reset(); onOpenChange(o); }}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>New customer</DialogTitle>
            <DialogDescription>Quick registration at the counter. More details can be added later.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3.5">
            <FormField label="Full name" htmlFor="qc-name" required error={errors.name}>
              <Input id="qc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} data-testid="qc-name" />
            </FormField>
            <FormField label="Phone" htmlFor="qc-phone" required error={errors.phone}>
              <Input id="qc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="077 123 4567" inputMode="tel" aria-invalid={!!errors.phone} data-testid="qc-phone" />
            </FormField>
            <FormField label="Email" htmlFor="qc-email" error={errors.email} hint="Optional">
              <Input id="qc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={saving} data-testid="qc-submit">Create & attach</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
