"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isSameMonth } from "date-fns";
import { ClipboardList, FilePen, PackageCheck, Plus, Sparkles, Truck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { POStatusBadge } from "@/components/shared/status-badges";
import { Money } from "@/components/shared/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PODetailSheet } from "@/components/purchasing/po-detail-sheet";
import { OPEN_PO_STATUSES, poOutstandingValue, poReceivedValue, poTotal } from "@/components/purchasing/po-utils";
import { useCan, useDebounced, useSupplierMap } from "@/hooks";
import { useAppStore } from "@/store/app-store";
import { formatDate, formatMoney, formatNumber } from "@/lib/formatting";
import type { POStatus, PurchaseOrder } from "@/types";

type Tab = "all" | POStatus;
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "partially_received", label: "Partially received" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

interface Row extends PurchaseOrder {
  supplierName: string;
  total: number;
}

export default function PurchasingPage() {
  return (
    <Suspense fallback={null}>
      <PurchasingContent />
    </Suspense>
  );
}

function PurchasingContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const poParam = searchParams.get("po");

  const purchaseOrders = useAppStore((s) => s.purchaseOrders);
  const supplierMap = useSupplierMap();
  const canManage = useCan("purchasing.manage");

  const [tab, setTab] = React.useState<Tab>("all");
  const [query, setQuery] = React.useState("");
  const q = useDebounced(query).trim().toLowerCase();

  // Detail sheet state mirrors ?po=<id>; we keep the last id so content stays during the close animation.
  const [detailId, setDetailId] = React.useState<string | null>(poParam);
  const [detailOpen, setDetailOpen] = React.useState(!!poParam);
  React.useEffect(() => {
    if (poParam) {
      setDetailId(poParam);
      setDetailOpen(true);
    } else {
      setDetailOpen(false);
    }
  }, [poParam]);

  const openDetail = React.useCallback(
    (id: string) => {
      setDetailId(id);
      setDetailOpen(true);
      router.replace(`${pathname}?po=${encodeURIComponent(id)}`, { scroll: false });
    },
    [pathname, router],
  );
  const closeDetail = React.useCallback(() => {
    setDetailOpen(false);
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const rows: Row[] = React.useMemo(
    () => purchaseOrders.map((po) => ({ ...po, supplierName: supplierMap.get(po.supplierId)?.name ?? "Unknown supplier", total: poTotal(po) })),
    [purchaseOrders, supplierMap],
  );

  const counts = React.useMemo(() => {
    const c: Record<Tab, number> = { all: rows.length, draft: 0, approved: 0, partially_received: 0, received: 0, cancelled: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const kpis = React.useMemo(() => {
    const now = new Date();
    const open = purchaseOrders.filter((p) => OPEN_PO_STATUSES.includes(p.status));
    const awaiting = purchaseOrders.filter((p) => p.status === "approved" || p.status === "partially_received");
    const receivedThisMonth = purchaseOrders.filter((p) => p.receivedAt && isSameMonth(new Date(p.receivedAt), now) && (p.status === "received" || p.status === "partially_received"));
    return {
      open: open.length,
      awaitingCount: awaiting.length,
      awaitingValue: awaiting.reduce((a, p) => a + poOutstandingValue(p), 0),
      receivedValue: receivedThisMonth.reduce((a, p) => a + poReceivedValue(p), 0),
      receivedCount: receivedThisMonth.length,
      drafts: counts.draft,
      aiDrafts: purchaseOrders.filter((p) => p.status === "draft" && p.source === "ai").length,
    };
  }, [purchaseOrders, counts.draft]);

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (tab !== "all" && r.status !== tab) return false;
        if (!q) return true;
        return r.poNumber.toLowerCase().includes(q) || r.supplierName.toLowerCase().includes(q);
      }),
    [rows, tab, q],
  );

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "poNumber",
        header: "PO number",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[13px] font-medium" data-testid={`po-row-${row.original.poNumber}`}>{row.original.poNumber}</span>
            {row.original.source === "ai" && (
              <Badge variant="info" className="px-1.5 py-0 text-[10px]" title="Created from an AI reorder suggestion"><Sparkles /> AI</Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "supplierName",
        header: "Supplier",
        cell: ({ row }) => <span className="block max-w-56 truncate font-medium">{row.original.supplierName}</span>,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground tabular">{formatDate(row.original.createdAt)}</span>,
        meta: { className: "hidden md:table-cell" },
      },
      {
        id: "expected",
        accessorFn: (r) => r.expectedDate ?? "",
        header: "Expected",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.expectedDate) return <span className="text-muted-foreground">—</span>;
          const overdue = (r.status === "approved" || r.status === "partially_received") && new Date(r.expectedDate).setHours(23, 59, 59) < Date.now();
          return (
            <span className={overdue ? "whitespace-nowrap font-medium text-warning-foreground tabular" : "whitespace-nowrap text-muted-foreground tabular"} title={overdue ? "Delivery is overdue" : undefined}>
              {formatDate(r.expectedDate)}
            </span>
          );
        },
        meta: { className: "hidden lg:table-cell" },
      },
      {
        id: "items",
        accessorFn: (r) => r.items.length,
        header: "Items",
        cell: ({ row }) => <span className="tabular">{row.original.items.length}</span>,
        meta: { align: "right", className: "hidden sm:table-cell" },
      },
      {
        accessorKey: "total",
        header: "Total cost",
        cell: ({ row }) => <Money value={row.original.total} className="font-medium" />,
        meta: { align: "right" },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <POStatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        description="Order stock from suppliers, approve orders and receive deliveries into inventory."
        actions={
          canManage && (
            <Button asChild data-testid="new-po">
              <Link href="/purchasing/new"><Plus /> New purchase order</Link>
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open orders" value={formatNumber(kpis.open)} icon={ClipboardList} tone="primary" hint="Draft, approved & partially received" />
        <KpiCard label="Awaiting delivery" value={formatMoney(kpis.awaitingValue)} icon={Truck} tone="info" hint={`${kpis.awaitingCount} order${kpis.awaitingCount === 1 ? "" : "s"} outstanding`} />
        <KpiCard label="Received this month" value={formatMoney(kpis.receivedValue)} icon={PackageCheck} tone="success" hint={`${kpis.receivedCount} order${kpis.receivedCount === 1 ? "" : "s"} with deliveries`} />
        <KpiCard label="Drafts" value={formatNumber(kpis.drafts)} icon={FilePen} tone="warning" hint={kpis.aiDrafts > 0 ? `${kpis.aiDrafts} suggested by AI · need review` : "Waiting for approval"} />
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-w-0">
          <TabsList className="w-full justify-start sm:w-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} data-testid={`po-tab-${t.value}`}>
                {t.label}
                <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[11px] tabular">{counts[t.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchInput value={query} onChange={setQuery} placeholder="Search PO number or supplier" aria-label="Search purchase orders" data-testid="po-search" />
      </div>

      <DataTable
        className="mt-4"
        columns={columns}
        data={filtered}
        onRowClick={(r) => openDetail(r.id)}
        getRowId={(r) => r.id}
        resetKey={`${tab}|${q}`}
        initialSorting={[{ id: "createdAt", desc: true }]}
        testId="po-table"
        empty={
          <EmptyState
            icon={ClipboardList}
            title={q || tab !== "all" ? "No purchase orders match" : "No purchase orders yet"}
            description={q || tab !== "all" ? "Try another search term or status." : "Create your first purchase order to restock from a supplier."}
            action={
              q || tab !== "all" ? (
                <Button variant="outline" size="sm" onClick={() => { setQuery(""); setTab("all"); }}>Clear filters</Button>
              ) : canManage ? (
                <Button size="sm" asChild><Link href="/purchasing/new"><Plus /> New purchase order</Link></Button>
              ) : undefined
            }
          />
        }
      />

      <PODetailSheet poId={detailId} open={detailOpen} onOpenChange={(o) => (o ? setDetailOpen(true) : closeDetail())} />
    </div>
  );
}
