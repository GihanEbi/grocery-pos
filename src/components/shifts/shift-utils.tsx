import { differenceInMinutes } from "date-fns";
import { formatMoney } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export function shiftDuration(openedAt: string, closedAt: string | null, now = new Date()): string {
  const mins = Math.max(0, differenceInMinutes(closedAt ? new Date(closedAt) : now, new Date(openedAt)));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function differenceKind(value: number): "over" | "short" | "balanced" {
  return value > 0 ? "over" : value < 0 ? "short" : "balanced";
}

/** Colored over/short/balanced indicator for a cash difference (cents). */
export function DifferenceBadge({ value, large, className }: { value: number; large?: boolean; className?: string }) {
  const kind = differenceKind(value);
  const tone =
    kind === "balanced" ? "bg-success-soft text-success-foreground" : kind === "over" ? "bg-info-soft text-info-foreground" : "bg-destructive-soft text-destructive-foreground";
  const label = kind === "balanced" ? "Balanced" : kind === "over" ? "Over" : "Short";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full font-medium tabular whitespace-nowrap", large ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs", tone, className)} data-kind={kind}>
      {label}
      {kind !== "balanced" && <span>{value > 0 ? "+" : "-"}{formatMoney(Math.abs(value))}</span>}
    </span>
  );
}

/** Parse a rupee amount typed by the user. Returns null when invalid. */
export function parseRupees(raw: string): number | null {
  const v = raw.trim().replace(/,/g, "");
  if (v === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
