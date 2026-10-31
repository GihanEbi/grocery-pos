/**
 * Unit tests for the UI-independent business logic.
 * Run: npm run test:unit   (Node's built-in test runner with TypeScript stripping)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { allocate, inclusiveTax, multiply, percentOf, toCents } from "../../src/lib/calculations/money.ts";
import { calculateCart, cashChange, loyaltyPoints, validatePayments, billDiscountAmount } from "../../src/lib/calculations/cart.ts";
import { deductFromBatches, expiryStatus, hasStock, inventoryValue, stockStatus } from "../../src/lib/calculations/inventory.ts";
import { forecastReorder, reorderThreshold } from "../../src/lib/calculations/forecasting.ts";
import { cashDifference, expectedCash } from "../../src/lib/calculations/register.ts";
import { refundAmount, returnableQty, validateReturnQty } from "../../src/lib/calculations/returns.ts";

const TAX = { rateBps: 1800, mode: "exclusive" as const };

test("money: avoids floating point errors", () => {
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(multiply(23000, 2.5), 57500); // 2.5 kg × Rs 230
  assert.equal(multiply(1999, 0.333), 666);
  assert.equal(percentOf(10000, 1800), 1800);
  assert.equal(inclusiveTax(11800, 1800), 1800);
});

test("money: allocate splits exactly", () => {
  const parts = allocate(1000, [1, 1, 1]);
  assert.deepEqual(parts, [334, 333, 333]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 1000);
  assert.deepEqual(allocate(0, [5, 5]), [0, 0]);
});

test("cart: subtotal, discounts, exclusive tax and grand total", () => {
  const t = calculateCart(
    [
      { productId: "a", unitPrice: 20000, quantity: 2, discount: 0, taxable: false }, // Rs 400 bread
      { productId: "b", unitPrice: 62000, quantity: 1, discount: 2000, taxable: true }, // Rs 620 crackers − Rs 20
    ],
    { type: "percent", value: 1000 }, // 10% bill discount
    TAX,
  );
  assert.equal(t.grossTotal, 102000);
  assert.equal(t.itemDiscountTotal, 2000);
  assert.equal(t.subtotal, 100000);
  assert.equal(t.billDiscountAmount, 10000);
  // Taxable line net = 60000 − its share of 10000 (60%) = 54000 → VAT 9720
  assert.equal(t.lines[1].billDiscountShare, 6000);
  assert.equal(t.taxTotal, 9720);
  assert.equal(t.grandTotal, 100000 - 10000 + 9720);
  assert.equal(t.billDiscountBps, 1000);
});

test("cart: inclusive tax does not change the total", () => {
  const t = calculateCart([{ productId: "a", unitPrice: 11800, quantity: 1, discount: 0, taxable: true }], null, { rateBps: 1800, mode: "inclusive" });
  assert.equal(t.grandTotal, 11800);
  assert.equal(t.taxTotal, 1800);
  assert.equal(t.lines[0].revenue, 10000);
});

test("cart: discounts are clamped", () => {
  assert.equal(billDiscountAmount(5000, { type: "fixed", value: 9000 }), 5000);
  const t = calculateCart([{ productId: "a", unitPrice: 1000, quantity: 1, discount: 99999, taxable: false }], null, TAX);
  assert.equal(t.itemDiscountTotal, 1000);
  assert.equal(t.grandTotal, 0);
});

test("payments: cash change, split and validation", () => {
  assert.equal(cashChange(292660, 1000000), 707340);
  const cash = validatePayments(292660, [{ method: "cash", amount: 300000 }]);
  assert.ok(cash.ok);
  assert.equal(cash.change, 7340);
  assert.equal(cash.payments[0].amount, 292660);

  const split = validatePayments(10000, [{ method: "card", amount: 6000 }, { method: "cash", amount: 4000 }]);
  assert.ok(split.ok);
  assert.equal(split.change, 0);

  assert.equal(validatePayments(10000, [{ method: "cash", amount: 9000 }]).ok, false);
  assert.equal(validatePayments(10000, [{ method: "card", amount: 12000 }]).ok, false);
  assert.equal(loyaltyPoints(250000, 1), 25);
});

test("inventory: stock status, availability and valuation", () => {
  assert.equal(stockStatus(0, 5), "out_of_stock");
  assert.equal(stockStatus(5, 5), "low_stock");
  assert.equal(stockStatus(6, 5), "in_stock");
  assert.equal(hasStock(2.5, 2.5), true);
  assert.equal(hasStock(2.4, 2.5), false);
  assert.equal(hasStock(0, 1, true), true);
  assert.equal(inventoryValue([{ stock: 10, purchasePrice: 1500 }, { stock: 2.5, purchasePrice: 20000 }, { stock: -3, purchasePrice: 100 }]), 65000);
});

test("inventory: batches deducted first-expiry-first-out, skipping expired", () => {
  const now = new Date("2026-10-31T10:00:00");
  const batches = [
    { id: "late", productId: "p", batchNo: "B2", quantity: 10, receivedDate: "", expiryDate: "2026-11-20T00:00:00", costPrice: 1 },
    { id: "expired", productId: "p", batchNo: "B0", quantity: 3, receivedDate: "", expiryDate: "2026-10-29T00:00:00", costPrice: 1 },
    { id: "soon", productId: "p", batchNo: "B1", quantity: 4, receivedDate: "", expiryDate: "2026-11-02T00:00:00", costPrice: 1 },
  ];
  const r = deductFromBatches(batches, "p", 6, now);
  const q = Object.fromEntries(r.batches.map((b) => [b.id, b.quantity]));
  assert.deepEqual(q, { late: 8, expired: 3, soon: 0 });
  assert.equal(r.shortfall, 0);
  assert.equal(expiryStatus("2026-10-30T00:00:00", now), "expired");
  assert.equal(expiryStatus("2026-11-02T00:00:00", now), "critical");
  assert.equal(expiryStatus("2026-11-10T00:00:00", now), "soon");
});

test("forecasting: reorder threshold and suggestion", () => {
  assert.equal(reorderThreshold(2, 3, 10), 11);
  const r = forecastReorder({ stock: 4, minStock: 10, unitsSold: 28, windowDays: 14, leadTimeDays: 3 });
  assert.equal(r.dailyVelocity, 2);
  assert.equal(r.needsReorder, true);
  assert.equal(r.priority, "high"); // 2 days of cover < 3-day lead time
  assert.equal(r.suggestedQty, 2 * (3 + 14) + 10 - 4);
  const out = forecastReorder({ stock: 0, minStock: 5, unitsSold: 0, windowDays: 14, leadTimeDays: 2 });
  assert.equal(out.priority, "critical");
  assert.equal(forecastReorder({ stock: 100, minStock: 5, unitsSold: 7, windowDays: 14, leadTimeDays: 2 }).needsReorder, false);
});

test("register: expected cash and difference", () => {
  const exp = expectedCash(1000000, 450000, 20000, 0, 150000);
  assert.equal(exp, 1280000);
  assert.equal(cashDifference(1270000, exp), -10000);
});

test("returns: eligible quantity and proportional refunds", () => {
  const item = { quantity: 3, returnedQty: 0, lineTotal: 1000, refundedAmount: 0 };
  assert.equal(returnableQty(item), 3);
  assert.equal(validateReturnQty(item, 4).ok, false);
  assert.equal(validateReturnQty(item, 0).ok, false);
  const first = refundAmount(item, 1);
  assert.equal(first, 333);
  const after = { quantity: 3, returnedQty: 1, lineTotal: 1000, refundedAmount: first };
  assert.equal(refundAmount(after, 2), 667); // remainder reconciles exactly
  assert.equal(first + 667, 1000);
});
