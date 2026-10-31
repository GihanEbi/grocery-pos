"use client";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ClipboardPlus, Truck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductUnit } from "@/types";
import type { AiBlock, AiKpi, AiReorderLine, AiTable } from "@/features/ai/types";
import { draftPoHref } from "@/features/ai/links";
import type { ReorderPriority } from "@/lib/calculations/forecasting";
import { formatMoney, formatQty } from "@/lib/formatting";
import { sum } from "@/lib/calculations/money";
import { cn } from "@/lib/utils";
import { useCan, useCategoryMap, useProductMap } from "@/hooks";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHART_COLORS, ChartLegend, ChartTooltip, moneyTick } from "@/components/shared/chart";
import { ProductThumb } from "@/components/shared/product-thumb";
import { RichText } from "./rich-text";

export function AiBlocks({ blocks, compact }: { blocks: AiBlock[]; compact?: boolean }) {
  if (!blocks.length) return null;
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "kpis":
            return <KpiTiles key={i} items={b.items} compact={compact} />;
          case "table":
            return <CompactTable key={i} title={b.title} table={b.table} />;
          case "bullets":
            return <BulletList key={i} items={b.items} />;
          case "chart":
            return <MiniBarChart key={i} {...b} compact={compact} />;
          case "reorder":
            return <ReorderTable key={i} lines={b.lines} compact={compact} />;
        }
      })}
    </div>
  );
}

const toneClass: Record<NonNullable<AiKpi["tone"]>, string> = {
  default: "",
  good: "text-success-foreground",
  bad: "text-destructive-foreground",
  warn: "text-warning-foreground",
};

export function KpiTiles({ items, compact }: { items: AiKpi[]; compact?: boolean }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", !compact && items.length >= 4 && "md:grid-cols-4", !compact && items.length === 3 && "md:grid-cols-3")}>
      {items.map((k) => (
        <div key={k.label} className="min-w-0 rounded-lg border bg-card px-3 py-2.5 shadow-soft">
          <p className="truncate text-[11.5px] font-medium text-muted-foreground">{k.label}</p>
          <p className={cn("mt-0.5 truncate text-[15px] font-semibold tracking-tight tabular", k.tone && toneClass[k.tone])}>{k.value}</p>
          {k.change !== undefined && k.change !== null && (
            <span className={cn("mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium", k.change >= 0 ? "text-success-foreground" : "text-destructive-foreground", k.tone === "bad" && k.change > 0 && "text-destructive-foreground", k.tone === "good" && k.change < 0 && "text-success-foreground")}>
              {k.change >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(k.change)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function CompactTable({ title, table }: { title?: string; table: AiTable }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
      {title && <p className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold">{title}</p>}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[420px] text-[12.5px]">
          <thead>
            <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
              {table.columns.map((c) => (
                <th key={c.key} className={cn("whitespace-nowrap px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                {table.columns.map((c, j) => (
                  <td key={c.key} className={cn("px-3 py-2 tabular", c.align === "right" ? "whitespace-nowrap text-right" : "text-left", j === 0 && "font-medium")}>
                    {r[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 rounded-lg border border-dashed bg-muted/30 px-3.5 py-3 text-[13px] text-muted-foreground">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/70" />
          <RichText text={t} />
        </li>
      ))}
    </ul>
  );
}

export function MiniBarChart({ title, data, money, compareLabel, valueLabel, compact }: Extract<AiBlock, { type: "chart" }> & { compact?: boolean }) {
  const hasCompare = data.some((d) => d.compare !== undefined);
  const rows = data.map((d) => ({ ...d, value: d.value, compare: d.compare ?? 0 }));
  return (
    <div className="rounded-lg border bg-card p-3 shadow-soft">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {title && <p className="text-xs font-semibold">{title}</p>}
        {hasCompare && (
          <ChartLegend
            items={[
              { label: valueLabel ?? "Current", color: CHART_COLORS[0]! },
              { label: compareLabel ?? "Previous", color: "var(--chart-grid)" },
            ]}
          />
        )}
      </div>
      <div className={compact ? "h-36" : "h-44"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={rows.length > 12 ? "15%" : "25%"}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10.5 }} interval={rows.length > 8 ? "preserveStartEnd" : 0} minTickGap={4} />
            <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 10.5 }} tickFormatter={(v: number) => (money ? moneyTick(v) : String(v))} />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.5 }} content={<ChartTooltip money={money} />} />
            {hasCompare && <Bar dataKey="compare" name={compareLabel ?? "Previous"} fill="var(--chart-grid)" radius={[3, 3, 0, 0]} maxBarSize={22} />}
            <Bar dataKey="value" name={valueLabel ?? "Value"} fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const PRIORITY: Record<ReorderPriority, [string, BadgeVariant]> = {
  critical: ["Critical", "destructive"],
  high: ["High", "warning"],
  medium: ["Medium", "info"],
  low: ["Low", "secondary"],
};

export function PriorityBadge({ priority }: { priority: ReorderPriority }) {
  const [label, variant] = PRIORITY[priority];
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

const coverText = (d: number) => (d >= 999 ? "—" : `${d.toFixed(d < 10 ? 1 : 0)} d`);

/** Reorder suggestions grouped by supplier with a per-supplier "Create draft purchase order" link. */
export function ReorderTable({ lines }: { lines: AiReorderLine[]; compact?: boolean }) {
  const products = useProductMap();
  const categories = useCategoryMap();
  const canPurchase = useCan("purchasing.manage");
  const groups = new Map<string, AiReorderLine[]>();
  for (const l of lines) groups.set(l.supplierId ?? "none", [...(groups.get(l.supplierId ?? "none") ?? []), l]);
  const ordered = [...groups.entries()].sort((a, b) => sum(b[1].map((l) => l.estimatedCost)) - sum(a[1].map((l) => l.estimatedCost)));

  return (
    <div className="space-y-3" data-testid="ai-reorder-table">
      {ordered.map(([key, group]) => {
        const supplierId = key === "none" ? null : key;
        const total = sum(group.map((l) => l.estimatedCost));
        return (
          <div key={key} className="overflow-hidden rounded-lg border bg-card shadow-soft">
            <div className="flex flex-col gap-2 border-b bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-info-soft text-info-foreground">
                  <Truck className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">{group[0]!.supplierName}</p>
                  <p className="text-[11.5px] text-muted-foreground tabular">
                    {group.length} item{group.length === 1 ? "" : "s"} · est. {formatMoney(total)}
                  </p>
                </div>
              </div>
              {canPurchase && (
                <Button asChild size="sm" variant={supplierId ? "default" : "outline"} className="w-full sm:w-auto">
                  <Link href={draftPoHref(supplierId, group)} data-testid="create-draft-po">
                    <ClipboardPlus />
                    Create draft purchase order
                  </Link>
                </Button>
              )}
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[680px] table-fixed text-[12.5px]">
                <colgroup>
                  <col />
                  <col className="w-[70px]" />
                  <col className="w-[88px]" />
                  <col className="w-[62px]" />
                  <col className="w-[84px]" />
                  <col className="w-[92px]" />
                  <col className="w-[104px]" />
                </colgroup>
                <thead>
                  <tr className="border-b text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2.5 py-2 text-left font-medium">Product</th>
                    <th className="px-2.5 py-2 text-right font-medium">Stock</th>
                    <th className="whitespace-nowrap px-2.5 py-2 text-right font-medium">Velocity/day</th>
                    <th className="px-2.5 py-2 text-right font-medium">Cover</th>
                    <th className="px-2.5 py-2 text-right font-medium">Suggested</th>
                    <th className="px-2.5 py-2 text-left font-medium">Priority</th>
                    <th className="px-2.5 py-2 text-right font-medium">Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((l) => {
                    const p = products.get(l.productId);
                    const color = p ? categories.get(p.categoryId)?.color : undefined;
                    const unit = l.unit as ProductUnit;
                    return (
                      <tr key={l.productId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-2.5 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <ProductThumb image={l.image} name={l.name} color={color} size="sm" />
                            <span className="line-clamp-2 font-medium leading-snug" title={l.name}>{l.name}</span>
                          </div>
                        </td>
                        <td className={cn("whitespace-nowrap px-2.5 py-2 text-right tabular", l.stock <= 0 && "font-semibold text-destructive-foreground")}>{formatQty(l.stock, unit)}</td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-right tabular">{formatQty(l.velocity, unit)}</td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-right tabular">{coverText(l.daysOfCover)}</td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-right font-semibold tabular">{formatQty(l.suggestedQty, unit)}</td>
                        <td className="px-2.5 py-2"><PriorityBadge priority={l.priority} /></td>
                        <td className="whitespace-nowrap px-2.5 py-2 text-right tabular">{formatMoney(l.estimatedCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <p className="text-[11.5px] text-muted-foreground">Draft purchase orders open prefilled in Purchasing — review the quantities and save to create them. Nothing is ordered automatically.</p>
    </div>
  );
}
