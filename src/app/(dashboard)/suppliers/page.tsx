"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, ClipboardList, FilePlus2, Mail, MoreHorizontal, Package, Pencil, Phone, Plus, Power, PowerOff, Truck, User as UserIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SupplierFormSheet } from "@/components/suppliers/supplier-form-sheet";
import { SupplierDetailSheet } from "@/components/suppliers/supplier-detail-sheet";
import { OPEN_PO_STATUSES } from "@/components/purchasing/po-utils";
import { useCan, useDebounced, useMediaQuery } from "@/hooks";
import { useAppStore } from "@/store/app-store";
import { api } from "@/mocks/services";
import { formatNumber } from "@/lib/formatting";
import type { Supplier } from "@/types";

type StatusFilter = "all" | "active" | "inactive";
interface Row extends Supplier {
  productCount: number;
  openPOs: number;
}

export default function SuppliersPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const suppliers = useAppStore((s) => s.suppliers);
  const products = useAppStore((s) => s.products);
  const purchaseOrders = useAppStore((s) => s.purchaseOrders);
  const canManage = useCan("suppliers.manage");
  const canOrder = useCan("purchasing.manage");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const q = useDebounced(query).trim().toLowerCase();

  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | null>(null);
  const [toggling, setToggling] = React.useState<string | null>(null);

  const rows: Row[] = React.useMemo(() => {
    const productCount = new Map<string, number>();
    for (const p of products) if (p.supplierId && p.status !== "archived") productCount.set(p.supplierId, (productCount.get(p.supplierId) ?? 0) + 1);
    const openCount = new Map<string, number>();
    for (const po of purchaseOrders) if (OPEN_PO_STATUSES.includes(po.status)) openCount.set(po.supplierId, (openCount.get(po.supplierId) ?? 0) + 1);
    return suppliers.map((s) => ({ ...s, productCount: productCount.get(s.id) ?? 0, openPOs: openCount.get(s.id) ?? 0 }));
  }, [suppliers, products, purchaseOrders]);

  const filtered = React.useMemo(
    () =>
      rows
        .filter((r) => (status === "all" ? true : r.status === status))
        .filter((r) => !q || [r.name, r.contactPerson, r.phone, r.email].some((f) => f.toLowerCase().includes(q))),
    [rows, status, q],
  );

  const kpis = React.useMemo(() => {
    const active = rows.filter((r) => r.status === "active");
    return {
      active: active.length,
      inactive: rows.length - active.length,
      openPOs: rows.reduce((a, r) => a + r.openPOs, 0),
      linked: rows.reduce((a, r) => a + r.productCount, 0),
      avgLead: active.length ? Math.round((active.reduce((a, r) => a + r.leadTimeDays, 0) / active.length) * 10) / 10 : 0,
    };
  }, [rows]);

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };
  const openForm = React.useCallback((s: Supplier | null) => {
    setEditing(s);
    setFormOpen(true);
  }, []);

  const toggleStatus = React.useCallback(
    async (s: Row) => {
      const deactivate = s.status === "active";
      const ok = await confirm({
        title: deactivate ? `Deactivate ${s.name}?` : `Activate ${s.name}?`,
        description: deactivate
          ? <>Inactive suppliers can&apos;t be selected on new purchase orders.{s.openPOs > 0 && <> Their <strong>{s.openPOs} open order{s.openPOs === 1 ? "" : "s"}</strong> stay unchanged and can still be received.</>}</>
          : "The supplier will be available again for new purchase orders.",
        confirmLabel: deactivate ? "Deactivate" : "Activate",
        tone: deactivate ? "destructive" : "default",
      });
      if (!ok) return;
      setToggling(s.id);
      const r = await api.suppliers.update(s.id, { status: deactivate ? "inactive" : "active" });
      setToggling(null);
      if (r.ok) toast.success(deactivate ? "Supplier deactivated" : "Supplier activated", { description: s.name });
      else toast.error(r.error);
    },
    [confirm],
  );

  const rowActions = React.useCallback(
    (s: Row) => {
      if (!canManage && !canOrder) return null;
      return (
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`} disabled={toggling === s.id} data-testid={`supplier-actions-${s.id}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {canManage && (
                <DropdownMenuItem onSelect={() => openForm(s)}><Pencil /> Edit</DropdownMenuItem>
              )}
              {canOrder && (
                <DropdownMenuItem disabled={s.status !== "active"} onSelect={() => router.push(`/purchasing/new?supplier=${s.id}`)}><FilePlus2 /> New purchase order</DropdownMenuItem>
              )}
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive={s.status === "active"} onSelect={() => toggleStatus(s)}>
                    {s.status === "active" ? <><PowerOff /> Deactivate</> : <><Power /> Activate</>}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    [canManage, canOrder, openForm, router, toggleStatus, toggling],
  );

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Supplier",
        cell: ({ row }) => (
          <div className="flex min-w-48 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground"><Truck className="size-4" /></span>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="truncate text-xs text-muted-foreground">{row.original.contactPerson || "No contact person"}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: "phone", header: "Phone", cell: ({ row }) => <span className="whitespace-nowrap tabular">{row.original.phone}</span> },
      { accessorKey: "email", header: "Email", cell: ({ row }) => <span className="block max-w-52 truncate text-muted-foreground">{row.original.email || "—"}</span>, meta: { className: "hidden xl:table-cell" } },
      { accessorKey: "productCount", header: "Products", cell: ({ row }) => <span className="tabular">{row.original.productCount}</span>, meta: { align: "right" } },
      {
        accessorKey: "openPOs",
        header: "Open POs",
        cell: ({ row }) => (row.original.openPOs > 0 ? <Badge variant="info" className="tabular">{row.original.openPOs}</Badge> : <span className="text-muted-foreground">0</span>),
        meta: { align: "right" },
      },
      { accessorKey: "leadTimeDays", header: "Lead time", cell: ({ row }) => <span className="whitespace-nowrap tabular">{row.original.leadTimeDays} day{row.original.leadTimeDays === 1 ? "" : "s"}</span>, meta: { align: "right", className: "hidden lg:table-cell" } },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={row.original.status === "active" ? "success" : "secondary"} dot>{row.original.status === "active" ? "Active" : "Inactive"}</Badge>,
      },
      { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, cell: ({ row }) => rowActions(row.original), meta: { align: "right" } },
    ],
    [rowActions],
  );

  const filtersActive = !!q || status !== "all";
  const empty = (
    <EmptyState
      icon={Truck}
      title={filtersActive ? "No suppliers match" : "No suppliers yet"}
      description={filtersActive ? "Try a different search or status filter." : "Add the suppliers you buy stock from."}
      action={
        filtersActive ? (
          <Button size="sm" variant="outline" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</Button>
        ) : canManage ? (
          <Button size="sm" onClick={() => openForm(null)}><Plus /> Add supplier</Button>
        ) : undefined
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Manage who you buy from, their contact details and linked products."
        actions={
          canManage && (
            <Button onClick={() => openForm(null)} data-testid="add-supplier"><Plus /> Add supplier</Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active suppliers" value={formatNumber(kpis.active)} icon={Truck} tone="primary" hint={kpis.inactive ? `${kpis.inactive} inactive` : "All suppliers active"} />
        <KpiCard label="Open purchase orders" value={formatNumber(kpis.openPOs)} icon={ClipboardList} tone="info" hint="Draft, approved & partially received" href="/purchasing" />
        <KpiCard label="Linked products" value={formatNumber(kpis.linked)} icon={Package} tone="success" hint="Products with a default supplier" />
        <KpiCard label="Avg. lead time" value={`${kpis.avgLead} days`} icon={CalendarClock} tone="neutral" hint="Across active suppliers" />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={query} onChange={setQuery} placeholder="Search name, contact, phone or email" aria-label="Search suppliers" data-testid="supplier-search" className="sm:w-80" />
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by status" data-testid="supplier-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[13px] text-muted-foreground sm:ml-auto tabular">{filtered.length} of {rows.length} suppliers</p>
      </div>

      {isDesktop ? (
        <DataTable className="mt-4" columns={columns} data={filtered} onRowClick={(r) => openDetail(r.id)} getRowId={(r) => r.id} resetKey={`${q}|${status}`} initialSorting={[{ id: "name", desc: false }]} empty={empty} testId="supplier-table" />
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border bg-card shadow-soft">{empty}</div>
      ) : (
        <ul className="mt-4 space-y-3" data-testid="supplier-cards">
          {[...filtered].sort((a, b) => a.name.localeCompare(b.name)).map((s) => (
            <li key={s.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => openDetail(s.id)}
                onKeyDown={(e) => e.key === "Enter" && openDetail(s.id)}
                className="rounded-xl border bg-card p-4 shadow-soft outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground"><Truck className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><UserIcon className="size-3" /> {s.contactPerson || "No contact person"}</p>
                  </div>
                  {rowActions(s)}
                </div>
                <div className="mt-3 space-y-1 text-[13px] text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Phone className="size-3.5" /> <span className="tabular text-foreground">{s.phone}</span></p>
                  {s.email && <p className="flex items-center gap-1.5 truncate"><Mail className="size-3.5 shrink-0" /> <span className="truncate">{s.email}</span></p>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
                  <Badge variant={s.status === "active" ? "success" : "secondary"} dot>{s.status === "active" ? "Active" : "Inactive"}</Badge>
                  <Badge variant="outline">{s.productCount} products</Badge>
                  {s.openPOs > 0 && <Badge variant="info">{s.openPOs} open PO{s.openPOs === 1 ? "" : "s"}</Badge>}
                  <span className="ml-auto text-muted-foreground tabular">{s.leadTimeDays}d lead</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SupplierDetailSheet
        supplierId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(id) => {
          const s = suppliers.find((x) => x.id === id) ?? null;
          setDetailOpen(false);
          openForm(s);
        }}
      />
      <SupplierFormSheet open={formOpen} onOpenChange={setFormOpen} supplier={editing} />

      {!canManage && !canOrder && (
        <p className="mt-4 text-center text-xs text-muted-foreground">You have view-only access to suppliers. <Link href="/purchasing" className="underline">View purchase orders</Link></p>
      )}
    </div>
  );
}
