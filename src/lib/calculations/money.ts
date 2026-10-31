import type { Cents } from "@/types";

/**
 * Integer-cent money helpers. All functions return integer cents and avoid
 * floating-point accumulation by rounding exactly once per operation.
 */

/** Convert a rupee amount (e.g. 125.5) into integer cents. */
export function toCents(rupees: number): Cents {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/** Convert integer cents into a rupee number (for inputs only, not math). */
export function fromCents(cents: Cents): number {
  return cents / 100;
}

/** Round a quantity to 3 decimal places (grams precision for kg items). */
export function roundQty(qty: number): number {
  return Math.round(qty * 1000) / 1000;
}

/** unitPrice (cents) × quantity, rounded to the nearest cent. */
export function multiply(unitPrice: Cents, quantity: number): Cents {
  // Scale quantity to an integer (3dp) to avoid float error, then round once.
  const qtyMilli = Math.round(quantity * 1000);
  return Math.round((unitPrice * qtyMilli) / 1000);
}

/** Percentage of an amount where rate is in basis points (1800 = 18%). */
export function percentOf(amount: Cents, rateBps: number): Cents {
  return Math.round((amount * rateBps) / 10000);
}

/** Extract the tax portion from a tax-inclusive amount. */
export function inclusiveTax(amount: Cents, rateBps: number): Cents {
  if (rateBps <= 0) return 0;
  return Math.round((amount * rateBps) / (10000 + rateBps));
}

export function sum(values: Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Split `total` across `weights` proportionally so the parts sum exactly to
 * `total` (largest-remainder method). Used to allocate bill discounts to lines.
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0 || total === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / weightSum);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    floored[order[k].i] += 1;
  }
  return floored;
}

/** Margin of selling over purchase price in bps (e.g. 2500 = 25%). */
export function marginBps(sellingPrice: Cents, purchasePrice: Cents): number {
  if (sellingPrice <= 0) return 0;
  return Math.round(((sellingPrice - purchasePrice) * 10000) / sellingPrice);
}
