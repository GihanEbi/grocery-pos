"use client";
import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatMoneyCompact } from "@/lib/formatting";
import { cn } from "@/lib/utils";

/** Theme-aware chart palette. Values are CSS variables so charts restyle with the theme. */
export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

export function ChartCard({ title, description, action, children, className, contentClassName }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; contentClassName?: string }) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn("flex-1", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

type TooltipPayload = { name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

/** Custom Recharts tooltip matching the design system. */
export function ChartTooltip({ active, payload, label, money = true, labelKey }: { active?: boolean; payload?: TooltipPayload[]; label?: string | number; money?: boolean; labelKey?: string }) {
  if (!active || !payload?.length) return null;
  const title = labelKey && payload[0]?.payload ? String(payload[0].payload[labelKey]) : label;
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-elevated">
      {title !== undefined && <p className="mb-1.5 font-medium text-foreground">{title}</p>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tabular text-foreground">{typeof p.value === "number" ? (money ? formatMoney(p.value) : p.value.toLocaleString()) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const moneyTick = (v: number) => formatMoneyCompact(v).replace("Rs ", "");

export function ChartLegend({ items }: { items: { label: string; color: string; value?: React.ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined && <span className="font-medium text-foreground tabular">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}
