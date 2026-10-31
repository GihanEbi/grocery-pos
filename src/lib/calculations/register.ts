import type { CashAdjustment, Cents, Sale, SaleReturn, Shift } from "@/types";
import { sum } from "./money.ts";

export interface ShiftSummary {
  openingCash: Cents;
  cashSales: Cents;
  cardSales: Cents;
  qrSales: Cents;
  totalSales: Cents;
  transactions: number;
  cashRefunds: Cents;
  payIns: Cents;
  payOuts: Cents;
  expectedCash: Cents;
  countedCash: Cents | null;
  difference: Cents | null;
}

export function cashAdjustmentTotal(adjustments: CashAdjustment[]): { payIns: Cents; payOuts: Cents } {
  return {
    payIns: sum(adjustments.filter((a) => a.type === "pay_in").map((a) => a.amount)),
    payOuts: sum(adjustments.filter((a) => a.type === "pay_out").map((a) => a.amount)),
  };
}

/** Expected drawer cash = opening + cash sales − cash refunds + pay-ins − pay-outs. */
export function expectedCash(opening: Cents, cashSales: Cents, cashRefunds: Cents, payIns: Cents, payOuts: Cents): Cents {
  return opening + cashSales - cashRefunds + payIns - payOuts;
}

/** Positive = over, negative = short. */
export function cashDifference(counted: Cents, expected: Cents): Cents {
  return counted - expected;
}

export function summarizeShift(shift: Shift, sales: Sale[], returns: SaleReturn[]): ShiftSummary {
  const own = sales.filter((s) => s.shiftId === shift.id);
  const byMethod = (m: string) => sum(own.flatMap((s) => s.payments.filter((p) => p.method === m).map((p) => p.amount)));
  const cashSales = byMethod("cash");
  const cashRefunds = sum(returns.filter((r) => r.shiftId === shift.id && r.refundMethod === "cash").map((r) => r.refundAmount));
  const { payIns, payOuts } = cashAdjustmentTotal(shift.adjustments);
  const expected = expectedCash(shift.openingCash, cashSales, cashRefunds, payIns, payOuts);
  return {
    openingCash: shift.openingCash,
    cashSales,
    cardSales: byMethod("card"),
    qrSales: byMethod("qr"),
    totalSales: sum(own.map((s) => s.total)),
    transactions: own.length,
    cashRefunds,
    payIns,
    payOuts,
    expectedCash: shift.status === "closed" && shift.expectedCash !== null ? shift.expectedCash : expected,
    countedCash: shift.countedCash,
    difference: shift.countedCash !== null ? cashDifference(shift.countedCash, shift.expectedCash ?? expected) : null,
  };
}
