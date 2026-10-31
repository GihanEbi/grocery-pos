import { addDays, addMinutes, format, setHours, setMinutes, startOfDay, subDays } from "date-fns";
import type {
  Batch,
  Customer,
  Expense,
  ExpenseCategory,
  MovementType,
  Payment,
  Product,
  ProductUnit,
  PurchaseOrder,
  ReturnReason,
  Sale,
  SaleItem,
  SaleReturn,
  Shift,
  StockMovement,
  Supplier,
  User,
} from "@/types";
import type { AppData } from "@/types/data";
import { DEFAULT_SETTINGS, SEED_VERSION } from "@/config/defaults";
import { calculateCart, loyaltyPoints } from "@/lib/calculations/cart";
import { roundQty } from "@/lib/calculations/money";
import { CITIES, CUSTOMER_FIRST, CUSTOMER_LAST, PRODUCT_ROWS, SEED_CATEGORIES, SEED_SUPPLIERS, SEED_USERS } from "./catalog";

/** Small deterministic PRNG so the demo dataset is identical on every reset (for a given demo date). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HISTORY_DAYS = 42;
const SKU_PREFIX: Record<string, string> = {
  cat_rice: "RIC", cat_pantry: "PAN", cat_veg: "VEG", cat_fruit: "FRU", cat_dairy: "DAI", cat_bev: "BEV",
  cat_bakery: "BAK", cat_snacks: "SNK", cat_meat: "MEA", cat_frozen: "FRZ", cat_house: "HOU", cat_care: "CAR",
};

function ean13(body12: string): string {
  const digits = body12.split("").map(Number);
  const s = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return body12 + ((10 - (s % 10)) % 10).toString();
}

export function generateSeedData(nowInput: Date = new Date()): AppData {
  const rng = mulberry32(20261031);
  const now = new Date(nowInput);
  const today = startOfDay(now);
  const iso = (d: Date) => d.toISOString();
  const at = (daysAgo: number, hour: number, minute = 0) => setMinutes(setHours(subDays(today, daysAgo), hour), minute);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const between = (min: number, max: number) => min + rng() * (max - min);
  const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
  const longAgo = iso(subDays(today, 180));

  // ---------- Reference data ----------
  const users: User[] = SEED_USERS.map((u) => ({ ...u, createdAt: longAgo }));
  const suppliers: Supplier[] = SEED_SUPPLIERS.map((s) => ({ ...s, createdAt: longAgo }));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  const catCounters: Record<string, number> = {};
  const popularity = new Map<string, number>();
  const products: Product[] = PRODUCT_ROWS.map((row, i) => {
    const [name, brand, categoryId, unit, cost, price, minStock, emoji, supplierId, taxable, trackExpiry, shelfLife, pop, level] = row;
    catCounters[categoryId] = (catCounters[categoryId] ?? 0) + 1;
    const id = `prd_${String(i + 1).padStart(3, "0")}`;
    const isKg = unit === "kg";
    let stock = 0;
    if (level === "h") stock = minStock * between(2.4, 5);
    if (level === "l") stock = Math.max(1, minStock * between(0.3, 0.85));
    stock = isKg ? Math.round(stock * 2) / 2 : Math.round(stock);
    popularity.set(id, pop);
    const barcode = isKg
      ? ean13(`20${String(1000 + i).padStart(5, "0")}00000`)
      : ean13(`479${String(10000000 + i * 7919).slice(-8)}${i % 10}`);
    return {
      id,
      name,
      sku: `${SKU_PREFIX[categoryId]}-${String(catCounters[categoryId]).padStart(3, "0")}`,
      barcode,
      categoryId,
      brand,
      description: `${brand} ${name.toLowerCase()} — sample product for the FreshMart demo catalog.`,
      purchasePrice: cost * 100,
      sellingPrice: price * 100,
      unit: unit as ProductUnit,
      stock,
      minStock,
      image: emoji,
      status: "active",
      supplierId,
      taxable,
      trackExpiry,
      shelfLifeDays: shelfLife,
      createdAt: longAgo,
      updatedAt: longAgo,
    };
  });
  // A couple of non-active products to exercise status filters.
  products.find((p) => p.name.startsWith("Pasta"))!.status = "inactive";
  products.find((p) => p.name.startsWith("Frozen Paratha"))!.status = "archived";
  const productById = new Map(products.map((p) => [p.id, p]));
  const finalStock = new Map(products.map((p) => [p.id, p.stock]));

  const customers: Customer[] = Array.from({ length: 40 }, (_, i) => {
    const first = CUSTOMER_FIRST[i % CUSTOMER_FIRST.length];
    const last = CUSTOMER_LAST[(i * 7 + Math.floor(i / CUSTOMER_FIRST.length)) % CUSTOMER_LAST.length];
    const phone = `+94 7${intBetween(0, 8)} ${intBetween(100, 999)} ${intBetween(1000, 9999)}`;
    return {
      id: `cus_${String(i + 1).padStart(3, "0")}`,
      name: `${first} ${last}`,
      phone,
      email: rng() < 0.65 ? `${first}.${last}${i}`.toLowerCase() + "@example.lk" : "",
      address: rng() < 0.5 ? `${intBetween(1, 220)}, ${pick(["Temple Rd", "Lake Rd", "Hill St", "Station Rd", "Mosque Lane"])}, ${pick(CITIES)}` : "",
      loyaltyPoints: 0,
      status: i === 37 ? "inactive" : "active",
      createdAt: iso(subDays(today, intBetween(50, 300))),
    };
  });

  // ---------- Shifts (one per day) ----------
  const cashierRotation = ["usr_cash1", "usr_cash2", "usr_cash3", "usr_cash1", "usr_cash2", "usr_mgr", "usr_cash3"];
  const shifts: Shift[] = [];
  const shiftByDay = new Map<number, Shift>();
  const lastSaleTimeToday = addMinutes(now, -10);
  const todayHasSales = now.getHours() * 60 + now.getMinutes() > 8 * 60 + 30;
  for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
    if (d === 0 && !todayHasSales) continue;
    const shift: Shift = {
      id: `shf_${String(HISTORY_DAYS - d).padStart(3, "0")}`,
      cashierId: d === 0 ? "usr_cash2" : cashierRotation[d % cashierRotation.length],
      register: DEFAULT_SETTINGS.pos.registerName,
      openedAt: iso(at(d, 7, 30)),
      closedAt: iso(d === 0 ? addMinutes(now, -5) : at(d, 20, 45)),
      openingCash: 1000000,
      countedCash: null,
      expectedCash: null,
      status: "closed",
      adjustments: [],
      notes: d === 0 ? "Morning shift — handed over." : "",
    };
    if (d % 9 === 3) shift.adjustments.push({ id: `adj_${d}`, type: "pay_out", amount: 150000, reason: "Paid delivery helper", date: iso(at(d, 14)) });
    shifts.push(shift);
    shiftByDay.set(d, shift);
  }

  // ---------- Sales ----------
  const sellable = products.filter((p) => p.status === "active" && (popularity.get(p.id) ?? 0) > 0);
  const weightTotal = sellable.reduce((a, p) => a + popularity.get(p.id)!, 0);
  const pickProduct = () => {
    let r = rng() * weightTotal;
    for (const p of sellable) {
      r -= popularity.get(p.id)!;
      if (r <= 0) return p;
    }
    return sellable[sellable.length - 1];
  };
  const qtyFor = (p: Product): number => {
    if (p.unit === "kg") {
      if (p.categoryId === "cat_rice") return pick([1, 1, 2, 2, 3, 5, 0.5, 1.5]);
      return pick([0.25, 0.5, 0.5, 0.75, 1, 1, 1.5, 2]);
    }
    if (p.name.startsWith("Eggs")) return pick([6, 10, 10, 12, 20]);
    if (p.name.includes("Yoghurt")) return pick([2, 4, 5, 6]);
    return 1 + Math.floor(rng() * rng() * 3.5);
  };
  /** Older sales used slightly lower historical prices — proves price snapshots. */
  const historicalPrice = (cents: number, daysAgo: number) =>
    daysAgo > 21 ? Math.round((cents * 0.96) / 500) * 500 : cents;

  const sales: Sale[] = [];
  let receiptSeq = 1000;
  const cashTender = (amount: number) => {
    const notes = [10000, 50000, 100000, 500000, 1000000];
    const exact = rng() < 0.25;
    if (exact) return amount;
    const note = notes.find((n) => n >= amount * 0.6) ?? 1000000;
    return Math.ceil(amount / note) * note;
  };

  for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
    const day = subDays(today, d);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    let count = Math.round(between(3, 6.5)) + (weekend ? 2 : 0) + (d < 14 ? 1 : 0);
    if (d === 0) count = 7;
    const times = Array.from({ length: count }, () => at(d, intBetween(8, 20), intBetween(0, 59)))
      .filter((t) => d !== 0 || t < lastSaleTimeToday)
      .sort((a, b) => a.getTime() - b.getTime());
    const shift = shiftByDay.get(d) ?? null;

    for (const time of times) {
      const nItems = 1 + Math.floor(Math.pow(rng(), 1.4) * 6);
      const chosen = new Map<string, Product>();
      for (let k = 0; k < nItems * 2 && chosen.size < nItems; k++) {
        const p = pickProduct();
        chosen.set(p.id, p);
      }
      const lines = [...chosen.values()].map((p) => ({
        product: p,
        quantity: qtyFor(p),
        unitPrice: historicalPrice(p.sellingPrice, d),
        unitCost: historicalPrice(p.purchasePrice, d),
      }));
      const billDiscount = rng() < 0.08 ? { type: "percent" as const, value: 500 } : null;
      const totals = calculateCart(
        lines.map((l) => ({ productId: l.product.id, unitPrice: l.unitPrice, quantity: l.quantity, discount: 0, taxable: l.product.taxable })),
        billDiscount,
        { rateBps: DEFAULT_SETTINGS.pos.taxRateBps, mode: DEFAULT_SETTINGS.pos.taxMode },
      );
      const items: SaleItem[] = lines.map((l, i) => {
        const t = totals.lines[i];
        return {
          productId: l.product.id,
          name: l.product.name,
          sku: l.product.sku,
          unit: l.product.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          unitCost: l.unitCost,
          itemDiscount: t.itemDiscount,
          billDiscountShare: t.billDiscountShare,
          taxRateBps: t.taxRateBps,
          taxAmount: t.tax,
          revenue: t.revenue,
          lineTotal: t.lineTotal,
          returnedQty: 0,
          refundedAmount: 0,
        };
      });
      const total = totals.grandTotal;
      const r = rng();
      let payments: Payment[];
      let change = 0;
      if (r < 0.55) {
        const tendered = cashTender(total);
        change = tendered - total;
        payments = [{ method: "cash", amount: total, tendered }];
      } else if (r < 0.8) payments = [{ method: "card", amount: total, reference: `AUTH${intBetween(100000, 999999)}` }];
      else if (r < 0.95) payments = [{ method: "qr", amount: total, reference: `LQR${intBetween(100000, 999999)}` }];
      else {
        const card = Math.round(total / 2 / 10000) * 10000;
        payments = [
          { method: "cash", amount: total - card, tendered: total - card },
          { method: "card", amount: card, reference: `AUTH${intBetween(100000, 999999)}` },
        ];
      }
      const customer = rng() < 0.45 ? null : customers[Math.floor(Math.pow(rng(), 1.6) * 37)];
      receiptSeq += 1;
      sales.push({
        id: `sal_${receiptSeq}`,
        receiptNo: `FM-${format(time, "yyMMdd")}-${String(receiptSeq).padStart(5, "0")}`,
        date: iso(time),
        customerId: customer?.id ?? null,
        cashierId: shift?.cashierId ?? "usr_cash1",
        shiftId: shift?.id ?? null,
        items,
        subtotal: totals.subtotal,
        itemDiscountTotal: totals.itemDiscountTotal,
        billDiscount: billDiscount ? { ...billDiscount, amount: totals.billDiscountAmount } : null,
        taxTotal: totals.taxTotal,
        total,
        payments,
        change,
        status: "completed",
        loyaltyEarned: customer ? loyaltyPoints(total, DEFAULT_SETTINGS.pos.loyaltyPointsPer100) : 0,
        offline: false,
        synced: true,
      });
    }
  }
  for (const c of customers) {
    c.loyaltyPoints = sales.filter((s) => s.customerId === c.id).reduce((a, s) => a + s.loyaltyEarned, 0);
  }

  // ---------- Returns ----------
  const returns: SaleReturn[] = [];
  const reasons: ReturnReason[] = ["damaged", "quality_issue", "customer_changed_mind", "wrong_item", "expired", "quality_issue", "customer_changed_mind"];
  const candidateSales = sales.filter((s) => {
    const age = (today.getTime() - startOfDay(new Date(s.date)).getTime()) / 86_400_000;
    return age >= 2 && age <= 30 && s.items.length >= 2;
  });
  for (let i = 0; i < 7 && candidateSales.length; i++) {
    const sale = candidateSales.splice(Math.floor(rng() * candidateSales.length), 1)[0];
    const item = sale.items[0];
    const qty = item.unit === "kg" ? roundQty(item.quantity / 2) : Math.max(1, Math.floor(item.quantity / 2));
    const full = qty >= item.quantity;
    const refund = full ? item.lineTotal : Math.round((item.lineTotal * Math.round(qty * 1000)) / Math.round(item.quantity * 1000));
    item.returnedQty = qty;
    item.refundedAmount = refund;
    sale.status = sale.items.every((it) => it.returnedQty >= it.quantity) ? "refunded" : "partially_refunded";
    const reason = reasons[i];
    const retDate = addDays(new Date(sale.date), 1);
    const daysAgo = Math.round((today.getTime() - startOfDay(retDate).getTime()) / 86_400_000);
    const restock = !["damaged", "expired", "quality_issue"].includes(reason);
    returns.push({
      id: `ret_${String(i + 1).padStart(3, "0")}`,
      returnNo: `RTN-${String(i + 1).padStart(4, "0")}`,
      saleId: sale.id,
      receiptNo: sale.receiptNo,
      date: iso(setHours(retDate, 11)),
      items: [{ productId: item.productId, name: item.name, quantity: qty, refundAmount: refund, restocked: restock }],
      reason,
      notes: "",
      refundAmount: refund,
      refundMethod: sale.payments[0].method,
      userId: "usr_mgr",
      shiftId: shiftByDay.get(daysAgo)?.id ?? null,
    });
  }

  // ---------- Purchase orders ----------
  const activeSuppliers = suppliers.filter((s) => s.id !== "sup_11");
  const purchaseOrders: PurchaseOrder[] = [];
  const receipts: { date: Date; productId: string; qty: number; ref: string }[] = [];
  const poPlan: { daysAgo: number; status: PurchaseOrder["status"] }[] = [];
  for (let k = 0; k < 26; k++) {
    const daysAgo = Math.round(40 - k * 1.55);
    let status: PurchaseOrder["status"] = "received";
    if (k === 6 || k === 15) status = "cancelled";
    if (daysAgo <= 6) status = "approved";
    if (k === 21) status = "partially_received";
    if (k === 23 || k === 25) status = "draft";
    poPlan.push({ daysAgo: Math.max(0, daysAgo), status });
  }
  poPlan.forEach((plan, k) => {
    const supplier = k < 4 && k % 2 === 0 ? supplierById.get("sup_11")! : activeSuppliers[k % activeSuppliers.length];
    const supplierProducts = products.filter((p) => p.supplierId === supplier.id && p.status !== "archived");
    const n = Math.min(supplierProducts.length, intBetween(3, 6));
    const chosen = [...supplierProducts].sort(() => rng() - 0.5).slice(0, n);
    const created = at(plan.daysAgo, intBetween(9, 16), intBetween(0, 59));
    const poNumber = `PO-${format(created, "yyyy")}-${String(k + 1).padStart(4, "0")}`;
    const items = chosen.map((p) => {
      const qty = p.unit === "kg" ? Math.round(p.minStock * between(2, 4)) : Math.ceil((p.minStock * between(2, 4)) / 6) * 6;
      let receivedQty = 0;
      if (plan.status === "received") receivedQty = qty;
      if (plan.status === "partially_received") receivedQty = Math.floor(qty / 2);
      return { productId: p.id, quantity: qty, unitCost: p.purchasePrice, receivedQty };
    });
    const receivedAt =
      plan.status === "received" || plan.status === "partially_received"
        ? addDays(created, Math.min(supplier.leadTimeDays, plan.daysAgo))
        : null;
    if (receivedAt) items.forEach((it) => it.receivedQty > 0 && receipts.push({ date: receivedAt, productId: it.productId, qty: it.receivedQty, ref: poNumber }));
    purchaseOrders.push({
      id: `po_${String(k + 1).padStart(3, "0")}`,
      poNumber,
      supplierId: supplier.id,
      status: plan.status,
      items,
      notes: plan.status === "cancelled" ? "Cancelled — supplier could not fulfil on time." : "",
      expectedDate: iso(addDays(created, supplier.leadTimeDays)),
      createdAt: iso(created),
      createdBy: k % 3 === 0 ? "usr_admin" : "usr_mgr",
      approvedAt: plan.status === "draft" || plan.status === "cancelled" ? null : iso(addMinutes(created, 90)),
      approvedBy: plan.status === "draft" || plan.status === "cancelled" ? null : "usr_admin",
      receivedAt: receivedAt ? iso(receivedAt) : null,
      source: "manual",
    });
  });

  // ---------- Manual adjustments ----------
  const adjustments: { date: Date; productId: string; qty: number; type: MovementType; reason: string; ref: string }[] = [];
  const adjProducts = ["prd_067", "prd_029", "prd_042", "prd_050", "prd_053", "prd_066", "prd_033", "prd_091"];
  adjProducts.forEach((pid, i) => {
    const p = productById.get(pid);
    if (!p) return;
    const type: MovementType = i % 3 === 0 ? "expired" : i % 3 === 1 ? "damage" : "adjustment";
    const qty = p.unit === "kg" ? -roundQty(between(0.5, 2)) : -intBetween(1, 3);
    adjustments.push({
      date: at(intBetween(2, 35), intBetween(9, 18)),
      productId: pid,
      qty,
      type,
      reason: type === "expired" ? "Expired stock write-off" : type === "damage" ? "Damaged in storage" : "Stock count correction",
      ref: `ADJ-${String(i + 1).padStart(4, "0")}`,
    });
  });

  // ---------- Stock movement ledger (balanced to final stock) ----------
  const movements: StockMovement[] = [];
  let mvSeq = 0;
  const openingDate = at(HISTORY_DAYS + 3, 7);
  for (const p of products) {
    type Ev = { date: Date; qty: number; type: MovementType; ref: string; user: string; reason: string };
    const events: Ev[] = [];
    for (const s of sales)
      for (const it of s.items)
        if (it.productId === p.id) events.push({ date: new Date(s.date), qty: -it.quantity, type: "sale", ref: s.receiptNo, user: s.cashierId, reason: "POS sale" });
    for (const r of returns)
      for (const it of r.items)
        if (it.productId === p.id && it.restocked) events.push({ date: new Date(r.date), qty: it.quantity, type: "return", ref: r.returnNo, user: r.userId, reason: "Customer return — restocked" });
    for (const rc of receipts)
      if (rc.productId === p.id) events.push({ date: setHours(rc.date, 10), qty: rc.qty, type: "purchase", ref: rc.ref, user: "usr_mgr", reason: "Purchase order received" });
    for (const a of adjustments)
      if (a.productId === p.id) events.push({ date: a.date, qty: a.qty, type: a.type, ref: a.ref, user: "usr_mgr", reason: a.reason });
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    const net = roundQty(events.reduce((a, e) => a + e.qty, 0));
    let running = 0;
    let minPrefix = 0;
    for (const e of events) {
      running = roundQty(running + e.qty);
      minPrefix = Math.min(minPrefix, running);
    }
    const target = finalStock.get(p.id)!;
    let opening = roundQty(target - net);
    if (opening + minPrefix < 0) {
      opening = roundQty(-minPrefix + p.minStock);
      events.push({ date: at(1, 21), qty: roundQty(target - (opening + net)), type: "adjustment", ref: "COUNT-2610", user: "usr_mgr", reason: "Monthly stock count correction" });
    }
    let balance = opening;
    movements.push({ id: `mov_${++mvSeq}`, productId: p.id, type: "opening", quantity: opening, balanceAfter: opening, reference: "OPENING", userId: "usr_admin", reason: "Opening stock balance", date: iso(openingDate) });
    for (const e of events) {
      balance = roundQty(balance + e.qty);
      movements.push({ id: `mov_${++mvSeq}`, productId: p.id, type: e.type, quantity: e.qty, balanceAfter: balance, reference: e.ref, userId: e.user, reason: e.reason, date: iso(e.date) });
    }
  }
  movements.sort((a, b) => b.date.localeCompare(a.date));

  // ---------- Batches & expiry ----------
  const batches: Batch[] = [];
  const expiryOverrides: [string, number, number?][] = [
    // [name prefix, days until expiry (negative = expired), quantity share 0..1]
    ["Fresh Milk", 2, 0.6],
    ["Set Yoghurt", -2, 0.15],
    ["Sandwich Bread", 1, 0.5],
    ["Chicken (Whole)", 3, 0.5],
    ["Curd", 5, 0.5],
    ["Cheddar", -4, 0.3],
    ["Orange Juice", 6, 0.5],
    ["Carrots", 4, 0.6],
    ["Tomatoes", -1, 0.2],
    ["Sausages", 9, 0.5],
    ["Flavoured Milk", 12, 0.4],
    ["Chocolate Bar", 10, 0.5],
    ["Fish Bun", 0, 0.5],
    ["Salted Butter", 13, 1],
  ];
  let batchSeq = 0;
  const makeBatch = (p: Product, qty: number, expiresInDays: number): Batch => {
    const expiry = addDays(today, expiresInDays);
    const received = subDays(expiry, Math.max(1, p.shelfLifeDays));
    batchSeq += 1;
    return {
      id: `bat_${String(batchSeq).padStart(4, "0")}`,
      productId: p.id,
      batchNo: `B${format(received, "yyMMdd")}-${String(batchSeq).padStart(3, "0")}`,
      quantity: qty,
      receivedDate: iso(received),
      expiryDate: iso(expiry),
      costPrice: p.purchasePrice,
    };
  };
  for (const p of products) {
    if (!p.trackExpiry || p.stock <= 0) continue;
    const override = expiryOverrides.find(([prefix]) => p.name.startsWith(prefix));
    const round = (q: number) => (p.unit === "kg" ? roundQty(Math.round(q * 2) / 2) : Math.round(q));
    if (override) {
      const [, days, share = 0.5] = override;
      const first = Math.max(p.unit === "kg" ? 0.5 : 1, Math.min(p.stock, round(p.stock * share)));
      batches.push(makeBatch(p, first, days));
      const rest = roundQty(p.stock - first);
      if (rest > 0) batches.push(makeBatch(p, rest, Math.max(days + 3, Math.round(p.shelfLifeDays * 0.9))));
    } else {
      const firstShare = between(0.3, 0.7);
      const first = Math.max(p.unit === "kg" ? 0.5 : 1, Math.min(p.stock, round(p.stock * firstShare)));
      batches.push(makeBatch(p, first, Math.max(2, Math.round(p.shelfLifeDays * between(0.35, 0.7)))));
      const rest = roundQty(p.stock - first);
      if (rest > 0) batches.push(makeBatch(p, rest, Math.max(3, Math.round(p.shelfLifeDays * between(0.75, 1)))));
    }
  }

  // ---------- Expenses ----------
  const expenses: Expense[] = [];
  const addExpense = (category: ExpenseCategory, description: string, rupees: number, daysAgo: number, method: Expense["paymentMethod"]) => {
    const date = at(daysAgo, 10);
    expenses.push({
      id: `exp_${String(expenses.length + 1).padStart(3, "0")}`,
      category,
      description,
      amount: rupees * 100,
      date: iso(date),
      paymentMethod: method,
      createdBy: "usr_admin",
      createdAt: iso(date),
    });
  };
  const thisMonthDay = today.getDate() - 1; // days since the 1st
  const lastMonthStart = thisMonthDay + 30;
  for (const base of [lastMonthStart, thisMonthDay]) {
    const monthName = format(subDays(today, base), "MMMM");
    addExpense("rent", `Shop rent — ${monthName}`, 85000, base, "bank");
    addExpense("electricity", `CEB electricity bill — ${monthName}`, intBetween(21000, 27000), Math.max(0, base - 9), "bank");
    addExpense("water", `NWSDB water bill — ${monthName}`, intBetween(2100, 3200), Math.max(0, base - 11), "bank");
    addExpense("salaries", `Staff salaries — ${monthName}`, 245000, Math.max(0, base - 24), "bank");
  }
  const misc: [ExpenseCategory, string, number][] = [
    ["transportation", "Three-wheeler hire — Dambulla produce pickup", 4500],
    ["transportation", "Lorry hire — rice stock delivery", 9500],
    ["transportation", "Fuel for delivery bike", 6200],
    ["maintenance", "Chiller compressor service", 18500],
    ["maintenance", "Shelf repairs", 7400],
    ["other", "Plastic carrier bags (bulk)", 12800],
    ["other", "Receipt printer paper rolls", 5600],
    ["transportation", "Courier — supplier documents", 1200],
    ["maintenance", "Generator servicing", 14200],
    ["other", "Cleaning supplies", 3900],
    ["transportation", "Fuel for delivery bike", 5900],
    ["other", "Business registration renewal", 15000],
    ["maintenance", "CCTV camera repair", 8800],
    ["other", "Staff tea & refreshments", 4600],
    ["transportation", "Three-wheeler hire — bakery delivery", 3200],
    ["other", "Bank charges", 1850],
    ["maintenance", "POS scanner replacement", 11500],
  ];
  misc.forEach(([cat, desc, amt], i) => addExpense(cat, desc, amt, Math.max(0, Math.round(i * 2.4) + 1), i % 2 ? "cash" : "card"));
  expenses.sort((a, b) => b.date.localeCompare(a.date));

  // ---------- Shift reconciliation for historical shifts ----------
  for (const shift of shifts) {
    const own = sales.filter((s) => s.shiftId === shift.id);
    const cashSales = own.reduce((a, s) => a + s.payments.filter((p) => p.method === "cash").reduce((b, p) => b + p.amount, 0), 0);
    const cashRefunds = returns.filter((r) => r.shiftId === shift.id && r.refundMethod === "cash").reduce((a, r) => a + r.refundAmount, 0);
    const outs = shift.adjustments.reduce((a, x) => a + (x.type === "pay_out" ? -x.amount : x.amount), 0);
    const expected = shift.openingCash + cashSales - cashRefunds + outs;
    const diff = pick([0, 0, 0, 0, -5000, 10000, -10000, 0, -2000]);
    shift.expectedCash = expected;
    shift.countedCash = expected + diff;
  }

  // ---------- Sample notifications ----------
  const lastReceivedPo = [...purchaseOrders].reverse().find((p) => p.status === "received");
  const notifications = [
    {
      id: "ntf_seed_1",
      type: "purchase" as const,
      title: "Purchase order received",
      message: lastReceivedPo ? `${lastReceivedPo.poNumber} from ${supplierById.get(lastReceivedPo.supplierId)!.name} was received into stock.` : "A purchase order was received.",
      href: "/purchasing",
      read: true,
      createdAt: lastReceivedPo?.receivedAt ?? iso(subDays(now, 2)),
    },
    {
      id: "ntf_seed_2",
      type: "ai_insight" as const,
      title: "AI insight: rice demand is up",
      message: "Rice & grains sold faster this week than last week. Review reorder suggestions.",
      href: "/ai-assistant?q=What%20should%20I%20reorder%3F",
      read: false,
      createdAt: iso(addMinutes(now, -95)),
    },
    {
      id: "ntf_seed_3",
      type: "success" as const,
      title: "Return processed",
      message: `${returns[returns.length - 1]?.returnNo ?? "A return"} was refunded and recorded.`,
      href: "/sales?tab=returns",
      read: true,
      createdAt: returns[returns.length - 1]?.date ?? iso(subDays(now, 3)),
    },
  ];

  return {
    users,
    categories: SEED_CATEGORIES,
    products,
    batches,
    movements,
    suppliers,
    purchaseOrders: purchaseOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    customers,
    sales: sales.sort((a, b) => b.date.localeCompare(a.date)),
    returns: returns.sort((a, b) => b.date.localeCompare(a.date)),
    expenses,
    shifts: shifts.sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    notifications,
    heldBills: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    meta: {
      seedVersion: SEED_VERSION,
      demoDate: iso(now),
      simulatedOffline: false,
      lastSyncAt: iso(now),
      counters: { receipt: receiptSeq, po: purchaseOrders.length, ret: returns.length },
    },
  };
}
