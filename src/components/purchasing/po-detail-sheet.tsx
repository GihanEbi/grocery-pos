"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, CalendarDays, Check, CheckCircle2, CircleDashed, FilePlus2, Mail, PackageCheck, Pencil, Phone, Sparkles, Truck, User as UserIcon, XCircle } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POStatusBadge } from "@/components/shared/status-badges";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useCan, useCategoryMap, useCurrentUser, useProductMap, useSupplierMap, useUserMap } from "@/hooks";
import { useAppStore } from "@/store/app-store";
import { api } from "@/mocks/services";
import { formatDate, formatDateTime, formatQty } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { lineCost, poReceivedUnits, poTotal, poUnits } from "./po-utils";
import { ReceiveDialog } from "./receive-dialog";

export function PODetailSheet({ poId, open, onOpenChange }: { poId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const po = useAppStore((s) => (poId ? s.purchaseOrders.find((p) => p.id === poId) ?? null : null));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="lg" data-testid="po-detail" aria-describedby={undefined}>
        {po ? (
          <PODetailBody poId={po.id} onClose={() => onOpenChange(false)} />
        ) : (
          <>
            <SheetHeader><SheetTitle>Purchase order</SheetTitle></SheetHeader>
            <SheetBody>
              <EmptyState icon={FilePlus2} title="Purchase order not found" description="It may have been removed when the demo data was reset." />
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PODetailBody({ poId, onClose }: { poId: string; onClose: () => void }) {
  const po = useAppStore((s) => s.purchaseOrders.find((p) => p.id === poId))!;
  const supplierMap = useSupplierMap();
  const productMap = useProductMap();
  const categoryMap = useCategoryMap();
  const userMap = useUserMap();
  const user = useCurrentUser();
  const canManage = useCan("purchasing.manage");
  const canApprove = useCan("purchasing.approve");
  const confirm = useConfirm();
  const [busy, setBusy] = React.useState<null | "approve" | "cancel">(null);
  const [receiveOpen, setReceiveOpen] = React.useState(false);

  const supplier = supplierMap.get(po.supplierId);
  const total = poTotal(po);
  const units = poUnits(po);
  const received = poReceivedUnits(po);
  const progress = units > 0 ? Math.min(100, Math.round((received / units) * 100)) : 0;

  async function approve() {
    if (!user) return;
    const ok = await confirm({
      title: `Approve ${po.poNumber}?`,
      description: <>This confirms the order of <strong>{po.items.length} item{po.items.length === 1 ? "" : "s"}</strong> worth <Money value={total} className="font-semibold" /> from {supplier?.name ?? "the supplier"}. Approved orders can no longer be edited.</>,
      confirmLabel: "Approve order",
    });
    if (!ok) return;
    setBusy("approve");
    const r = await api.purchasing.approve(po.id, user.id);
    setBusy(null);
    if (r.ok) toast.success(`${po.poNumber} approved`, { description: "Receive the stock when the supplier delivers." });
    else toast.error(r.error);
  }

  async function cancel() {
    const ok = await confirm({
      title: `Cancel ${po.poNumber}?`,
      description: "The order will be marked as cancelled and can't be received or edited. This can't be undone.",
      confirmLabel: "Cancel order",
      cancelLabel: "Keep order",
      tone: "destructive",
    });
    if (!ok) return;
    setBusy("cancel");
    const r = await api.purchasing.cancel(po.id);
    setBusy(null);
    if (r.ok) toast.success(`${po.poNumber} cancelled`);
    else toast.error(r.error);
  }

  type Step = { key: string; label: string; date: string | null; by?: string; state: "done" | "current" | "todo" | "cancelled" };
  const steps: Step[] = [{ key: "created", label: "Created", date: po.createdAt, by: userMap.get(po.createdBy)?.name, state: "done" }];
  const approvedBy = po.approvedBy ? userMap.get(po.approvedBy)?.name : undefined;
  if (po.status === "cancelled") {
    if (po.approvedAt) steps.push({ key: "approved", label: "Approved", date: po.approvedAt, by: approvedBy, state: "done" });
    steps.push({ key: "cancelled", label: "Cancelled", date: null, state: "cancelled" });
  } else {
    steps.push({ key: "approved", label: "Approved", date: po.approvedAt, by: approvedBy, state: po.approvedAt ? "done" : "current" });
    steps.push({
      key: "received",
      label: po.status === "partially_received" ? `Partly received · ${progress}%` : "Received",
      date: po.receivedAt,
      state: po.status === "received" ? "done" : po.status === "draft" ? "todo" : "current",
    });
  }

  const actions: React.ReactNode[] = [];
  if (po.status === "draft") {
    if (canManage)
      actions.push(
        <Button key="cancel" variant="destructive-outline" onClick={cancel} loading={busy === "cancel"} disabled={!!busy} data-testid="po-cancel"><Ban /> Cancel</Button>,
        <Button key="edit" variant="outline" asChild><Link href={`/purchasing/new?edit=${po.id}`}><Pencil /> Edit</Link></Button>,
      );
    if (canApprove)
      actions.push(<Button key="approve" onClick={approve} loading={busy === "approve"} disabled={!!busy} data-testid="po-approve"><CheckCircle2 /> Approve</Button>);
  } else if (po.status === "approved" || po.status === "partially_received") {
    if (canManage && po.status === "approved")
      actions.push(<Button key="cancel" variant="destructive-outline" onClick={cancel} loading={busy === "cancel"} disabled={!!busy} data-testid="po-cancel"><Ban /> Cancel</Button>);
    if (canManage)
      actions.push(<Button key="receive" onClick={() => setReceiveOpen(true)} disabled={!!busy} data-testid="po-receive"><PackageCheck /> Receive stock</Button>);
  }

  return (
    <>
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className="font-mono text-lg">{po.poNumber}</SheetTitle>
          <POStatusBadge status={po.status} />
          {po.source === "ai" && <Badge variant="info"><Sparkles /> AI suggested</Badge>}
        </div>
        <SheetDescription>
          Created {formatDateTime(po.createdAt)}
          {po.expectedDate && <> · expected {formatDate(po.expectedDate)}</>}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="space-y-5">
        {/* Supplier */}
        <section className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground"><Truck className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Supplier</p>
              <p className="truncate font-semibold">{supplier?.name ?? "Unknown supplier"}</p>
              {supplier && (
                <div className="mt-2 grid gap-1.5 text-[13px] text-muted-foreground sm:grid-cols-2">
                  {supplier.contactPerson && <span className="flex items-center gap-1.5 truncate"><UserIcon className="size-3.5 shrink-0" />{supplier.contactPerson}</span>}
                  {supplier.phone && <a href={`tel:${supplier.phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 truncate hover:text-foreground"><Phone className="size-3.5 shrink-0" />{supplier.phone}</a>}
                  {supplier.email && <a href={`mailto:${supplier.email}`} className="flex items-center gap-1.5 truncate hover:text-foreground sm:col-span-2"><Mail className="size-3.5 shrink-0" />{supplier.email}</a>}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section>
          <h3 className="mb-3 text-sm font-semibold">Progress</h3>
          <ol className={cn("grid gap-2", steps.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {steps.map((s, i) => (
              <li key={s.key} className="relative">
                {i < steps.length - 1 && (
                  <span className={cn("absolute left-[calc(50%+16px)] right-[calc(-50%+8px)] top-3.5 h-0.5 rounded-full", steps[i + 1].state === "todo" ? "bg-border" : steps[i + 1].state === "cancelled" ? "bg-destructive/40" : "bg-primary/60")} />
                )}
                <div className="flex flex-col items-center text-center">
                  <span
                    className={cn(
                      "relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-card",
                      s.state === "done" && "border-primary bg-primary text-primary-foreground",
                      s.state === "current" && "border-primary text-primary",
                      s.state === "todo" && "border-border text-muted-foreground",
                      s.state === "cancelled" && "border-destructive bg-destructive text-white",
                    )}
                  >
                    {s.state === "done" ? <Check className="size-3.5" /> : s.state === "cancelled" ? <XCircle className="size-3.5" /> : <CircleDashed className="size-3.5" />}
                  </span>
                  <p className="mt-2 text-[13px] font-medium leading-tight">{s.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular">{s.date ? formatDate(s.date) : s.state === "cancelled" ? "Order closed" : "Pending"}</p>
                  {s.by && <p className="text-[11px] text-muted-foreground">by {s.by}</p>}
                </div>
              </li>
            ))}
          </ol>
          {(po.status === "approved" || po.status === "partially_received" || po.status === "received") && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground tabular">
                <span>Received {formatQty(received)} of {formatQty(units)} units</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </section>

        {/* Items */}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Items <span className="font-normal text-muted-foreground">({po.items.length})</span></h3>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="first:pl-3">Product</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right last:pr-3">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((item) => {
                  const p = productMap.get(item.productId);
                  const complete = item.receivedQty >= item.quantity;
                  return (
                    <TableRow key={item.productId} className="hover:bg-transparent">
                      <TableCell className="first:pl-3">
                        <div className="flex min-w-44 items-center gap-2.5">
                          <ProductThumb image={p?.image ?? "📦"} name={p?.name ?? "Product"} color={p ? categoryMap.get(p.categoryId)?.color : undefined} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{p?.name ?? "Removed product"}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{p?.sku}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular whitespace-nowrap">{formatQty(item.quantity, p?.unit)}</TableCell>
                      <TableCell className={cn("text-right tabular whitespace-nowrap", complete ? "text-success-foreground" : item.receivedQty > 0 ? "text-warning-foreground" : "text-muted-foreground")}>
                        {formatQty(item.receivedQty, p?.unit)}
                      </TableCell>
                      <TableCell className="text-right"><Money value={item.unitCost} muted /></TableCell>
                      <TableCell className="text-right font-medium last:pr-3"><Money value={lineCost(item)} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <dl className="mt-3 space-y-1.5 rounded-xl border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between text-muted-foreground"><dt>Line items</dt><dd className="tabular">{po.items.length}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>Total units</dt><dd className="tabular">{formatQty(units)}</dd></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total cost</dt><dd><Money value={total} /></dd></div>
          </dl>
        </section>

        {/* Notes */}
        <section>
          <h3 className="mb-2 text-sm font-semibold">Notes</h3>
          {po.notes ? (
            <p className="whitespace-pre-wrap rounded-xl border bg-card p-3 text-[13px] text-foreground/90">{po.notes}</p>
          ) : (
            <p className="text-[13px] text-muted-foreground">No notes for this order.</p>
          )}
        </section>

        {po.expectedDate && (po.status === "approved" || po.status === "partially_received") && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> Supplier delivery expected {formatDate(po.expectedDate)}</p>
        )}
      </SheetBody>

      <SheetFooter className="flex-wrap">
        {actions.length > 0 ? (
          actions
        ) : (
          <Button variant="outline" onClick={onClose}>Close</Button>
        )}
      </SheetFooter>

      {(po.status === "approved" || po.status === "partially_received") && <ReceiveDialog po={po} open={receiveOpen} onOpenChange={setReceiveOpen} />}
    </>
  );
}
