"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CloudOff, CreditCard, FileSearch, QrCode, ReceiptText, Undo2, UserRound, WifiOff } from "lucide-react";
import type { Sale } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCan, useCustomerMap, useUserMap } from "@/hooks";
import { returnableQty } from "@/lib/calculations/returns";
import { formatDateTime, formatMoney, formatPercent, formatQty, formatRelative, paymentMethodLabel } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Money } from "@/components/shared/money";
import { PaymentBadge, SaleStatusBadge } from "@/components/shared/status-badges";
import { Receipt, PrintButton } from "@/components/shared/receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/avatar";
import { ReturnDialog } from "./return-dialog";
import { reasonLabel, saleRefunded } from "./sales-utils";

const payIcon = { cash: Banknote, card: CreditCard, qr: QrCode };

export function SaleDetail({ id }: { id: string }) {
  const hydrated = useAppStore((s) => s.hydrated);
  const sale = useAppStore((s) => s.sales.find((x) => x.id === id) ?? null);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="rounded-xl border bg-card shadow-soft">
        <EmptyState
          icon={FileSearch}
          title="Transaction not found"
          description="This sale may have been removed when the demo data was reset, or the link is incorrect."
          action={<Button asChild variant="outline"><Link href="/sales"><ArrowLeft /> Back to sales</Link></Button>}
        />
      </div>
    );
  }

  return <SaleDetailView sale={sale} />;
}

function SaleDetailView({ sale }: { sale: Sale }) {
  const canRefund = useCan("sales.refund");
  const customerMap = useCustomerMap();
  const userMap = useUserMap();
  const shift = useAppStore((s) => (sale.shiftId ? s.shifts.find((x) => x.id === sale.shiftId) ?? null : null));
  const allReturns = useAppStore((s) => s.returns);
  const returns = allReturns.filter((r) => r.saleId === sale.id);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const customer = sale.customerId ? customerMap.get(sale.customerId) ?? null : null;
  const cashier = userMap.get(sale.cashierId);
  const refunded = saleRefunded(sale);
  const returnable = sale.items.some((i) => returnableQty(i) > 0);
  const itemDisc = sale.itemDiscountTotal;
  const billDisc = sale.billDiscount?.amount ?? 0;
  const cashTendered = sale.payments.find((p) => p.method === "cash")?.tendered;

  const returnButton = (
    <Button onClick={() => setReturnOpen(true)} disabled={!returnable || !canRefund} data-testid="return-open">
      <Undo2 /> Process return
    </Button>
  );

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Sales & Returns", href: "/sales" }, { label: sale.receiptNo }]}
        title={sale.receiptNo}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <SaleStatusBadge status={sale.status} />
            <span>{formatDateTime(sale.date)}</span>
            {sale.offline && (
              <Badge variant={sale.synced ? "info" : "warning"}>
                {sale.synced ? <WifiOff /> : <CloudOff />} {sale.synced ? "Offline sale · synced" : "Offline · pending sync"}
              </Badge>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setReceiptOpen(true)} data-testid="view-receipt"><ReceiptText /> View receipt</Button>
            {!canRefund ? (
              <Tooltip content="You don't have permission to process refunds."><span>{returnButton}</span></Tooltip>
            ) : !returnable ? (
              <Tooltip content="Every item on this sale has already been returned."><span>{returnButton}</span></Tooltip>
            ) : (
              returnButton
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Items */}
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Items</CardTitle>
                <CardDescription>{sale.items.length} line{sale.items.length === 1 ? "" : "s"} · prices frozen at time of sale</CardDescription>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Discounts</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Line total</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((it) => {
                  const disc = it.itemDiscount + it.billDiscountShare;
                  return (
                    <TableRow key={it.productId} className="hover:bg-transparent">
                      <TableCell>
                        <p className="min-w-40 font-medium">{it.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{it.sku}</p>
                      </TableCell>
                      <TableCell className="text-right tabular whitespace-nowrap">{formatQty(it.quantity, it.unit)}</TableCell>
                      <TableCell className="text-right"><Money value={it.unitPrice} /></TableCell>
                      <TableCell className="text-right">{disc > 0 ? <Money value={-disc} className="text-success-foreground" /> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right">
                        {it.taxAmount > 0 ? (
                          <span className="whitespace-nowrap"><Money value={it.taxAmount} /> <span className="text-[11px] text-muted-foreground">({formatPercent(it.taxRateBps)})</span></span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right"><Money value={it.lineTotal} className="font-medium" /></TableCell>
                      <TableCell className="text-right">
                        {it.returnedQty > 0 ? (
                          <Badge variant={it.returnedQty >= it.quantity ? "destructive" : "warning"}>{formatQty(it.returnedQty, it.unit)}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Returns history */}
          <Card>
            <CardHeader>
              <CardTitle>Returns history</CardTitle>
              <CardDescription>Returns and refunds recorded against this receipt.</CardDescription>
            </CardHeader>
            <CardContent>
              {returns.length === 0 ? (
                <EmptyState compact icon={Undo2} title="No returns yet" description={returnable ? "Use “Process return” to refund items from this sale." : undefined} />
              ) : (
                <ul className="space-y-3" data-testid="returns-history">
                  {returns.map((r) => (
                    <li key={r.id} className="rounded-xl border p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold">
                            <span className="font-mono">{r.returnNo}</span>
                            <Badge variant="secondary">{reasonLabel(r.reason)}</Badge>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatRelative(r.date)} · by {userMap.get(r.userId)?.name ?? "—"} · refunded via {paymentMethodLabel[r.refundMethod]}
                          </p>
                        </div>
                        <Money value={-r.refundAmount} className="font-semibold text-destructive-foreground" />
                      </div>
                      <ul className="mt-2.5 space-y-1 text-sm">
                        {r.items.map((i) => (
                          <li key={i.productId} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate">
                              {i.name} <span className="text-muted-foreground">× {formatQty(i.quantity)}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <Badge variant={i.restocked ? "success" : "outline"}>{i.restocked ? "Restocked" : "Not restocked"}</Badge>
                              <Money value={i.refundAmount} muted />
                            </span>
                          </li>
                        ))}
                      </ul>
                      {r.notes && <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">“{r.notes}”</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Summary */}
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                {customer ? (
                  <UserAvatar name={customer.name} className="size-9 ring-0" color="var(--primary)" />
                ) : (
                  <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-4" /></span>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  {customer ? (
                    <Link href={`/customers?id=${customer.id}`} className="font-medium text-primary underline-offset-4 hover:underline">{customer.name}</Link>
                  ) : (
                    <p className="font-medium">Walk-in customer</p>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
                <dt className="text-muted-foreground">Cashier</dt>
                <dd className="text-right font-medium">{cashier?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Shift</dt>
                <dd className="text-right">{shift ? `${shift.register} · ${formatRelative(shift.openedAt)}` : "—"}</dd>
                <dt className="text-muted-foreground">Payment</dt>
                <dd className="flex justify-end"><PaymentBadge methods={sale.payments.filter((p) => p.amount > 0).map((p) => p.method)} /></dd>
                {sale.loyaltyEarned > 0 && (
                  <>
                    <dt className="text-muted-foreground">Loyalty earned</dt>
                    <dd className="text-right font-medium">+{sale.loyaltyEarned} pts</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Mode</dt>
                <dd className="text-right">{sale.offline ? (sale.synced ? "Offline · synced" : "Offline · pending sync") : "Online"}</dd>
              </dl>
              <div className="rounded-xl border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Payments</p>
                <ul className="space-y-1.5">
                  {sale.payments.map((p, i) => {
                    const Icon = payIcon[p.method];
                    return (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5 text-muted-foreground" /> {paymentMethodLabel[p.method]}
                          {p.reference && <span className="font-mono text-[11px] text-muted-foreground">{p.reference}</span>}
                        </span>
                        <Money value={p.amount} className="font-medium" />
                      </li>
                    );
                  })}
                  {cashTendered !== undefined && (
                    <li className="flex items-center justify-between gap-3 text-muted-foreground">
                      <span className="pl-5.5">Cash tendered</span>
                      <Money value={cashTendered} />
                    </li>
                  )}
                  {sale.change > 0 && (
                    <li className="flex items-center justify-between gap-3 text-muted-foreground">
                      <span className="pl-5.5">Change given</span>
                      <Money value={sale.change} />
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <TotalRow label="Subtotal" value={sale.subtotal + itemDisc} />
                <TotalRow label="Item discounts" value={-itemDisc} tone={itemDisc > 0 ? "success" : undefined} />
                <TotalRow
                  label={`Bill discount${sale.billDiscount?.type === "percent" ? ` (${formatPercent(sale.billDiscount.value)})` : ""}`}
                  value={-billDisc}
                  tone={billDisc > 0 ? "success" : undefined}
                />
                <TotalRow label="Tax" value={sale.taxTotal} />
                <div className="flex items-center justify-between border-t pt-2.5 text-base font-semibold">
                  <dt>Total</dt>
                  <dd><Money value={sale.total} /></dd>
                </div>
                <TotalRow label="Refunded so far" value={-refunded} tone={refunded > 0 ? "destructive" : undefined} />
                <div className="flex items-center justify-between rounded-lg bg-primary-soft/60 px-3 py-2 font-semibold text-primary-soft-foreground">
                  <dt>Net amount</dt>
                  <dd><Money value={sale.total - refunded} /></dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent size="sm" data-testid="receipt-dialog">
          <DialogHeader>
            <DialogTitle>Receipt {sale.receiptNo}</DialogTitle>
            <DialogDescription>Reprint copy · {formatMoney(sale.total)}</DialogDescription>
          </DialogHeader>
          <DialogBody className="bg-muted/40">
            <Receipt sale={sale} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptOpen(false)}>Close</Button>
            <PrintButton label="Reprint receipt" data-testid="print-receipt" />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canRefund && <ReturnDialog sale={sale} open={returnOpen} onOpenChange={setReturnOpen} />}
    </div>
  );
}

function TotalRow({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Money
          value={value || 0}
          className={cn(tone === "success" && "text-success-foreground", tone === "destructive" && "text-destructive-foreground", !tone && value === 0 && "text-muted-foreground")}
        />
      </dd>
    </div>
  );
}
