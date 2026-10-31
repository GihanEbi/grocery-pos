"use client";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  primary: "bg-primary-soft text-primary-soft-foreground",
  info: "bg-info-soft text-info-foreground",
  warning: "bg-warning-soft text-warning-foreground",
  destructive: "bg-destructive-soft text-destructive-foreground",
  success: "bg-success-soft text-success-foreground",
  neutral: "bg-secondary text-secondary-foreground",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  change,
  changeLabel = "vs previous period",
  hint,
  href,
  invertChange,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof tones;
  /** Percent change; null = no comparison available */
  change?: number | null;
  changeLabel?: string;
  hint?: React.ReactNode;
  href?: string;
  /** When true, a decrease is good (e.g. expenses). */
  invertChange?: boolean;
  className?: string;
}) {
  const positive = change !== undefined && change !== null && (invertChange ? change <= 0 : change >= 0);
  const body = (
    <div className={cn("group relative h-full rounded-xl border bg-card p-4 shadow-soft transition-all", href && "hover:border-primary/30 hover:shadow-elevated", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</p>
      <div className="mt-1.5 flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground">
        {change !== undefined && change !== null && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", positive ? "text-success-foreground" : "text-destructive-foreground")}>
            {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(change)}%
          </span>
        )}
        {change !== undefined && change !== null ? <span className="truncate">{changeLabel}</span> : hint}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50">{body}</Link> : body;
}
