"use client";

import Link from "next/link";
import { CalendarDays, Gift, Mail, MapPin, Pencil, Phone, ReceiptText, ShoppingBasket, Wallet } from "lucide-react";
import type { Customer } from "@/types";
import { useCan } from "@/hooks";
import { formatDate, formatMoney, formatRelative } from "@/lib/formatting";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { SaleStatusBadge } from "@/components/shared/status-badges";
import type { CustomerStats } from "./customer-stats";

export function CustomerProfileSheet({
  customer,
  stats,
  open,
  onOpenChange,
  onEdit,
}: {
  customer: Customer | null;
  stats: CustomerStats;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: (c: Customer) => void;
}) {
  const canManage = useCan("customers.manage");
  const recent = stats.sales.slice(0, 10);
  const avgBasket = stats.purchases ? Math.round(stats.spending / stats.purchases) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="lg" data-testid="customer-profile">
        {customer && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <UserAvatar name={customer.name} className="size-11 text-sm ring-0" />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{customer.name}</SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px]">{customer.id}</span>
                    <Badge variant={customer.status === "active" ? "success" : "secondary"} dot>{customer.status === "active" ? "Active" : "Inactive"}</Badge>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <section>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact</h3>
                <ul className="space-y-2 rounded-xl border p-3.5 text-sm">
                  <InfoRow icon={Phone}><a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="hover:underline">{customer.phone}</a></InfoRow>
                  <InfoRow icon={Mail}>{customer.email ? <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a> : <span className="text-muted-foreground">No email</span>}</InfoRow>
                  <InfoRow icon={MapPin}>{customer.address || <span className="text-muted-foreground">No address</span>}</InfoRow>
                  <InfoRow icon={CalendarDays}>Customer since {formatDate(customer.createdAt)}</InfoRow>
                </ul>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <Tile icon={Wallet} label="Total spending" value={formatMoney(stats.spending)} hint={stats.refunds ? `after ${formatMoney(stats.refunds)} refunds` : "net of refunds"} />
                <Tile icon={ShoppingBasket} label="Visits" value={stats.purchases.toLocaleString("en-LK")} hint={stats.lastVisit ? `last ${formatRelative(stats.lastVisit)}` : "no purchases yet"} />
                <Tile icon={ReceiptText} label="Avg basket" value={formatMoney(avgBasket)} hint="per visit" />
                <Tile icon={Gift} label="Loyalty points" value={customer.loyaltyPoints.toLocaleString("en-LK")} hint="current balance" accent />
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent purchases</h3>
                  {stats.purchases > recent.length && <span className="text-xs text-muted-foreground">Latest {recent.length} of {stats.purchases}</span>}
                </div>
                {recent.length === 0 ? (
                  <div className="rounded-xl border">
                    <EmptyState compact icon={ShoppingBasket} title="No purchases yet" description="Sales linked to this customer at checkout will appear here." />
                  </div>
                ) : (
                  <ul className="divide-y rounded-xl border" data-testid="customer-purchases">
                    {recent.map((s) => (
                      <li key={s.id}>
                        <Link href={`/sales/${s.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/40">
                          <div className="min-w-0">
                            <p className="font-mono text-[13px] font-medium text-primary">{s.receiptNo}</p>
                            <p className="text-xs text-muted-foreground">{formatRelative(s.date)} · {s.items.length} item{s.items.length === 1 ? "" : "s"}</p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Money value={s.total} className="text-sm font-medium" />
                            {s.status !== "completed" && <SaleStatusBadge status={s.status} />}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              {canManage && (
                <Button onClick={() => onEdit(customer)} data-testid="customer-edit"><Pencil /> Edit</Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof Phone; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

function Tile({ icon: Icon, label, value, hint, accent }: { icon: typeof Phone; label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-xl border border-primary/20 bg-primary-soft/50 p-3.5" : "rounded-xl border bg-card p-3.5"}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
      <p className="mt-1.5 truncate text-lg font-semibold tracking-tight tabular">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
