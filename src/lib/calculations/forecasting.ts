/**
 * Simple, explainable demand forecasting used by the AI reorder suggestions.
 * velocity = units sold over the lookback window / window days.
 */

export interface ReorderInput {
  stock: number;
  minStock: number;
  /** Units sold in the lookback window. */
  unitsSold: number;
  windowDays: number;
  leadTimeDays: number;
  /** Days of stock the order should cover after it arrives. */
  coverDays?: number;
  /** Round order quantities to whole units (non-weighted products). */
  wholeUnits?: boolean;
}

export type ReorderPriority = "critical" | "high" | "medium" | "low";

export interface ReorderResult {
  dailyVelocity: number;
  reorderPoint: number;
  daysOfCover: number;
  suggestedQty: number;
  priority: ReorderPriority;
  needsReorder: boolean;
}

export function dailyVelocity(unitsSold: number, windowDays: number): number {
  if (windowDays <= 0) return 0;
  return Math.round((unitsSold / windowDays) * 100) / 100;
}

/** Reorder point = demand during lead time + safety stock (the min level). */
export function reorderThreshold(velocity: number, leadTimeDays: number, minStock: number): number {
  return Math.max(minStock, Math.ceil(velocity * leadTimeDays + minStock * 0.5));
}

export function forecastReorder(input: ReorderInput): ReorderResult {
  const cover = input.coverDays ?? 14;
  const v = dailyVelocity(input.unitsSold, input.windowDays);
  const rp = reorderThreshold(v, input.leadTimeDays, input.minStock);
  const daysOfCover = v > 0 ? Math.round((input.stock / v) * 10) / 10 : input.stock > 0 ? Infinity : 0;
  const target = Math.max(input.minStock * 2, Math.ceil(v * (input.leadTimeDays + cover)) + input.minStock);
  let qty = Math.max(0, target - Math.max(0, input.stock));
  qty = input.wholeUnits === false ? Math.ceil(qty * 10) / 10 : Math.ceil(qty);

  const needsReorder = input.stock <= rp;
  let priority: ReorderPriority = "low";
  if (input.stock <= 0) priority = "critical";
  else if (v > 0 && daysOfCover <= input.leadTimeDays) priority = "high";
  else if (input.stock <= input.minStock) priority = "medium";

  return { dailyVelocity: v, reorderPoint: rp, daysOfCover, suggestedQty: needsReorder ? qty : 0, priority, needsReorder };
}
