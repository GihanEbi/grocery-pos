"use client";
import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ChevronRight,
  PackagePlus,
  Snail,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { generateInsights, dailySummary } from "@/features/ai/insights";
import { askHref } from "@/features/ai/links";
import { askAssistant } from "@/features/ai/use-assistant";
import { useAiStore } from "@/features/ai/ai-store";
import type { AiInsight, AiInsightSeverity } from "@/features/ai/types";
import { reorderSuggestions } from "@/lib/analytics";
import { sum } from "@/lib/calculations/money";
import { formatMoney, formatNumber, formatQty, formatTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useCategoryMap } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoBadge } from "@/components/shared/demo-badge";
import { ProductThumb } from "@/components/shared/product-thumb";
import { RichText } from "./rich-text";
import { PriorityBadge } from "./ai-blocks";
import { useAiData } from "./use-ai-data";

const SEVERITY: Record<AiInsightSeverity, { tile: string; dot: string; label: string }> = {
  critical: { tile: "bg-destructive-soft text-destructive-foreground", dot: "bg-destructive", label: "Urgent" },
  warning: { tile: "bg-warning-soft text-warning-foreground", dot: "bg-warning", label: "Attention" },
  positive: { tile: "bg-success-soft text-success-foreground", dot: "bg-success", label: "Good news" },
  info: { tile: "bg-info-soft text-info-foreground", dot: "bg-info", label: "Insight" },
};

function insightIcon(i: AiInsight): LucideIcon {
  switch (i.kind) {
    case "low_stock":
      return AlertTriangle;
    case "expiry":
      return CalendarClock;
    case "reorder":
      return PackagePlus;
    case "sales_change":
      return i.severity === "positive" ? TrendingUp : TrendingDown;
    case "top_performer":
      return Trophy;
    case "slow_movers":
      return Snail;
  }
}

function SparkTile({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.62_0.11_195)] text-primary-foreground shadow-soft", className)}>
      <Sparkles className="size-4" />
    </span>
  );
}

/** AI daily business summary card (self-contained; used on the dashboard and the assistant page). */
export function AiDailySummary() {
  const data = useAiData();
  const s = React.useMemo(() => dailySummary(data, new Date()), [data]);
  const stats: { label: string; value: string; tone?: string; href?: string }[] = [
    { label: "Today's sales", value: formatMoney(s.netSales) },
    { label: "Transactions", value: formatNumber(s.transactions) },
    { label: "Gross profit", value: formatMoney(s.grossProfit) },
    { label: "Low / out of stock", value: `${s.lowStockCount} / ${s.outOfStockCount}`, tone: s.outOfStockCount ? "text-destructive-foreground" : s.lowStockCount ? "text-warning-foreground" : undefined, href: "/inventory?status=low_stock" },
    { label: "Expiring ≤ 3 days", value: formatNumber(s.expiringCount), tone: s.expiringCount ? "text-warning-foreground" : undefined, href: "/inventory/expiry" },
    { label: "To reorder", value: formatNumber(s.reorderCount), href: askHref("What should I reorder?") },
  ];

  return (
    <Card className="@container overflow-hidden" data-testid="ai-daily-summary">
      <div className="flex items-start gap-3 border-b bg-gradient-to-br from-primary-soft/60 via-card to-card px-5 py-4">
        <SparkTile />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[15px] font-semibold tracking-tight">AI daily summary</h3>
            <DemoBadge label="Simulated" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Generated at {formatTime(s.date)} from today&apos;s demo data</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          <RichText text={s.headline} />
        </p>
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-3">
          {stats.map((st) => {
            const inner = (
              <>
                <p className="truncate text-[11.5px] font-medium text-muted-foreground">{st.label}</p>
                <p className={cn("mt-0.5 truncate text-[15px] font-semibold tracking-tight tabular", st.tone)}>{st.value}</p>
              </>
            );
            return st.href ? (
              <Link key={st.label} href={st.href} className="min-w-0 rounded-lg border bg-muted/30 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary-soft/30">
                {inner}
              </Link>
            ) : (
              <div key={st.label} className="min-w-0 rounded-lg border bg-muted/30 px-3 py-2">
                {inner}
              </div>
            );
          })}
        </div>
        {s.recommendations.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recommended actions</p>
            <ul className="-mx-2 space-y-0.5">
              {s.recommendations.map((r) => (
                <li key={r.label}>
                  <Link href={r.href} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent" data-testid="ai-recommendation">
                    <span className={cn("size-2 shrink-0 rounded-full", SEVERITY[r.severity].dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{r.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="border-t px-5 py-3">
        <Link href={askHref("Give me today's daily summary")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
          Ask the assistant for details <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}

/** Grid of AI insight cards (no heading — the host section provides one). */
export function AiInsightCards({ limit }: { limit?: number }) {
  const data = useAiData();
  const insights = React.useMemo(() => generateInsights(data, new Date()), [data]);
  const shown = limit ? insights.slice(0, limit) : insights;

  if (!shown.length)
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft" data-testid="ai-insights">
        <span className="flex size-9 items-center justify-center rounded-lg bg-success-soft text-success-foreground">
          <CheckCircle2 className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium">All clear</p>
          <p className="text-xs text-muted-foreground">No stock, expiry or sales issues detected in the demo data.</p>
        </div>
      </div>
    );

  return (
    <div className="@container" data-testid="ai-insights">
      <div className="grid gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
        {shown.map((i) => {
          const Icon = insightIcon(i);
          const sev = SEVERITY[i.severity];
          return (
            <Link key={i.id} href={i.href} className="group flex flex-col rounded-xl border bg-card p-4 shadow-soft transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-elevated" data-testid="ai-insight-card">
              <div className="flex items-start gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", sev.tile)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", sev.dot)} />
                    {sev.label}
                  </p>
                  <p className="mt-0.5 text-[13.5px] font-semibold leading-snug">{i.title}</p>
                </div>
                {i.metric && <span className="shrink-0 text-right text-[13px] font-semibold tabular">{i.metric}</span>}
              </div>
              <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">{i.message}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary">
                {i.actionLabel}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Compact "Smart reorder recommendations" card with a button that asks the assistant for the full plan. */
export function AiReorderCard({ onAsk }: { onAsk?: () => void }) {
  const data = useAiData();
  const categories = useCategoryMap();
  const pending = useAiStore((s) => s.pending);
  const list = React.useMemo(() => reorderSuggestions(data.products, data.suppliers, data.sales, new Date()), [data.products, data.suppliers, data.sales]);
  const top = list.slice(0, 6);
  return (
    <Card className="overflow-hidden" data-testid="ai-reorder-card">
      <div className="flex items-start gap-3 border-b px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info-foreground">
          <PackagePlus className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold tracking-tight">Smart reorder recommendations</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {list.length ? `${list.length} products · est. ${formatMoney(sum(list.map((l) => l.estimatedCost)))}` : "Based on 14-day sales velocity and lead times"}
          </p>
        </div>
      </div>
      {top.length ? (
        <ul className="divide-y">
          {top.map((s) => (
            <li key={s.product.id} className="flex items-center gap-3 px-5 py-2.5">
              <ProductThumb image={s.product.image} name={s.product.name} color={categories.get(s.product.categoryId)?.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{s.product.name}</p>
                <p className="truncate text-[11.5px] text-muted-foreground tabular">
                  Stock {formatQty(s.stock, s.product.unit)} · {formatQty(s.dailyVelocity, s.product.unit)}/day
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[13px] font-semibold tabular">+{formatQty(s.suggestedQty, s.product.unit)}</span>
                <PriorityBadge priority={s.priority} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">Stock levels look healthy — nothing to reorder.</p>
      )}
      <div className="border-t p-3">
        <Button
          variant="soft"
          className="w-full"
          disabled={pending}
          data-testid="ai-ask-reorder"
          onClick={() => {
            onAsk?.();
            void askAssistant("What should I reorder?");
          }}
        >
          <Sparkles />
          Ask for full plan
        </Button>
      </div>
    </Card>
  );
}
