"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, ClipboardList, FilePlus2, Mail, MapPin, Package, Pencil, Phone, User as UserIcon } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Money } from "@/components/shared/money";
import { POStatusBadge, StockStatusBadge } from "@/components/shared/status-badges";
import { useCan, useCategoryMap } from "@/hooks";
import { useAppStore } from "@/store/app-store";
import { stockStatus } from "@/lib/calculations/inventory";
import { formatDate, formatQty } from "@/lib/formatting";
import { OPEN_PO_STATUSES, poReceivedValue, poTotal } from "@/components/purchasing/po-utils";

const statusRank = { out_of_stock: 0, low_stock: 1, in_stock: 2 } as const;

export function SupplierDetailSheet({ supplierId, open, onOpenChange, onEdit }: { supplierId: string | null; open: boolean; onOpenChange: (o: boolean) => void; onEdit: (id: string) => void }) {
  const supplier = useAppStore((s) => (supplierId ? s.suppliers.find((x) => x.id === supplierId) ?? null : null));
  const allProducts = useAppStore((s) => s.products);
  const allPOs = useAppStore((s) => s.purchaseOrders);
  const categoryMap = useCategoryMap();
  const canManage = useCan("suppliers.manage");
  const canOrder = useCan("purchasing.manage");
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => setShowAll(false), [supplierId]);

  const products = React.useMemo(
    () =>
      allProducts
        .filter((p) => p.supplierId === supplierId && p.status !== "archived")
        .sort((a, b) => statusRank[stockStatus(a.stock, a.minStock)] - statusRank[stockStatus(b.stock, b.minStock)] || a.name.localeCompare(b.name)),
    [allProducts, supplierId],
  );
  const pos = React.useMemo(() => allPOs.filter((p) => p.supplierId === supplierId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [allPOs, supplierId]);
  const openPOs = pos.filter((p) => OPEN_PO_STATUSES.includes(p.status)).length;
  const purchased = pos.reduce((a, p) => a + poReceivedValue(p), 0);
  const needReorder = products.filter((p) => stockStatus(p.stock, p.minStock) !== "in_stock");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="lg" data-testid="supplier-detail">
        {supplier && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-lg">{supplier.name}</SheetTitle>
                <Badge variant={supplier.status === "active" ? "success" : "secondary"} dot>{supplier.status === "active" ? "Active" : "Inactive"}</Badge>
              </div>
              <SheetDescription className="font-mono">ID {supplier.id} · supplier since {formatDate(supplier.createdAt)}</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <section className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <Detail icon={UserIcon} label="Contact person" value={supplier.contactPerson || "—"} />
                <Detail icon={Phone} label="Phone" value={<a className="hover:underline" href={`tel:${supplier.phone.replace(/\s/g, "")}`}>{supplier.phone}</a>} />
                <Detail icon={Mail} label="Email" value={supplier.email ? <a className="break-all hover:underline" href={`mailto:${supplier.email}`}>{supplier.email}</a> : "—"} />
                <Detail icon={CalendarClock} label="Lead time" value={`${supplier.leadTimeDays} day${supplier.leadTimeDays === 1 ? "" : "s"}`} />
                <Detail icon={MapPin} label="Address" value={supplier.address || "—"} className="sm:col-span-2" />
              </section>

              <section className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Products" value={products.length} />
                <Stat label="Open POs" value={openPOs} />
                <Stat label="Received value" value={<Money value={purchased} className="text-sm" />} />
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Products <span className="font-normal text-muted-foreground">({products.length})</span></h3>
                  {needReorder.length > 0 && <Badge variant="warning">{needReorder.length} need reorder</Badge>}
                </div>
                {products.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-center text-[13px] text-muted-foreground">No products are linked to this supplier yet. Set the supplier on a product to associate it.</p>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {(showAll ? products : products.slice(0, 8)).map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                        <ProductThumb image={p.image} name={p.name} color={categoryMap.get(p.categoryId)?.color} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground tabular">{formatQty(p.stock, p.unit)} in stock · min {formatQty(p.minStock)}</p>
                        </div>
                        <StockStatusBadge status={stockStatus(p.stock, p.minStock)} />
                      </li>
                    ))}
                  </ul>
                )}
                {products.length > 8 && (
                  <Button variant="link" size="sm" className="mt-2 h-auto" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? "Show fewer" : `Show all ${products.length} products`}
                  </Button>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Recent purchase orders</h3>
                {pos.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-4 text-center text-[13px] text-muted-foreground">No purchase orders with this supplier yet.</p>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {pos.slice(0, 6).map((po) => (
                      <li key={po.id}>
                        <Link href={`/purchasing?po=${po.id}`} className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50">
                          <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[13px] font-medium">{po.poNumber}</p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(po.createdAt)} · {po.items.length} item{po.items.length === 1 ? "" : "s"}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Money value={poTotal(po)} className="text-[13px] font-medium" />
                            <POStatusBadge status={po.status} />
                          </div>
                          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </SheetBody>
            <SheetFooter className="flex-wrap">
              {canManage && (
                <Button variant="outline" onClick={() => onEdit(supplier.id)}><Pencil /> Edit</Button>
              )}
              {canOrder && supplier.status === "active" && (
                <Button asChild><Link href={`/purchasing/new?supplier=${supplier.id}`}><FilePlus2 /> New purchase order</Link></Button>
              )}
              {!canManage && !(canOrder && supplier.status === "active") && <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>}
            </SheetFooter>
          </>
        )}
        {!supplier && (
          <SheetHeader><SheetTitle>Supplier not found</SheetTitle></SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Detail({ icon: Icon, label, value, className }: { icon: typeof Package; label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card px-2 py-3 shadow-soft">
      <div className="text-lg font-semibold tabular">{value}</div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
