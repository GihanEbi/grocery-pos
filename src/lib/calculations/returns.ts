import type { Cents, SaleItem } from "@/types";
import { roundQty } from "./money.ts";

/** Quantity still eligible for return on a sale line. */
export function returnableQty(item: Pick<SaleItem, "quantity" | "returnedQty">): number {
  return Math.max(0, roundQty(item.quantity - item.returnedQty));
}

export function validateReturnQty(
  item: Pick<SaleItem, "quantity" | "returnedQty">,
  qty: number,
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Return quantity must be greater than zero." };
  const max = returnableQty(item);
  if (roundQty(qty) > max) return { ok: false, error: `Only ${max} remaining eligible for return.` };
  return { ok: true };
}

/**
 * Refund for returning `qty` of a line, proportional to what the customer paid
 * (after discounts, including tax). Returning the full remainder refunds the exact
 * remaining amount so totals reconcile to the cent.
 */
export function refundAmount(
  item: Pick<SaleItem, "quantity" | "returnedQty" | "lineTotal" | "refundedAmount">,
  qty: number,
): Cents {
  const remainingQty = returnableQty(item);
  if (qty <= 0 || remainingQty <= 0) return 0;
  if (roundQty(qty) >= remainingQty) return item.lineTotal - item.refundedAmount;
  return Math.round((item.lineTotal * Math.round(qty * 1000)) / Math.round(item.quantity * 1000));
}
