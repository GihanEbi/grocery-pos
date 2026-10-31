import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  differenceInCalendarDays,
} from "date-fns";
import type { Batch, Category, Cents, Expense, Product, Sale, SaleReturn, Supplier } from "@/types";
import { multiply, roundQty } from "@/lib/calculations/money";
import { daysUntil, expiryStatus, stockStatus, type ExpiryStatus, type StockStatus } from "@/lib/calculations/inventory";
import { forecastReorder, type ReorderPriority } from "@/lib/calculations/forecasting";

/**
 * Shared analytics. Dashboard, reports and the AI assistant all call these so
 * that every screen reports identical numbers from the same records.
 * Historical figures always use the price/cost snapshots stored on each sale.
 */

export interface DateRange {
  from: Date;
  to: Date;
}

export type RangePreset = "today" | "yesterday" | "last7" | "last30" | "thisWeek" | "thisMonth" | "lastMonth" | "all";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "thisWeek", label: "This week" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "all", label: "All time" },
];

export function rangeFromPreset(preset: RangePreset, now = new Date()): DateRange {
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday":
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "thisWeek":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "last30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "lastMonth":
      return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    case "all":
      return { from: new Date(2000, 0, 1), to: endOfDay(now) };
  }
}

/** The equal-length period immediately before `range`, for % change comparisons. */
export function previousRange(range: DateRange): DateRange {
  const days = differenceInCalendarDays(range.to, range.from) + 1;
  return { from: startOfDay(subDays(range.from, days)), to: endOfDay(subDays(range.from, 1)) };
}

export const inRange = (iso: string, r: DateRange) => {
  const t = new Date(iso).getTime();
  return t >= r.from.getTime() && t <= r.to.getTime();
};

export function salesInRange(sales: Sale[], r: DateRange) {
  return sales.filter((s) => inRange(s.date, r));
}

/** Net (after returns) revenue ex-tax, cost and quantity for a sale line. */
export function effectiveLine(item: Sale["items"][number]) {
  const qty = roundQty(item.quantity - item.returnedQty);
  const share = item.quantity > 0 ? qty / item.quantity : 0;
  const revenue = Math.round(item.revenue * share);
  const cost = multiply(item.unitCost, qty);
  return { qty, revenue, cost, profit: revenue - cost };
}

export interface SalesSummary {
  grossSales: Cents;
  refunds: Cents;
  netSales: Cents;
  transactions: number;
  avgBasket: Cents;
  revenue: Cents;
  cogs: Cents;
  grossProfit: Cents;
  marginBps: number;
  tax: Cents;
  discounts: Cents;
  itemsSold: number;
}

export function summarize(sales: Sale[], returns: SaleReturn[], r: DateRange): SalesSummary {
  const list = salesInRange(sales, r);
  const refunds = returns.filter((x) => inRange(x.date, r)).reduce((a, x) => a + x.refundAmount, 0);
  let grossSales = 0, revenue = 0, cogs = 0, tax = 0, discounts = 0, itemsSold = 0;
  for (const s of list) {
    grossSales += s.total;
    tax += s.taxTotal;
    discounts += s.itemDiscountTotal + (s.billDiscount?.amount ?? 0);
    for (const it of s.items) {
      const e = effectiveLine(it);
      revenue += e.revenue;
      cogs += e.cost;
      itemsSold += it.unit === "kg" ? 1 : e.qty;
    }
  }
  const grossProfit = revenue - cogs;
  return {
    grossSales,
    refunds,
    netSales: grossSales - refunds,
    transactions: list.length,
    avgBasket: list.length ? Math.round(grossSales / list.length) : 0,
    revenue,
    cogs,
    grossProfit,
    marginBps: revenue > 0 ? Math.round((grossProfit * 10000) / revenue) : 0,
    tax,
    discounts,
    itemsSold: Math.round(itemsSold),
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export interface DailyPoint {
  date: string;
  label: string;
  sales: Cents;
  revenue: Cents;
  profit: Cents;
  transactions: number;
  refunds: Cents;
}

export function dailySeries(sales: Sale[], returns: SaleReturn[], r: DateRange): DailyPoint[] {
  const to = r.to.getTime() > Date.now() ? new Date() : r.to;
  const days = eachDayOfInterval({ start: r.from, end: to });
  const map = new Map<string, DailyPoint>(
    days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return [key, { date: key, label: format(d, days.length > 31 ? "dd MMM" : "EEE dd"), sales: 0, revenue: 0, profit: 0, transactions: 0, refunds: 0 }];
    }),
  );
  for (const s of salesInRange(sales, r)) {
    const p = map.get(format(new Date(s.date), "yyyy-MM-dd"));
    if (!p) continue;
    p.sales += s.total;
    p.transactions += 1;
    for (const it of s.items) {
      const e = effectiveLine(it);
      p.revenue += e.revenue;
      p.profit += e.profit;
    }
  }
  for (const x of returns.filter((x) => inRange(x.date, r))) {
    const p = map.get(format(new Date(x.date), "yyyy-MM-dd"));
    if (p) p.refunds += x.refundAmount;
  }
  return [...map.values()];
}

export interface ProductPerformance {
  productId: string;
  name: string;
  unit: string;
  qty: number;
  revenue: Cents;
  profit: Cents;
  transactions: number;
}

export function productPerformance(sales: Sale[], r: DateRange): ProductPerformance[] {
  const map = new Map<string, ProductPerformance>();
  for (const s of salesInRange(sales, r)) {
    for (const it of s.items) {
      const e = effectiveLine(it);
      const cur = map.get(it.productId) ?? { productId: it.productId, name: it.name, unit: it.unit, qty: 0, revenue: 0, profit: 0, transactions: 0 };
      cur.qty = roundQty(cur.qty + e.qty);
      cur.revenue += e.revenue;
      cur.profit += e.profit;
      cur.transactions += 1;
      map.set(it.productId, cur);
    }
  }
  return [...map.values()];
}

export function topProducts(sales: Sale[], r: DateRange, n = 5, by: "revenue" | "qty" | "profit" = "revenue") {
  return productPerformance(sales, r)
    .sort((a, b) => b[by] - a[by])
    .slice(0, n);
}

export interface CategoryPerformance {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  revenue: Cents;
  profit: Cents;
  qty: number;
}

export function categoryPerformance(sales: Sale[], products: Product[], categories: Category[], r: DateRange): CategoryPerformance[] {
  const productCat = new Map(products.map((p) => [p.id, p.categoryId]));
  const map = new Map<string, CategoryPerformance>(
    categories.map((c) => [c.id, { categoryId: c.id, name: c.name, color: c.color, icon: c.icon, revenue: 0, profit: 0, qty: 0 }]),
  );
  for (const s of salesInRange(sales, r)) {
    for (const it of s.items) {
      const cat = map.get(productCat.get(it.productId) ?? "");
      if (!cat) continue;
      const e = effectiveLine(it);
      cat.revenue += e.revenue;
      cat.profit += e.profit;
      cat.qty += e.qty;
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

export function paymentBreakdown(sales: Sale[], r: DateRange) {
  const rows = { cash: { method: "cash", label: "Cash", amount: 0, count: 0 }, card: { method: "card", label: "Card", amount: 0, count: 0 }, qr: { method: "qr", label: "QR Pay", amount: 0, count: 0 } };
  for (const s of salesInRange(sales, r)) {
    for (const p of s.payments) {
      rows[p.method].amount += p.amount;
      rows[p.method].count += 1;
    }
  }
  return Object.values(rows);
}

/** Units sold per product in the last `days` days. */
export function unitsSold(sales: Sale[], days: number, now = new Date()): Map<string, number> {
  const from = startOfDay(subDays(now, days - 1)).getTime();
  const map = new Map<string, number>();
  for (const s of sales) {
    if (new Date(s.date).getTime() < from) continue;
    for (const it of s.items) map.set(it.productId, roundQty((map.get(it.productId) ?? 0) + it.quantity - it.returnedQty));
  }
  return map;
}

export interface ReorderSuggestion {
  product: Product;
  supplier: Supplier | null;
  stock: number;
  minStock: number;
  unitsSold14d: number;
  dailyVelocity: number;
  daysOfCover: number;
  reorderPoint: number;
  suggestedQty: number;
  priority: ReorderPriority;
  estimatedCost: Cents;
}

export const PRIORITY_RANK: Record<ReorderPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Products that should be reordered, using 14-day sales velocity and supplier lead time. */
export function reorderSuggestions(products: Product[], suppliers: Supplier[], sales: Sale[], now = new Date()): ReorderSuggestion[] {
  const sold = unitsSold(sales, 14, now);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const out: ReorderSuggestion[] = [];
  for (const p of products) {
    if (p.status !== "active") continue;
    const supplier = p.supplierId ? supplierById.get(p.supplierId) ?? null : null;
    const f = forecastReorder({
      stock: p.stock,
      minStock: p.minStock,
      unitsSold: sold.get(p.id) ?? 0,
      windowDays: 14,
      leadTimeDays: supplier?.leadTimeDays ?? 3,
      wholeUnits: p.unit !== "kg",
    });
    if (!f.needsReorder || f.suggestedQty <= 0) continue;
    out.push({
      product: p,
      supplier,
      stock: p.stock,
      minStock: p.minStock,
      unitsSold14d: sold.get(p.id) ?? 0,
      dailyVelocity: f.dailyVelocity,
      daysOfCover: f.daysOfCover,
      reorderPoint: f.reorderPoint,
      suggestedQty: f.suggestedQty,
      priority: f.priority === "low" ? "medium" : f.priority,
      estimatedCost: multiply(p.purchasePrice, f.suggestedQty),
    });
  }
  return out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.dailyVelocity - a.dailyVelocity);
}

export interface ExpiryRow {
  batch: Batch;
  product: Product;
  daysLeft: number;
  status: ExpiryStatus;
  value: Cents;
}

export function expiryRows(batches: Batch[], products: Product[], now = new Date()): ExpiryRow[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return batches
    .filter((b) => b.quantity > 0 && byId.has(b.productId))
    .map((b) => {
      const product = byId.get(b.productId)!;
      return { batch: b, product, daysLeft: daysUntil(b.expiryDate, now), status: expiryStatus(b.expiryDate, now), value: multiply(b.costPrice, b.quantity) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function stockCounts(products: Product[]) {
  const active = products.filter((p) => p.status === "active");
  const statuses = active.map((p) => stockStatus(p.stock, p.minStock));
  return {
    active: active.length,
    inStock: statuses.filter((s) => s === "in_stock").length,
    low: statuses.filter((s) => s === "low_stock").length,
    out: statuses.filter((s) => s === "out_of_stock").length,
  };
}

export function productStockStatus(p: Pick<Product, "stock" | "minStock">): StockStatus {
  return stockStatus(p.stock, p.minStock);
}

/** Active products with no sales in `days` days (slow movers). */
export function slowMovers(products: Product[], sales: Sale[], days = 21, now = new Date()) {
  const sold = unitsSold(sales, days, now);
  return products.filter((p) => p.status === "active" && p.stock > 0 && (sold.get(p.id) ?? 0) === 0);
}

export function expenseTotal(expenses: Expense[], r: DateRange): Cents {
  return expenses.filter((e) => inRange(e.date, r)).reduce((a, e) => a + e.amount, 0);
}

export function expensesByCategory(expenses: Expense[], r: DateRange) {
  const map = new Map<string, number>();
  for (const e of expenses) if (inRange(e.date, r)) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return map;
}

/** Monthly totals of expenses for the last `months` months (oldest first). */
export function monthlyExpenses(expenses: Expense[], months = 6, now = new Date()) {
  return Array.from({ length: months }, (_, i) => {
    const d = subMonths(now, months - 1 - i);
    const r = { from: startOfMonth(d), to: endOfMonth(d) };
    return { month: format(d, "MMM yyyy"), label: format(d, "MMM"), amount: expenseTotal(expenses, r) };
  });
}

/** Day-by-day comparison of this week vs last week (Mon–Sun). */
export function weekComparison(sales: Sale[], now = new Date()) {
  const thisStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastStart = subDays(thisStart, 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d1 = subDays(thisStart, -i);
    const d0 = subDays(lastStart, -i);
    const sumDay = (d: Date) => salesInRange(sales, { from: startOfDay(d), to: endOfDay(d) }).reduce((a, s) => a + s.total, 0);
    return { day: format(d1, "EEE"), thisWeek: d1 > now ? null : sumDay(d1), lastWeek: sumDay(d0) };
  });
}
