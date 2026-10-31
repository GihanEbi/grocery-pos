"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlarmClock, CalendarCheck, CalendarClock, CalendarX2, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { api } from "@/mocks/services";
import { useCan, useCategoryMap, useCurrentUser, useDebounced } from "@/hooks";
import { expiryRows, type ExpiryRow } from "@/lib/analytics";
import { stockStatus, type ExpiryStatus } from "@/lib/calculations/inventory";
import { formatDate, formatMoney, formatMoneyCompact, formatNumber, formatQty } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Money } from "@/components/shared/money";
import { ExpiryBadge, StockStatusBadge } from "@/components/shared/status-badges";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InventorySubnav } from "./inventory-subnav";

type Tab = "soon" | "expired" | "all";

const ROW_ACCENT: Record<ExpiryStatus, string> = {
  expired: "[&>td:first-child]:shadow-[inset_3px_0_0_var(--destructive)] bg-destructive-soft/20",
  critical: "[&>td:first-child]:shadow-[inset_3px_0_0_var(--destructive)]",
  soon: "[&>td:first-child]:shadow-[inset_3px_0_0_var(--warning)]",
  ok: "[&>td:first-child]:shadow-[inset_3px_0_0_var(--success)]",
};

export function ExpiryView() {
  const params = useSearchParams();
  const batches = useAppStore((s) => s.batches);
  const products = useAppStore((s) => s.products);
  const categoryMap = useCategoryMap();
  const user = useCurrentUser();
  const canWriteOff = useCan("inventory.adjust");
  const confirm = useConfirm();

  const [tab, setTab] = React.useState<Tab>(() => {
    const t = params.get("tab");
    return t === "expired" || t === "all" ? t : "soon";
  });
  const [q, setQ] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const debouncedQ = useDebounced(q, 150);

  const rows = React.useMemo(() => expiryRows(batches, products), [batches, products]);

  const kpi = React.useMemo(() => {
    const expired = rows.filter((r) => r.daysLeft < 0);
    const critical = rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 3);
    const soon = rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 14);
    const sum = (list: ExpiryRow[]) => list.reduce((a, r) => a + r.value, 0);
    return { expired: expired.length, expiredValue: sum(expired), critical: critical.length, criticalValue: sum(critical), soon: soon.length, soonValue: sum(soon), total: rows.length, totalValue: sum(rows) };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "soon" && !(r.daysLeft >= 0 && r.daysLeft <= 14)) return false;
      if (tab === "expired" && r.daysLeft >= 0) return false;
      if (term && !(r.product.name.toLowerCase().includes(term) || r.product.sku.toLowerCase().includes(term) || r.batch.batchNo.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [rows, tab, debouncedQ]);

  const writeOff = React.useCallback(
    async (r: ExpiryRow) => {
      if (!user) return;
      const ok = await confirm({
        title: `Write off batch ${r.batch.batchNo}?`,
        description: (
          <p>
            This removes <strong className="text-foreground">{formatQty(r.batch.quantity, r.product.unit)}</strong> of <strong className="text-foreground">{r.product.name}</strong> from stock
            and records an &ldquo;expired&rdquo; movement worth <strong className="text-foreground">{formatMoney(r.value)}</strong> at cost. This can&apos;t be undone.
          </p>
        ),
        confirmLabel: "Write off batch",
        tone: "destructive",
      });
      if (!ok) return;
      setBusyId(r.batch.id);
      const res = await api.inventory.writeOffBatch(r.batch.id, user.id);
      setBusyId(null);
      if (res.ok) toast.success(`Batch ${r.batch.batchNo} written off`, { description: `${r.product.name} · −${formatQty(r.batch.quantity, r.product.unit)}` });
      else toast.error(res.error);
    },
    [confirm, user],
  );

  const columns = React.useMemo<ColumnDef<ExpiryRow, unknown>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        accessorFn: (r) => r.product.name,
        cell: ({ row }) => {
          const p = row.original.product;
          return (
            <div className="flex min-w-44 items-center gap-2.5">
              <ProductThumb image={p.image} name={p.name} color={categoryMap.get(p.categoryId)?.color} size="sm" />
              <div className="min-w-0">
                <p className="max-w-48 truncate text-[13px] font-medium">{p.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{p.sku}</p>
              </div>
            </div>
          );
        },
      },
      { id: "batch", header: "Batch no", accessorFn: (r) => r.batch.batchNo, cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs">{row.original.batch.batchNo}</span> },
      { id: "received", header: "Received", accessorFn: (r) => r.batch.receivedDate, cell: ({ row }) => <span className="whitespace-nowrap text-[13px] tabular text-muted-foreground">{formatDate(row.original.batch.receivedDate)}</span> },
      { id: "expiry", header: "Expiry date", accessorFn: (r) => r.batch.expiryDate, cell: ({ row }) => <span className="whitespace-nowrap text-[13px] font-medium tabular">{formatDate(row.original.batch.expiryDate)}</span> },
      { id: "days", header: "Days left", accessorKey: "daysLeft", cell: ({ row }) => <ExpiryBadge status={row.original.status} daysLeft={row.original.daysLeft} /> },
      { id: "qty", header: "Quantity", accessorFn: (r) => r.batch.quantity, meta: { align: "right" }, cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular">{formatQty(row.original.batch.quantity, row.original.product.unit)}</span> },
      { id: "value", header: "Value at cost", accessorKey: "value", meta: { align: "right" }, cell: ({ row }) => <Money value={row.original.value} className="text-[13px]" /> },
      {
        id: "stock",
        header: "Product stock",
        accessorFn: (r) => r.product.stock,
        cell: ({ row }) => {
          const p = row.original.product;
          return (
            <div className="flex flex-col items-start gap-0.5 whitespace-nowrap">
              <StockStatusBadge status={stockStatus(p.stock, p.minStock)} />
              <span className="pl-1 text-[11px] text-muted-foreground tabular">{formatQty(p.stock, p.unit)} on hand</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) =>
          canWriteOff ? (
            <Button
              variant={row.original.daysLeft < 0 ? "destructive-outline" : "ghost"}
              size="sm"
              title="Write off batch"
              className="max-[1499px]:w-8 max-[1499px]:px-0"
              onClick={() => void writeOff(row.original)}
              loading={busyId === row.original.batch.id}
              data-testid={`writeoff-${row.original.batch.batchNo}`}
            >
              {busyId !== row.original.batch.id && <Trash2 className="size-3.5" />}
              <span className="hidden min-[1500px]:inline">Write off</span>
              <span className="sr-only min-[1500px]:hidden">Write off</span>
            </Button>
          ) : null,
      },
    ],
    [categoryMap, canWriteOff, writeOff, busyId],
  );

  const emptyCopy: Record<Tab, { title: string; description: string; icon: typeof CalendarCheck }> = {
    soon: { title: "Nothing expiring in the next 14 days", description: "Batches approaching their expiry date will appear here.", icon: CalendarCheck },
    expired: { title: "No expired stock on hand", description: "Expired batches are listed here until they're written off.", icon: CalendarCheck },
    all: { title: "No batches tracked", description: "Products with expiry tracking create batches when stock is received.", icon: CalendarClock },
  };
  const empty = debouncedQ ? { title: "No batches match your search", description: "Try a different product name, SKU or batch number.", icon: CalendarClock } : emptyCopy[tab];

  return (
    <>
      <PageHeader title="Expiry management" description="Track batches by expiry date and write off expired stock before it reaches the shelf." />
      <InventorySubnav />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Expired batches" value={formatNumber(kpi.expired)} icon={CalendarX2} tone="destructive" hint={`${formatMoneyCompact(kpi.expiredValue)} at cost`} />
        <KpiCard label="Expiring ≤ 3 days" value={formatNumber(kpi.critical)} icon={AlarmClock} tone="destructive" hint={`${formatMoneyCompact(kpi.criticalValue)} at cost`} />
        <KpiCard label="Expiring ≤ 14 days" value={formatNumber(kpi.soon)} icon={CalendarClock} tone="warning" hint={`${formatMoneyCompact(kpi.soonValue)} at cost`} />
        <KpiCard label="Tracked batches" value={formatNumber(kpi.total)} icon={CalendarCheck} tone="neutral" hint={`${formatMoneyCompact(kpi.totalValue)} at cost`} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="soon" data-testid="expiry-tab-soon">
              Expiring soon <span className="rounded-full bg-warning-soft px-1.5 text-[11px] text-warning-foreground tabular">{kpi.soon}</span>
            </TabsTrigger>
            <TabsTrigger value="expired" data-testid="expiry-tab-expired">
              Expired <span className="rounded-full bg-destructive-soft px-1.5 text-[11px] text-destructive-foreground tabular">{kpi.expired}</span>
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="expiry-tab-all">
              All batches <span className="rounded-full bg-secondary px-1.5 text-[11px] tabular">{kpi.total}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <SearchInput value={q} onChange={setQ} placeholder="Search product or batch…" aria-label="Search batches" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Colour legend">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-destructive" /> Expired / ≤ 3 days</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-warning" /> ≤ 14 days</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-1 rounded-full bg-success" /> Fresh</span>
      </div>

      <DataTable
        testId="expiry-table"
        columns={columns}
        data={filtered}
        getRowId={(r) => r.batch.id}
        resetKey={`${tab}|${debouncedQ}`}
        rowClassName={(r) => ROW_ACCENT[r.status]}
        empty={<EmptyState icon={empty.icon} title={empty.title} description={empty.description} />}
      />
    </>
  );
}
