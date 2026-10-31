import type { Cents, DiscountType, PaymentMethod, Payment } from "@/types";
import { allocate, clamp, inclusiveTax, multiply, percentOf, sum } from "./money.ts";

/** Minimal line input for cart totals. Independent from the store. */
export interface CartLineInput {
  productId: string;
  unitPrice: Cents;
  quantity: number;
  /** Requested line discount in cents. */
  discount: Cents;
  taxable: boolean;
}

export interface BillDiscountInput {
  type: DiscountType;
  /** bps when percent, cents when fixed */
  value: number;
}

export interface TaxConfig {
  rateBps: number;
  mode: "exclusive" | "inclusive";
}

export interface CartLineTotals {
  productId: string;
  gross: Cents;
  itemDiscount: Cents;
  billDiscountShare: Cents;
  /** After item + bill discounts. Includes tax when mode is inclusive. */
  net: Cents;
  taxRateBps: number;
  tax: Cents;
  /** Revenue excluding tax. */
  revenue: Cents;
  /** What the customer pays for this line. */
  lineTotal: Cents;
}

export interface CartTotals {
  lines: CartLineTotals[];
  /** Sum of gross line amounts (before any discount). */
  grossTotal: Cents;
  itemDiscountTotal: Cents;
  /** Gross minus item discounts. */
  subtotal: Cents;
  billDiscountAmount: Cents;
  taxTotal: Cents;
  grandTotal: Cents;
  /** Effective bill discount in bps of the subtotal (for limit checks). */
  billDiscountBps: number;
  itemCount: number;
}

export function lineGross(unitPrice: Cents, quantity: number): Cents {
  return multiply(unitPrice, quantity);
}

/** Clamp a line discount so it never exceeds the line gross. */
export function itemDiscount(gross: Cents, discount: Cents): Cents {
  return clamp(Math.round(discount), 0, gross);
}

/** Bill discount amount, clamped to [0, subtotal]. */
export function billDiscountAmount(subtotal: Cents, discount: BillDiscountInput | null): Cents {
  if (!discount || subtotal <= 0) return 0;
  const raw = discount.type === "percent" ? percentOf(subtotal, discount.value) : Math.round(discount.value);
  return clamp(raw, 0, subtotal);
}

/**
 * Compute all cart totals deterministically:
 * gross → item discounts → subtotal → bill discount (allocated per line) → tax → grand total.
 */
export function calculateCart(
  lines: CartLineInput[],
  billDiscount: BillDiscountInput | null,
  tax: TaxConfig,
): CartTotals {
  const gross = lines.map((l) => lineGross(l.unitPrice, l.quantity));
  const itemDisc = lines.map((l, i) => itemDiscount(gross[i], l.discount));
  const afterItem = gross.map((g, i) => g - itemDisc[i]);
  const subtotal = sum(afterItem);
  const billAmt = billDiscountAmount(subtotal, billDiscount);
  const shares = allocate(billAmt, afterItem);

  const lineTotals: CartLineTotals[] = lines.map((l, i) => {
    const net = afterItem[i] - shares[i];
    const rate = l.taxable ? tax.rateBps : 0;
    let taxAmt = 0;
    let revenue = net;
    let lineTotal = net;
    if (rate > 0) {
      if (tax.mode === "exclusive") {
        taxAmt = percentOf(net, rate);
        lineTotal = net + taxAmt;
      } else {
        taxAmt = inclusiveTax(net, rate);
        revenue = net - taxAmt;
      }
    }
    return {
      productId: l.productId,
      gross: gross[i],
      itemDiscount: itemDisc[i],
      billDiscountShare: shares[i],
      net,
      taxRateBps: rate,
      tax: taxAmt,
      revenue,
      lineTotal,
    };
  });

  const taxTotal = sum(lineTotals.map((l) => l.tax));
  const grandTotal = sum(lineTotals.map((l) => l.lineTotal));
  return {
    lines: lineTotals,
    grossTotal: sum(gross),
    itemDiscountTotal: sum(itemDisc),
    subtotal,
    billDiscountAmount: billAmt,
    taxTotal,
    grandTotal,
    billDiscountBps: subtotal > 0 ? Math.round((billAmt * 10000) / subtotal) : 0,
    itemCount: lines.length,
  };
}

/** Change due for a cash payment. Negative means insufficient cash. */
export function cashChange(amountDue: Cents, tendered: Cents): Cents {
  return tendered - amountDue;
}

/** Validates that a discount (in bps of subtotal) is within the role limit. */
export function isDiscountAllowed(discountBps: number, limitBps: number): boolean {
  return discountBps <= limitBps;
}

export interface PaymentDraft {
  method: PaymentMethod;
  /** Amount applied (for cash: tendered). */
  amount: Cents;
}

export interface PaymentValidation {
  ok: boolean;
  error?: string;
  /** Normalized payments where cash amount = applied amount. */
  payments: Payment[];
  change: Cents;
  paid: Cents;
  remaining: Cents;
}

/**
 * Validate a (possibly split) payment. Non-cash methods may not overpay;
 * only cash can generate change.
 */
export function validatePayments(total: Cents, drafts: PaymentDraft[]): PaymentValidation {
  const clean = drafts.filter((d) => d.amount > 0);
  const nonCash = sum(clean.filter((d) => d.method !== "cash").map((d) => d.amount));
  const cashTendered = sum(clean.filter((d) => d.method === "cash").map((d) => d.amount));
  const paid = nonCash + cashTendered;
  const base = { payments: [] as Payment[], change: 0, paid, remaining: Math.max(0, total - paid) };

  if (clean.length === 0) return { ...base, ok: false, error: "Enter a payment amount." };
  if (nonCash > total) return { ...base, ok: false, error: "Card/QR amounts cannot exceed the bill total." };
  if (paid < total) return { ...base, ok: false, error: `Payment is short by ${(total - paid) / 100} LKR.` };

  const cashDue = total - nonCash;
  const change = cashTendered - cashDue;
  const payments: Payment[] = [];
  for (const method of ["cash", "card", "qr"] as PaymentMethod[]) {
    const amt = sum(clean.filter((d) => d.method === method).map((d) => d.amount));
    if (amt <= 0) continue;
    if (method === "cash") {
      if (cashDue > 0) payments.push({ method, amount: cashDue, tendered: amt });
    } else payments.push({ method, amount: amt });
  }
  return { ok: true, payments, change, paid, remaining: 0 };
}

/** Loyalty points earned for a bill total. */
export function loyaltyPoints(total: Cents, pointsPer100: number): number {
  return Math.floor(total / 10000) * pointsPer100;
}
