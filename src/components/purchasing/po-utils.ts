import { addDays, format } from "date-fns";
import { multiply, roundQty, sum } from "@/lib/calculations/money";
import type { Cents, POStatus, ProductUnit, PurchaseOrder, PurchaseOrderItem } from "@/types";

export const OPEN_PO_STATUSES: POStatus[] = ["draft", "approved", "partially_received"];

/** Line total at cost for an ordered line. */
export function lineCost(item: Pick<PurchaseOrderItem, "unitCost" | "quantity">): Cents {
  return multiply(item.unitCost, item.quantity);
}

/** Total purchasing cost of an order (ordered quantity × unit cost). */
export function poTotal(po: Pick<PurchaseOrder, "items">): Cents {
  return sum(po.items.map(lineCost));
}

/** Value of the stock still to be delivered. */
export function poOutstandingValue(po: Pick<PurchaseOrder, "items">): Cents {
  return sum(po.items.map((i) => multiply(i.unitCost, Math.max(0, roundQty(i.quantity - i.receivedQty)))));
}

/** Value of the stock already received. */
export function poReceivedValue(po: Pick<PurchaseOrder, "items">): Cents {
  return sum(po.items.map((i) => multiply(i.unitCost, i.receivedQty)));
}

export function poUnits(po: Pick<PurchaseOrder, "items">): number {
  return roundQty(po.items.reduce((a, i) => a + i.quantity, 0));
}

export function poReceivedUnits(po: Pick<PurchaseOrder, "items">): number {
  return roundQty(po.items.reduce((a, i) => a + i.receivedQty, 0));
}

/** yyyy-MM-dd for <input type="date">, `days` from today. */
export function dateInputFromToday(days: number): string {
  return format(addDays(new Date(), days), "yyyy-MM-dd");
}

/** yyyy-MM-dd → ISO at local noon (avoids timezone day-shifts). */
export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
}

/** Parse a user-typed quantity. Returns null when not a usable number. */
export function parseQty(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Validate a quantity for a unit. `max` is inclusive. Returns an error message or null. */
export function qtyError(raw: string, unit: ProductUnit, opts: { min?: "positive" | "zero"; max?: number } = {}): string | null {
  const n = parseQty(raw);
  if (n === null) return "Enter a quantity";
  const allowZero = opts.min === "zero";
  if (allowZero ? n < 0 : n <= 0) return allowZero ? "Can't be negative" : "Must be more than 0";
  if (unit !== "kg" && !Number.isInteger(n)) return "Whole numbers only";
  if (unit === "kg" && roundQty(n) !== n) return "Max 3 decimals";
  if (opts.max !== undefined && roundQty(n) > roundQty(opts.max)) return `Max ${roundQty(opts.max)}`;
  return null;
}
