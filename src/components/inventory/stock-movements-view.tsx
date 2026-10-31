"use client";

import * as React from "react";
import { format } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Download, History } from "lucide-react";
import { toast } from "sonner";
import type { MovementType, StockMovement } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCategoryMap, useDebounced, useProductMap, useUserMap } from "@/hooks";
import { inRange, rangeFromPreset } from "@/lib/analytics";
import { formatNumber, formatQty } from "@/lib/formatting";
import { cn, downloadCsv } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { ProductThumb } from "@/components/shared/product-thumb";
import { DateRangePicker, rangeLabel, useRangeState } from "@/components/shared/date-range-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InventorySubnav } from "./inventory-subnav";
import { MOVEMENT_TYPES, MovementTypeBadge, movementLabel } from "./movement-type-badge";

export function StockMovementsView() {
  const movements = useAppStore((s) => s.movements);
  const users = useAppStore((s) => s.users);
  const productMap = useProductMap();
  const categoryMap = useCategoryMap();
  const userMap = useUserMap();

  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | MovementType>("all");
  const [userId, setUserId] = React.useState("all");
  const [range, setRange] = useRangeState("last30");
  const debouncedQ = useDebounced(q, 150);

  const filtered = React.useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    return movements
      .filter((m) => {
        if (!inRange(m.date, range.range)) return false;
        if (type !== "all" && m.type !== type) return false;
        if (userId !== "all" && m.userId !== userId) return false;
        if (term) {
          const p = productMap.get(m.productId);
          const hay = `${p?.name ?? ""} ${p?.sku ?? ""} ${p?.barcode ?? ""} ${m.reference}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [movements, range, type, userId, debouncedQ, productMap]);

  const totals = React.useMemo(() => {
    let inCount = 0, outCount = 0;
    for (const m of filtered) (m.quantity > 0 ? inCount++ : outCount++);
    return { inCount, outCount };
  }, [filtered]);

  const hasFilters = q !== "" || type !== "all" || userId !== "all" || range.preset !== "last30";
  const clearFilters = () => {
    setQ("");
    setType("all");
    setUserId("all");
    setRange({ preset: "last30", range: rangeFromPreset("last30") });
  };

  const exportCsv = () => {
    if (filtered.length === 0) return;
    downloadCsv(
      `stock-movements-${format(new Date(), "yyyy-MM-dd")}`,
      filtered.map((m) => {
        const p = productMap.get(m.productId);
        return {
          Date: format(new Date(m.date), "yyyy-MM-dd HH:mm"),
          Product: p?.name ?? "Unknown product",
          SKU: p?.sku ?? "",
          Type: movementLabel(m.type),
          Quantity: m.quantity,
          Unit: p?.unit ?? "",
          "Balance after": m.balanceAfter,
          Reference: m.reference,
          User: userMap.get(m.userId)?.name ?? "",
          Reason: m.reason,
        };
      }),
    );
    toast.success(`Exported ${formatNumber(filtered.length)} movements`, { description: `Range: ${rangeLabel(range)}` });
  };

  const columns = React.useMemo<ColumnDef<StockMovement, unknown>[]>(
    () => [
      {
        id: "date",
        header: "Date & time",
        accessorKey: "date",
        cell: ({ row }) => {
          const d = new Date(row.original.date);
          return (
            <div className="whitespace-nowrap">
              <p className="text-[13px] font-medium tabular">{format(d, "dd MMM yyyy")}</p>
              <p className="text-xs text-muted-foreground tabular">{format(d, "hh:mm a")}</p>
            </div>
          );
        },
      },
      {
        id: "product",
        header: "Product",
        accessorFn: (m) => productMap.get(m.productId)?.name ?? "",
        cell: ({ row }) => {
          const p = productMap.get(row.original.productId);
          if (!p) return <span className="text-muted-foreground">Deleted product</span>;
          return (
            <div className="flex min-w-48 items-center gap-2.5">
              <ProductThumb image={p.image} name={p.name} color={categoryMap.get(p.categoryId)?.color} size="sm" />
              <div className="min-w-0">
                <p className="max-w-56 truncate text-[13px] font-medium">{p.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{p.sku}</p>
              </div>
            </div>
          );
        },
      },
      { id: "type", header: "Type", accessorKey: "type", cell: ({ row }) => <MovementTypeBadge type={row.original.type} /> },
      {
        id: "qty",
        header: "Quantity",
        accessorKey: "quantity",
        meta: { align: "right" },
        cell: ({ row }) => {
          const m = row.original;
          const unit = productMap.get(m.productId)?.unit;
          const up = m.quantity > 0;
          return (
            <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap font-semibold tabular", up ? "text-success-foreground" : "text-destructive-foreground")}>
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {up ? "+" : "−"}{formatQty(Math.abs(m.quantity), unit)}
            </span>
          );
        },
      },
      {
        id: "balance",
        header: "Balance after",
        accessorKey: "balanceAfter",
        meta: { align: "right" },
        cell: ({ row }) => <span className="whitespace-nowrap text-[13px] tabular text-muted-foreground">{formatQty(row.original.balanceAfter, productMap.get(row.original.productId)?.unit)}</span>,
      },
      { id: "ref", header: "Reference", accessorKey: "reference", cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs">{row.original.reference || "—"}</span> },
      {
        id: "user",
        header: "User",
        accessorFn: (m) => userMap.get(m.userId)?.name ?? "",
        cell: ({ row }) => <span className="whitespace-nowrap text-[13px]">{userMap.get(row.original.userId)?.name ?? "System"}</span>,
      },
      {
        id: "reason",
        header: "Reason",
        accessorKey: "reason",
        enableSorting: false,
        cell: ({ row }) => <p className="line-clamp-2 min-w-48 max-w-72 text-[13px] text-muted-foreground" title={row.original.reason}>{row.original.reason || "—"}</p>,
      },
    ],
    [productMap, categoryMap, userMap],
  );

  return (
    <>
      <PageHeader
        title="Stock movements"
        description="Every change to stock — sales, purchases, returns, adjustments and write-offs."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0} data-testid="export-movements">
            <Download /> Export CSV
          </Button>
        }
      />
      <InventorySubnav />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search product, SKU or reference…" aria-label="Search movements" data-testid="movement-search" className="lg:w-72" />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="sm:w-40" aria-label="Filter by movement type" data-testid="movement-type-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MOVEMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="sm:w-44" aria-label="Filter by user"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateRangePicker value={range} onChange={setRange} className="col-span-2 sm:w-auto" align="start" />
        </div>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start lg:self-auto">Reset</Button>}
        <p className="flex items-center gap-3 text-[13px] text-muted-foreground lg:ml-auto">
          <span><span className="font-medium text-foreground tabular">{formatNumber(filtered.length)}</span> movements</span>
          <span className="inline-flex items-center gap-1 text-success-foreground"><ArrowUpRight className="size-3.5" />{formatNumber(totals.inCount)} in</span>
          <span className="inline-flex items-center gap-1 text-destructive-foreground"><ArrowDownRight className="size-3.5" />{formatNumber(totals.outCount)} out</span>
        </p>
      </div>

      <DataTable
        testId="movements-table"
        columns={columns}
        data={filtered}
        getRowId={(m) => m.id}
        pageSize={20}
        resetKey={`${debouncedQ}|${type}|${userId}|${range.range.from.getTime()}|${range.range.to.getTime()}`}
        empty={
          <EmptyState
            icon={History}
            title={movements.length === 0 ? "No stock movements yet" : "No movements match your filters"}
            description={movements.length === 0 ? "Sales, purchases and adjustments will be logged here." : "Try a wider date range or clear the filters."}
            action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Reset filters</Button> : undefined}
          />
        }
      />
    </>
  );
}
