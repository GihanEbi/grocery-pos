import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import type { Cents, ProductUnit } from "@/types";

const moneyFmt = new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat("en-LK", { notation: "compact", maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat("en-LK");

/** "Rs 1,250.00" — the currency symbol prefix is LKR's common local form. */
export function formatMoney(cents: Cents, opts: { symbol?: boolean; currency?: string } = {}): string {
  const value = moneyFmt.format(cents / 100);
  if (opts.symbol === false) return value;
  const sym = !opts.currency || opts.currency === "LKR" ? "Rs" : opts.currency;
  return cents < 0 ? `-${sym} ${moneyFmt.format(Math.abs(cents) / 100)}` : `${sym} ${value}`;
}

/** "Rs 1.2M" for chart axes and compact KPI subtitles. */
export function formatMoneyCompact(cents: Cents): string {
  return `Rs ${compactFmt.format(cents / 100)}`;
}

export function formatNumber(n: number): string {
  return intFmt.format(n);
}

const unitLabel: Record<ProductUnit, string> = {
  pcs: "pcs",
  kg: "kg",
  pack: "pack",
  bottle: "btl",
  l: "L",
  dozen: "doz",
  box: "box",
};

export function unitShort(unit: ProductUnit): string {
  return unitLabel[unit];
}

export function formatQty(qty: number, unit?: ProductUnit): string {
  const v = unit === "kg" ? (Math.round(qty * 1000) / 1000).toString() : intFmt.format(Math.round(qty * 1000) / 1000);
  return unit ? `${v} ${unitLabel[unit]}` : v;
}

/** bps → "18%" or "12.5%" */
export function formatPercent(bps: number, digits = 1): string {
  const v = bps / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(digits)}%`;
}

export function formatDate(iso: string | Date): string {
  return format(new Date(iso), "dd MMM yyyy");
}

export function formatDateTime(iso: string | Date): string {
  return format(new Date(iso), "dd MMM yyyy, hh:mm a");
}

export function formatTime(iso: string | Date): string {
  return format(new Date(iso), "hh:mm a");
}

export function formatRelative(iso: string | Date): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${format(d, "hh:mm a")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "hh:mm a")}`;
  return format(d, "dd MMM, hh:mm a");
}

export function timeAgo(iso: string | Date): string {
  return `${formatDistanceToNowStrict(new Date(iso))} ago`;
}

export const paymentMethodLabel: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  qr: "QR Pay",
  bank: "Bank transfer",
  split: "Split",
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
