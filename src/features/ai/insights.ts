import { endOfDay, startOfDay, subDays } from "date-fns";
import type { AppData } from "@/types/data";
import {
  expiryRows,
  percentChange,
  rangeFromPreset,
  reorderSuggestions,
  slowMovers,
  stockCounts,
  summarize,
  topProducts,
  productStockStatus,
} from "@/lib/analytics";
import { inventoryValue } from "@/lib/calculations/inventory";
import { sum } from "@/lib/calculations/money";
import { formatMoney, formatNumber, formatQty } from "@/lib/formatting";
import type { ProductUnit } from "@/types";
import type { AiDailySummaryData, AiInsight, AiInsightSeverity, AiRecommendation } from "./types";
import { askHref } from "./links";

/**
 * Deterministic "AI" insight cards and the daily business summary. Shown on the
 * dashboard and the assistant page; all numbers come from `@/lib/analytics`.
 */

const SEVERITY_RANK: Record<AiInsightSeverity, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export function generateInsights(data: AppData, now: Date = new Date()): AiInsight[] {
  const insights: AiInsight[] = [];
  const active = data.products.filter((p) => p.status === "active");

  // 1. Low-stock risk
  const out = active.filter((p) => productStockStatus(p) === "out_of_stock");
  const low = active.filter((p) => productStockStatus(p) === "low_stock").sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock));
  if (out.length + low.length > 0) {
    const names = [...out, ...low].slice(0, 2).map((p) => p.name);
    insights.push({
      id: "low_stock",
      kind: "low_stock",
      severity: out.length ? "critical" : "warning",
      title: out.length ? `${plural(out.length, "product")} out of stock` : `${plural(low.length, "product")} running low`,
      message: `${names.join(" and ")}${out.length + low.length > 2 ? ` and ${out.length + low.length - 2} more` : ""} ${out.length + low.length === 1 ? "needs" : "need"} restocking${out.length && low.length ? `; ${low.length} more are below minimum` : ""}.`,
      metric: formatNumber(out.length + low.length),
      href: out.length ? "/inventory?status=out_of_stock" : "/inventory?status=low_stock",
      actionLabel: "Review stock",
    });
  }

  // 2. Expiring inventory
  const exp = expiryRows(data.batches, data.products, now);
  const expired = exp.filter((r) => r.daysLeft < 0);
  const soon = exp.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 3);
  if (expired.length + soon.length > 0) {
    const value = sum([...expired, ...soon].map((r) => r.value));
    insights.push({
      id: "expiry",
      kind: "expiry",
      severity: expired.length ? "critical" : "warning",
      title: soon.length ? `${plural(soon.length, "batch", "batches")} expire within 3 days` : `${plural(expired.length, "expired batch", "expired batches")} on hand`,
      message: `${soon[0] ? `${soon[0].product.name} is the most urgent. ` : ""}${expired.length ? `${plural(expired.length, "batch", "batches")} already expired. ` : ""}${formatMoney(value)} of stock at cost is at risk.`,
      metric: formatMoney(value),
      href: expired.length ? "/inventory/expiry?tab=expired" : "/inventory/expiry",
      actionLabel: "Review expiry",
    });
  }

  // 3. Reorder needs
  const reorder = reorderSuggestions(data.products, data.suppliers, data.sales, now);
  if (reorder.length) {
    const urgent = reorder.filter((r) => r.priority === "critical" || r.priority === "high").length;
    insights.push({
      id: "reorder",
      kind: "reorder",
      severity: urgent ? "warning" : "info",
      title: `Reorder ${plural(reorder.length, "product")}`,
      message: `${urgent ? `${urgent} high-priority. ` : ""}Suggested quantities cover lead time plus 14 days of demand — est. ${formatMoney(sum(reorder.map((r) => r.estimatedCost)))}.`,
      metric: formatMoney(sum(reorder.map((r) => r.estimatedCost))),
      href: askHref("What should I reorder?"),
      actionLabel: "See reorder plan",
    });
  }

  // 4. Sales change vs the previous 7 days
  const last7 = rangeFromPreset("last7", now);
  const prev7 = { from: startOfDay(subDays(last7.from, 7)), to: endOfDay(subDays(last7.from, 1)) };
  const cur = summarize(data.sales, data.returns, last7);
  const prev = summarize(data.sales, data.returns, prev7);
  const change = percentChange(cur.netSales, prev.netSales);
  if (cur.transactions > 0 && change !== null) {
    insights.push({
      id: "sales_change",
      kind: "sales_change",
      severity: change >= 0 ? "positive" : change <= -10 ? "warning" : "info",
      title: change >= 0 ? `Sales up ${change}% week over week` : `Sales down ${Math.abs(change)}% week over week`,
      message: `${formatMoney(cur.netSales)} in the last 7 days vs ${formatMoney(prev.netSales)} in the 7 days before.`,
      metric: `${change > 0 ? "+" : ""}${change}%`,
      href: askHref("Compare this week's sales with last week"),
      actionLabel: "Compare weeks",
    });
  }

  // 5. Top performer this week
  const top = topProducts(data.sales, last7, 1)[0];
  if (top) {
    const product = data.products.find((p) => p.id === top.productId);
    insights.push({
      id: "top_performer",
      kind: "top_performer",
      severity: "positive",
      title: `${top.name} is your top seller`,
      message: `${formatMoney(top.revenue)} revenue from ${formatQty(top.qty, top.unit as ProductUnit)} sold in the last 7 days.`,
      metric: formatMoney(top.revenue),
      href: product ? `/products?q=${encodeURIComponent(product.sku)}` : "/products",
      actionLabel: "View product",
    });
  }

  // 6. Slow movers
  const slow = slowMovers(data.products, data.sales, 21, now);
  if (slow.length) {
    insights.push({
      id: "slow_movers",
      kind: "slow_movers",
      severity: "info",
      title: `${plural(slow.length, "slow-moving product")}`,
      message: `No sales in 21 days, tying up ${formatMoney(inventoryValue(slow))} at cost. Consider a promotion or pausing reorders.`,
      metric: formatMoney(inventoryValue(slow)),
      href: askHref("Which products are slow moving?"),
      actionLabel: "See slow movers",
    });
  }

  return insights.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

export function dailySummary(data: AppData, now: Date = new Date()): AiDailySummaryData {
  const today = rangeFromPreset("today", now);
  const s = summarize(data.sales, data.returns, today);
  const sameTimeYesterday = summarize(data.sales, data.returns, { from: startOfDay(subDays(now, 1)), to: subDays(now, 1) });
  const salesChange = percentChange(s.netSales, sameTimeYesterday.netSales);
  const counts = stockCounts(data.products);
  const exp = expiryRows(data.batches, data.products, now);
  const expiring = exp.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 3);
  const expired = exp.filter((r) => r.daysLeft < 0);
  const reorder = reorderSuggestions(data.products, data.suppliers, data.sales, now);
  const top = topProducts(data.sales, today, 1)[0];

  let headline: string;
  if (s.transactions === 0) {
    headline = "No sales have been recorded yet today.";
  } else {
    headline = `Today so far you've sold **${formatMoney(s.netSales)}** from ${plural(s.transactions, "transaction")}`;
    if (salesChange !== null && salesChange !== 0) headline += ` (${salesChange > 0 ? "up" : "down"} ${Math.abs(salesChange)}% vs the same time yesterday)`;
    headline += `, with **${formatMoney(s.grossProfit)}** gross profit.`;
    if (top) headline += ` ${top.name} is leading at ${formatMoney(top.revenue)}.`;
  }
  const restock = counts.low + counts.out;
  headline += restock || expiring.length ? ` ${restock ? `${plural(restock, "product")} need restocking` : ""}${restock && expiring.length ? " and " : ""}${expiring.length ? `${plural(expiring.length, "batch", "batches")} expire within 3 days` : ""}.` : " Stock and expiry look healthy.";

  const recs: AiRecommendation[] = [];
  if (counts.out) recs.push({ label: "Restock out-of-stock items", detail: `${plural(counts.out, "product")} ${counts.out === 1 ? "has" : "have"} no stock left.`, href: "/inventory?status=out_of_stock", severity: "critical" });
  if (expired.length) recs.push({ label: "Write off expired stock", detail: `${plural(expired.length, "batch", "batches")} expired and should not be sold.`, href: "/inventory/expiry?tab=expired", severity: "critical" });
  if (reorder.length) recs.push({ label: "Create purchase orders", detail: `${plural(reorder.length, "product")} at the reorder point (est. ${formatMoney(sum(reorder.map((r) => r.estimatedCost)))}).`, href: askHref("What should I reorder?"), severity: "warning" });
  if (expiring.length) recs.push({ label: "Discount near-expiry items", detail: `${plural(expiring.length, "batch", "batches")} expire within 3 days.`, href: "/inventory/expiry", severity: "warning" });
  if (counts.low && !reorder.length) recs.push({ label: "Review low stock", detail: `${plural(counts.low, "product")} below minimum level.`, href: "/inventory?status=low_stock", severity: "warning" });
  if (salesChange !== null && salesChange <= -10) recs.push({ label: "Check today's sales", detail: `Sales are ${Math.abs(salesChange)}% behind yesterday at this time.`, href: "/sales", severity: "info" });
  if (recs.length < 3) recs.push({ label: "Review profit report", detail: "See margins by product and category.", href: "/reports?tab=profit", severity: "info" });

  return {
    date: now.toISOString(),
    netSales: s.netSales,
    transactions: s.transactions,
    avgBasket: s.avgBasket,
    grossProfit: s.grossProfit,
    marginBps: s.marginBps,
    salesChange,
    lowStockCount: counts.low,
    outOfStockCount: counts.out,
    expiringCount: expiring.length,
    expiredCount: expired.length,
    reorderCount: reorder.length,
    topProduct: top ? { name: top.name, revenue: top.revenue } : null,
    headline,
    recommendations: recs.slice(0, 5),
  };
}
