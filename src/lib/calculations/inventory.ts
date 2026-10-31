import type { Batch, Cents, Product } from "@/types";
import { multiply, roundQty, sum } from "./money.ts";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export function stockStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return "out_of_stock";
  if (stock <= minStock) return "low_stock";
  return "in_stock";
}

/** Is there enough stock to sell `requested` units? */
export function hasStock(available: number, requested: number, allowNegative = false): boolean {
  if (requested <= 0) return false;
  return allowNegative || roundQty(available - requested) >= 0;
}

/** Inventory value at purchase cost. */
export function inventoryValue(products: Pick<Product, "stock" | "purchasePrice">[]): Cents {
  return sum(products.map((p) => multiply(p.purchasePrice, Math.max(0, p.stock))));
}

/** Inventory value at selling price (potential revenue). */
export function inventoryRetailValue(products: Pick<Product, "stock" | "sellingPrice">[]): Cents {
  return sum(products.map((p) => multiply(p.sellingPrice, Math.max(0, p.stock))));
}

export function daysUntil(dateIso: string, now: Date): number {
  const ms = new Date(dateIso).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

export type ExpiryStatus = "expired" | "critical" | "soon" | "ok";

/** expired: past; critical: ≤3 days; soon: ≤14 days. */
export function expiryStatus(dateIso: string, now: Date): ExpiryStatus {
  const d = daysUntil(dateIso, now);
  if (d < 0) return "expired";
  if (d <= 3) return "critical";
  if (d <= 14) return "soon";
  return "ok";
}

/**
 * Deduct quantity from batches First-Expiry-First-Out, preferring
 * non-expired batches. Returns new batch list (immutable) and any shortfall.
 */
export function deductFromBatches(
  batches: Batch[],
  productId: string,
  qty: number,
  now: Date,
  opts: { expiredFirst?: boolean } = {},
): { batches: Batch[]; shortfall: number } {
  let remaining = roundQty(qty);
  const own = batches
    .filter((b) => b.productId === productId && b.quantity > 0)
    .sort((a, b) => {
      const ae = daysUntil(a.expiryDate, now) < 0;
      const be = daysUntil(b.expiryDate, now) < 0;
      if (ae !== be) return opts.expiredFirst ? (ae ? -1 : 1) : ae ? 1 : -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });
  const updates = new Map<string, number>();
  for (const b of own) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    updates.set(b.id, roundQty(b.quantity - take));
    remaining = roundQty(remaining - take);
  }
  return {
    batches: batches.map((b) => (updates.has(b.id) ? { ...b, quantity: updates.get(b.id)! } : b)),
    shortfall: remaining,
  };
}
