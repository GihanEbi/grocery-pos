"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { format } from "date-fns";
import type {
  AppNotification,
  Batch,
  CartItem,
  CashAdjustment,
  Customer,
  DiscountType,
  Expense,
  HeldBill,
  MovementType,
  PaymentMethod,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Result,
  ReturnReason,
  Sale,
  SaleItem,
  SaleReturn,
  Settings,
  Shift,
  StockMovement,
  Supplier,
  User,
} from "@/types";
import type { AppData } from "@/types/data";
import { SEED_VERSION, STORAGE_KEY } from "@/config/defaults";
import { generateSeedData } from "@/mocks/seed/generate";
import { calculateCart, loyaltyPoints, validatePayments, type PaymentDraft } from "@/lib/calculations/cart";
import { roundQty } from "@/lib/calculations/money";
import { deductFromBatches, daysUntil, hasStock } from "@/lib/calculations/inventory";
import { refundAmount, validateReturnQty } from "@/lib/calculations/returns";
import { uid } from "@/lib/utils";

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });
const nowIso = () => new Date().toISOString();

export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;
export type SupplierInput = Omit<Supplier, "id" | "createdAt">;
export type CustomerInput = Omit<Customer, "id" | "createdAt" | "loyaltyPoints"> & { loyaltyPoints?: number };
export type ExpenseInput = Omit<Expense, "id" | "createdAt">;
export type UserInput = Omit<User, "id" | "createdAt">;

export interface CompleteSaleInput {
  items: CartItem[];
  customerId: string | null;
  billDiscount: { type: DiscountType; value: number } | null;
  payments: PaymentDraft[];
  cashierId: string;
  shiftId: string | null;
}

export interface ReturnInput {
  saleId: string;
  items: { productId: string; quantity: number }[];
  reason: ReturnReason;
  notes: string;
  refundMethod: PaymentMethod;
  restock: boolean;
  userId: string;
  shiftId: string | null;
}

export interface ReceiveLine {
  productId: string;
  quantity: number;
  expiryDate?: string | null;
}

interface AppActions {
  /** True once persisted state was loaded (or seeded) on the client. */
  hydrated: boolean;
  _setHydrated: () => void;
  resetDemoData: () => void;
  ensureSeeded: () => void;

  addProduct: (input: ProductInput, userId: string) => Result<Product>;
  updateProduct: (id: string, input: Partial<ProductInput>) => Result<Product>;
  archiveProduct: (id: string) => Result;
  restoreProduct: (id: string) => Result;

  adjustStock: (input: { productId: string; quantity: number; type: MovementType; reason: string; notes: string; userId: string; expiryDate?: string | null }) => Result<StockMovement>;
  writeOffBatch: (batchId: string, userId: string) => Result;

  addSupplier: (input: SupplierInput) => Result<Supplier>;
  updateSupplier: (id: string, input: Partial<SupplierInput>) => Result<Supplier>;

  createPurchaseOrder: (input: { supplierId: string; items: Omit<PurchaseOrderItem, "receivedQty">[]; notes: string; expectedDate: string | null; source: "manual" | "ai"; userId: string; approve?: boolean }) => Result<PurchaseOrder>;
  updatePurchaseOrder: (id: string, input: { supplierId: string; items: Omit<PurchaseOrderItem, "receivedQty">[]; notes: string; expectedDate: string | null }) => Result<PurchaseOrder>;
  approvePurchaseOrder: (id: string, userId: string) => Result;
  cancelPurchaseOrder: (id: string) => Result;
  receivePurchaseOrder: (id: string, lines: ReceiveLine[], userId: string) => Result<PurchaseOrder>;

  addCustomer: (input: CustomerInput) => Result<Customer>;
  updateCustomer: (id: string, input: Partial<CustomerInput>) => Result<Customer>;

  completeSale: (input: CompleteSaleInput) => Result<Sale>;
  processReturn: (input: ReturnInput) => Result<SaleReturn>;

  addExpense: (input: ExpenseInput) => Result<Expense>;
  updateExpense: (id: string, input: Partial<ExpenseInput>) => Result<Expense>;
  deleteExpense: (id: string) => Result;

  openShift: (input: { cashierId: string; openingCash: number; notes: string }) => Result<Shift>;
  closeShift: (id: string, countedCash: number, notes: string, expectedCash: number) => Result<Shift>;
  addCashAdjustment: (shiftId: string, input: Omit<CashAdjustment, "id" | "date">) => Result;

  holdBill: (bill: Omit<HeldBill, "id" | "createdAt">) => Result<HeldBill>;
  removeHeldBill: (id: string) => void;

  addNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  scanConditions: () => void;

  updateSettings: (patch: { shop?: Partial<Settings["shop"]>; pos?: Partial<Settings["pos"]> }) => void;
  addUser: (input: UserInput) => Result<User>;
  updateUser: (id: string, input: Partial<UserInput>) => Result<User>;

  setSimulatedOffline: (offline: boolean) => void;
  syncPendingSales: () => Result<number>;
}

export type AppState = AppData & AppActions;

const EMPTY: AppData = {
  users: [],
  categories: [],
  products: [],
  batches: [],
  movements: [],
  suppliers: [],
  purchaseOrders: [],
  customers: [],
  sales: [],
  returns: [],
  expenses: [],
  shifts: [],
  notifications: [],
  heldBills: [],
  settings: undefined as unknown as Settings,
  meta: undefined as unknown as AppData["meta"],
};

function dataOnly(state: AppState): AppData {
  const { users, categories, products, batches, movements, suppliers, purchaseOrders, customers, sales, returns, expenses, shifts, notifications, heldBills, settings, meta } = state;
  return { users, categories, products, batches, movements, suppliers, purchaseOrders, customers, sales, returns, expenses, shifts, notifications, heldBills, settings, meta };
}

function makeNotification(n: Omit<AppNotification, "id" | "createdAt" | "read">): AppNotification {
  return { ...n, id: uid("ntf"), createdAt: nowIso(), read: false };
}

/** Add notifications, skipping any whose dedupe key already exists. */
function withNotifications(existing: AppNotification[], incoming: AppNotification[]): AppNotification[] {
  const keys = new Set(existing.map((n) => n.key).filter(Boolean));
  const fresh = incoming.filter((n) => !n.key || !keys.has(n.key));
  return [...fresh, ...existing].slice(0, 100);
}

/** Apply a stock delta to a product and record a movement. Handles batches. */
function applyStockChange(
  s: AppData,
  args: { productId: string; delta: number; type: MovementType; reference: string; reason: string; userId: string; date?: string; expiryDate?: string | null; costPrice?: number },
): { products: Product[]; batches: Batch[]; movement: StockMovement; product: Product } {
  const product = s.products.find((p) => p.id === args.productId)!;
  const date = args.date ?? nowIso();
  const newStock = roundQty(product.stock + args.delta);
  let batches = s.batches;
  if (product.trackExpiry) {
    if (args.delta < 0) {
      batches = deductFromBatches(batches, product.id, -args.delta, new Date(), { expiredFirst: args.type === "expired" || args.type === "damage" }).batches;
    } else if (args.delta > 0) {
      const expiry = args.expiryDate ?? new Date(Date.now() + product.shelfLifeDays * 86_400_000).toISOString();
      const existing = batches.find((b) => b.productId === product.id && b.expiryDate.slice(0, 10) === expiry.slice(0, 10));
      if (existing) batches = batches.map((b) => (b.id === existing.id ? { ...b, quantity: roundQty(b.quantity + args.delta) } : b));
      else
        batches = [
          ...batches,
          {
            id: uid("bat"),
            productId: product.id,
            batchNo: `B${format(new Date(), "yyMMdd")}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
            quantity: args.delta,
            receivedDate: date,
            expiryDate: expiry,
            costPrice: args.costPrice ?? product.purchasePrice,
          },
        ];
    }
    batches = batches.filter((b) => b.quantity > 0);
  }
  const updated: Product = { ...product, stock: newStock, updatedAt: date };
  const movement: StockMovement = {
    id: uid("mov"),
    productId: product.id,
    type: args.type,
    quantity: args.delta,
    balanceAfter: newStock,
    reference: args.reference,
    userId: args.userId,
    reason: args.reason,
    date,
  };
  return { products: s.products.map((p) => (p.id === product.id ? updated : p)), batches, movement, product: updated };
}

function lowStockNotification(before: Product, after: Product): AppNotification | null {
  if (after.status !== "active") return null;
  const day = format(new Date(), "yyyy-MM-dd");
  if (before.stock > 0 && after.stock <= 0)
    return makeNotification({ type: "low_stock", title: `${after.name} is out of stock`, message: `Stock reached zero. Reorder from the supplier to avoid lost sales.`, href: `/inventory?status=out_of_stock&q=${encodeURIComponent(after.sku)}`, key: `out:${after.id}:${day}` });
  if (before.stock > after.minStock && after.stock <= after.minStock)
    return makeNotification({ type: "low_stock", title: `Low stock: ${after.name}`, message: `Only ${after.stock} ${after.unit} left (minimum ${after.minStock}).`, href: `/inventory?status=low_stock&q=${encodeURIComponent(after.sku)}`, key: `low:${after.id}:${day}` });
  return null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      hydrated: false,
      _setHydrated: () => set({ hydrated: true }),

      ensureSeeded: () => {
        const s = get();
        if (!s.meta || s.meta.seedVersion !== SEED_VERSION || s.products.length === 0) {
          set({ ...generateSeedData(new Date()) });
          get().scanConditions();
        }
      },

      resetDemoData: () => {
        set({ ...generateSeedData(new Date()) });
        get().scanConditions();
      },

      // ---------------- Products ----------------
      addProduct: (input, userId) => {
        const s = get();
        if (s.products.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase())) return fail("A product with this SKU already exists.");
        if (input.barcode && s.products.some((p) => p.barcode === input.barcode)) return fail("A product with this barcode already exists.");
        const ts = nowIso();
        const product: Product = { ...input, id: uid("prd"), createdAt: ts, updatedAt: ts };
        let products = [product, ...s.products];
        let batches = s.batches;
        const movements = [...s.movements];
        if (product.stock > 0) {
          const opening: StockMovement = { id: uid("mov"), productId: product.id, type: "opening", quantity: product.stock, balanceAfter: product.stock, reference: "NEW-PRODUCT", userId, reason: "Opening stock for new product", date: ts };
          movements.unshift(opening);
          if (product.trackExpiry)
            batches = [...batches, { id: uid("bat"), productId: product.id, batchNo: `B${format(new Date(), "yyMMdd")}-NEW`, quantity: product.stock, receivedDate: ts, expiryDate: new Date(Date.now() + product.shelfLifeDays * 86_400_000).toISOString(), costPrice: product.purchasePrice }];
        }
        products = products.map((p) => p);
        set({ products, batches, movements });
        return ok(product);
      },

      updateProduct: (id, input) => {
        const s = get();
        const current = s.products.find((p) => p.id === id);
        if (!current) return fail("Product not found.");
        if (input.sku && s.products.some((p) => p.id !== id && p.sku.toLowerCase() === input.sku!.toLowerCase())) return fail("Another product already uses this SKU.");
        if (input.barcode && s.products.some((p) => p.id !== id && p.barcode === input.barcode)) return fail("Another product already uses this barcode.");
        // Stock is never edited directly here — use stock adjustments so the ledger stays correct.
        const { stock: _ignored, ...rest } = input;
        const updated: Product = { ...current, ...rest, updatedAt: nowIso() };
        set({ products: s.products.map((p) => (p.id === id ? updated : p)) });
        return ok(updated);
      },

      archiveProduct: (id) => {
        const s = get();
        if (!s.products.some((p) => p.id === id)) return fail("Product not found.");
        set({ products: s.products.map((p) => (p.id === id ? { ...p, status: "archived", updatedAt: nowIso() } : p)) });
        return ok(undefined);
      },

      restoreProduct: (id) => {
        const s = get();
        set({ products: s.products.map((p) => (p.id === id ? { ...p, status: "active", updatedAt: nowIso() } : p)) });
        return ok(undefined);
      },

      // ---------------- Inventory ----------------
      adjustStock: ({ productId, quantity, type, reason, notes, userId, expiryDate }) => {
        const s = get();
        const product = s.products.find((p) => p.id === productId);
        if (!product) return fail("Product not found.");
        if (!Number.isFinite(quantity) || quantity === 0) return fail("Adjustment quantity cannot be zero.");
        if (product.unit !== "kg" && !Number.isInteger(quantity)) return fail("This product is counted in whole units.");
        if (roundQty(product.stock + quantity) < 0) return fail(`Cannot remove more than the ${product.stock} ${product.unit} in stock.`);
        const ref = `ADJ-${format(new Date(), "yyMMdd-HHmmss")}`;
        const res = applyStockChange(s, { productId, delta: quantity, type, reference: ref, reason: notes ? `${reason} — ${notes}` : reason, userId, expiryDate });
        const n = lowStockNotification(product, res.product);
        set({
          products: res.products,
          batches: res.batches,
          movements: [res.movement, ...s.movements],
          notifications: withNotifications(s.notifications, [
            ...(n ? [n] : []),
            makeNotification({ type: "success", title: "Stock adjusted", message: `${product.name}: ${quantity > 0 ? "+" : ""}${quantity} ${product.unit} (${reason}).`, href: "/inventory/movements" }),
          ]),
        });
        return ok(res.movement);
      },

      writeOffBatch: (batchId, userId) => {
        const s = get();
        const batch = s.batches.find((b) => b.id === batchId);
        if (!batch) return fail("Batch not found.");
        const product = s.products.find((p) => p.id === batch.productId)!;
        const qty = Math.min(batch.quantity, product.stock);
        // Remove exactly this batch, then record the movement.
        const batches = s.batches.filter((b) => b.id !== batchId);
        const newStock = roundQty(product.stock - qty);
        const movement: StockMovement = { id: uid("mov"), productId: product.id, type: "expired", quantity: -qty, balanceAfter: newStock, reference: batch.batchNo, userId, reason: "Expired batch written off", date: nowIso() };
        const updated = { ...product, stock: newStock, updatedAt: nowIso() };
        const n = lowStockNotification(product, updated);
        set({
          batches,
          products: s.products.map((p) => (p.id === product.id ? updated : p)),
          movements: [movement, ...s.movements],
          notifications: withNotifications(s.notifications, n ? [n] : []),
        });
        return ok(undefined);
      },

      // ---------------- Suppliers ----------------
      addSupplier: (input) => {
        const s = get();
        if (s.suppliers.some((x) => x.name.trim().toLowerCase() === input.name.trim().toLowerCase())) return fail("A supplier with this name already exists.");
        const supplier: Supplier = { ...input, id: uid("sup"), createdAt: nowIso() };
        set({ suppliers: [supplier, ...s.suppliers] });
        return ok(supplier);
      },
      updateSupplier: (id, input) => {
        const s = get();
        const current = s.suppliers.find((x) => x.id === id);
        if (!current) return fail("Supplier not found.");
        const updated = { ...current, ...input };
        set({ suppliers: s.suppliers.map((x) => (x.id === id ? updated : x)) });
        return ok(updated);
      },

      // ---------------- Purchasing ----------------
      createPurchaseOrder: ({ supplierId, items, notes, expectedDate, source, userId, approve }) => {
        const s = get();
        if (!s.suppliers.some((x) => x.id === supplierId)) return fail("Select a valid supplier.");
        const clean = items.filter((i) => i.quantity > 0);
        if (clean.length === 0) return fail("Add at least one item with a quantity greater than zero.");
        const seq = s.meta.counters.po + 1;
        const ts = nowIso();
        const po: PurchaseOrder = {
          id: uid("po"),
          poNumber: `PO-${format(new Date(), "yyyy")}-${String(seq).padStart(4, "0")}`,
          supplierId,
          status: approve ? "approved" : "draft",
          items: clean.map((i) => ({ ...i, receivedQty: 0 })),
          notes,
          expectedDate,
          createdAt: ts,
          createdBy: userId,
          approvedAt: approve ? ts : null,
          approvedBy: approve ? userId : null,
          receivedAt: null,
          source,
        };
        set({
          purchaseOrders: [po, ...s.purchaseOrders],
          meta: { ...s.meta, counters: { ...s.meta.counters, po: seq } },
          notifications: withNotifications(s.notifications, [
            makeNotification({ type: "purchase", title: `${po.poNumber} ${approve ? "created & approved" : "saved as draft"}`, message: `${clean.length} item(s) for ${s.suppliers.find((x) => x.id === supplierId)!.name}.`, href: `/purchasing?po=${po.id}` }),
          ]),
        });
        return ok(po);
      },

      updatePurchaseOrder: (id, input) => {
        const s = get();
        const po = s.purchaseOrders.find((p) => p.id === id);
        if (!po) return fail("Purchase order not found.");
        if (po.status !== "draft") return fail("Only draft purchase orders can be edited.");
        const clean = input.items.filter((i) => i.quantity > 0);
        if (clean.length === 0) return fail("Add at least one item.");
        const updated: PurchaseOrder = { ...po, ...input, items: clean.map((i) => ({ ...i, receivedQty: 0 })) };
        set({ purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? updated : p)) });
        return ok(updated);
      },

      approvePurchaseOrder: (id, userId) => {
        const s = get();
        const po = s.purchaseOrders.find((p) => p.id === id);
        if (!po) return fail("Purchase order not found.");
        if (po.status !== "draft") return fail("Only draft orders can be approved.");
        set({
          purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? { ...p, status: "approved", approvedAt: nowIso(), approvedBy: userId } : p)),
          notifications: withNotifications(s.notifications, [makeNotification({ type: "purchase", title: `${po.poNumber} approved`, message: "The order is ready to be received when the supplier delivers.", href: `/purchasing?po=${po.id}` })]),
        });
        return ok(undefined);
      },

      cancelPurchaseOrder: (id) => {
        const s = get();
        const po = s.purchaseOrders.find((p) => p.id === id);
        if (!po) return fail("Purchase order not found.");
        if (po.status === "received" || po.status === "partially_received") return fail("Orders with received stock cannot be cancelled.");
        if (po.status === "cancelled") return fail("This order is already cancelled.");
        set({ purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? { ...p, status: "cancelled" } : p)) });
        return ok(undefined);
      },

      receivePurchaseOrder: (id, lines, userId) => {
        let s: AppData = dataOnly(get());
        const po = s.purchaseOrders.find((p) => p.id === id);
        if (!po) return fail("Purchase order not found.");
        if (po.status !== "approved" && po.status !== "partially_received") return fail("Only approved orders can be received.");
        const valid = lines.filter((l) => l.quantity > 0);
        if (valid.length === 0) return fail("Enter a received quantity for at least one item.");
        for (const l of valid) {
          const item = po.items.find((i) => i.productId === l.productId);
          if (!item) return fail("Received item is not on this order.");
          if (roundQty(item.receivedQty + l.quantity) > item.quantity) return fail("Received quantity cannot exceed the ordered quantity.");
        }
        const newMovements: StockMovement[] = [];
        const notes: AppNotification[] = [];
        for (const l of valid) {
          const item = po.items.find((i) => i.productId === l.productId)!;
          const res = applyStockChange(s, { productId: l.productId, delta: l.quantity, type: "purchase", reference: po.poNumber, reason: "Purchase order received", userId, expiryDate: l.expiryDate ?? null, costPrice: item.unitCost });
          s = { ...s, products: res.products, batches: res.batches };
          newMovements.push(res.movement);
        }
        const items = po.items.map((i) => {
          const l = valid.find((v) => v.productId === i.productId);
          return l ? { ...i, receivedQty: roundQty(i.receivedQty + l.quantity) } : i;
        });
        const complete = items.every((i) => i.receivedQty >= i.quantity);
        const updated: PurchaseOrder = { ...po, items, status: complete ? "received" : "partially_received", receivedAt: nowIso() };
        notes.push(makeNotification({ type: "purchase", title: `${po.poNumber} ${complete ? "received" : "partially received"}`, message: `${valid.length} item(s) added to inventory.`, href: `/purchasing?po=${po.id}` }));
        set({
          products: s.products,
          batches: s.batches,
          movements: [...newMovements, ...s.movements],
          purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? updated : p)),
          notifications: withNotifications(s.notifications, notes),
        });
        return ok(updated);
      },

      // ---------------- Customers ----------------
      addCustomer: (input) => {
        const s = get();
        const phone = input.phone.replace(/\s/g, "");
        if (phone && s.customers.some((c) => c.phone.replace(/\s/g, "") === phone)) return fail("A customer with this phone number already exists.");
        const customer: Customer = { loyaltyPoints: 0, ...input, id: uid("cus"), createdAt: nowIso() };
        set({ customers: [customer, ...s.customers] });
        return ok(customer);
      },
      updateCustomer: (id, input) => {
        const s = get();
        const current = s.customers.find((c) => c.id === id);
        if (!current) return fail("Customer not found.");
        const phone = input.phone?.replace(/\s/g, "");
        if (phone && s.customers.some((c) => c.id !== id && c.phone.replace(/\s/g, "") === phone)) return fail("Another customer already uses this phone number.");
        const updated = { ...current, ...input };
        set({ customers: s.customers.map((c) => (c.id === id ? updated : c)) });
        return ok(updated);
      },

      // ---------------- Sales ----------------
      completeSale: (input) => {
        let s: AppData = dataOnly(get());
        if (input.items.length === 0) return fail("The cart is empty.");
        const offline = s.meta.simulatedOffline;
        if (offline && input.payments.some((p) => p.method !== "cash" && p.amount > 0))
          return fail("Card and QR payments are unavailable in offline mode. Use cash.");

        const lines = input.items.map((ci) => ({ ci, product: s.products.find((p) => p.id === ci.productId) }));
        for (const { ci, product } of lines) {
          if (!product) return fail("A product in the cart no longer exists.");
          if (product.status !== "active") return fail(`${product.name} is not available for sale.`);
          if (ci.quantity <= 0) return fail(`Invalid quantity for ${product.name}.`);
          if (!hasStock(product.stock, ci.quantity, s.settings.pos.allowNegativeStock))
            return fail(`Insufficient stock for ${product.name}: ${product.stock} ${product.unit} available.`);
        }
        const totals = calculateCart(
          lines.map(({ ci, product }) => ({ productId: product!.id, unitPrice: product!.sellingPrice, quantity: ci.quantity, discount: ci.discount, taxable: product!.taxable })),
          input.billDiscount,
          { rateBps: s.settings.pos.taxRateBps, mode: s.settings.pos.taxMode },
        );
        const payment = validatePayments(totals.grandTotal, input.payments);
        if (!payment.ok) return fail(payment.error ?? "Invalid payment.");

        const seq = s.meta.counters.receipt + 1;
        const date = new Date();
        const items: SaleItem[] = lines.map(({ ci, product }, i) => {
          const t = totals.lines[i];
          return {
            productId: product!.id,
            name: product!.name,
            sku: product!.sku,
            unit: product!.unit,
            quantity: ci.quantity,
            unitPrice: product!.sellingPrice,
            unitCost: product!.purchasePrice,
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
        const customer = input.customerId ? s.customers.find((c) => c.id === input.customerId) : null;
        const earned = customer ? loyaltyPoints(totals.grandTotal, s.settings.pos.loyaltyPointsPer100) : 0;
        const sale: Sale = {
          id: uid("sal"),
          receiptNo: `FM-${format(date, "yyMMdd")}-${String(seq).padStart(5, "0")}`,
          date: date.toISOString(),
          customerId: customer?.id ?? null,
          cashierId: input.cashierId,
          shiftId: input.shiftId,
          items,
          subtotal: totals.subtotal,
          itemDiscountTotal: totals.itemDiscountTotal,
          billDiscount: input.billDiscount && totals.billDiscountAmount > 0 ? { ...input.billDiscount, amount: totals.billDiscountAmount } : null,
          taxTotal: totals.taxTotal,
          total: totals.grandTotal,
          payments: payment.payments,
          change: payment.change,
          status: "completed",
          loyaltyEarned: earned,
          offline,
          synced: !offline,
        };

        const newMovements: StockMovement[] = [];
        const notes: AppNotification[] = [];
        for (const it of items) {
          const before = s.products.find((p) => p.id === it.productId)!;
          const res = applyStockChange(s, { productId: it.productId, delta: -it.quantity, type: "sale", reference: sale.receiptNo, reason: "POS sale", userId: input.cashierId, date: sale.date });
          s = { ...s, products: res.products, batches: res.batches };
          newMovements.push(res.movement);
          const n = lowStockNotification(before, res.product);
          if (n) notes.push(n);
        }
        set({
          products: s.products,
          batches: s.batches,
          movements: [...newMovements, ...s.movements],
          sales: [sale, ...s.sales],
          customers: customer ? s.customers.map((c) => (c.id === customer.id ? { ...c, loyaltyPoints: c.loyaltyPoints + earned } : c)) : s.customers,
          meta: { ...s.meta, counters: { ...s.meta.counters, receipt: seq } },
          notifications: withNotifications(s.notifications, notes),
        });
        return ok(sale);
      },

      processReturn: (input) => {
        let s: AppData = dataOnly(get());
        const sale = s.sales.find((x) => x.id === input.saleId);
        if (!sale) return fail("Sale not found.");
        const wanted = input.items.filter((i) => i.quantity > 0);
        if (wanted.length === 0) return fail("Select at least one item and quantity to return.");
        if (s.meta.simulatedOffline && input.refundMethod !== "cash") return fail("Only cash refunds are available in offline mode.");
        const returnItems: SaleReturn["items"] = [];
        const updatedItems = sale.items.map((it) => ({ ...it }));
        for (const w of wanted) {
          const line = updatedItems.find((i) => i.productId === w.productId);
          if (!line) return fail("Item is not part of this sale.");
          const v = validateReturnQty(line, w.quantity);
          if (!v.ok) return fail(`${line.name}: ${v.error}`);
          const amount = refundAmount(line, w.quantity);
          line.returnedQty = roundQty(line.returnedQty + w.quantity);
          line.refundedAmount += amount;
          returnItems.push({ productId: line.productId, name: line.name, quantity: w.quantity, refundAmount: amount, restocked: input.restock });
        }
        const total = returnItems.reduce((a, r) => a + r.refundAmount, 0);
        const seq = s.meta.counters.ret + 1;
        const ret: SaleReturn = {
          id: uid("ret"),
          returnNo: `RTN-${String(seq).padStart(4, "0")}`,
          saleId: sale.id,
          receiptNo: sale.receiptNo,
          date: nowIso(),
          items: returnItems,
          reason: input.reason,
          notes: input.notes,
          refundAmount: total,
          refundMethod: input.refundMethod,
          userId: input.userId,
          shiftId: input.shiftId,
        };
        const allReturned = updatedItems.every((i) => i.returnedQty >= i.quantity);
        const updatedSale: Sale = { ...sale, items: updatedItems, status: allReturned ? "refunded" : "partially_refunded" };

        const newMovements: StockMovement[] = [];
        if (input.restock) {
          for (const r of returnItems) {
            if (!s.products.some((p) => p.id === r.productId)) continue;
            const res = applyStockChange(s, { productId: r.productId, delta: r.quantity, type: "return", reference: ret.returnNo, reason: "Customer return — restocked", userId: input.userId });
            s = { ...s, products: res.products, batches: res.batches };
            newMovements.push(res.movement);
          }
        }
        // Reverse loyalty points proportionally to the refunded amount.
        const pointsBack = sale.customerId && sale.total > 0 ? Math.floor((sale.loyaltyEarned * total) / sale.total) : 0;
        set({
          products: s.products,
          batches: s.batches,
          movements: [...newMovements, ...s.movements],
          sales: s.sales.map((x) => (x.id === sale.id ? updatedSale : x)),
          returns: [ret, ...s.returns],
          customers: pointsBack ? s.customers.map((c) => (c.id === sale.customerId ? { ...c, loyaltyPoints: Math.max(0, c.loyaltyPoints - pointsBack) } : c)) : s.customers,
          meta: { ...s.meta, counters: { ...s.meta.counters, ret: seq } },
          notifications: withNotifications(s.notifications, [makeNotification({ type: "success", title: `Return ${ret.returnNo} processed`, message: `Refund recorded for receipt ${sale.receiptNo}${input.restock ? "; items restocked" : ""}.`, href: `/sales/${sale.id}` })]),
        });
        return ok(ret);
      },

      // ---------------- Expenses ----------------
      addExpense: (input) => {
        if (input.amount <= 0) return fail("Amount must be greater than zero.");
        const expense: Expense = { ...input, id: uid("exp"), createdAt: nowIso() };
        set((s) => ({ expenses: [expense, ...s.expenses].sort((a, b) => b.date.localeCompare(a.date)) }));
        return ok(expense);
      },
      updateExpense: (id, input) => {
        const s = get();
        const current = s.expenses.find((e) => e.id === id);
        if (!current) return fail("Expense not found.");
        const updated = { ...current, ...input };
        set({ expenses: s.expenses.map((e) => (e.id === id ? updated : e)).sort((a, b) => b.date.localeCompare(a.date)) });
        return ok(updated);
      },
      deleteExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
        return ok(undefined);
      },

      // ---------------- Shifts ----------------
      openShift: ({ cashierId, openingCash, notes }) => {
        const s = get();
        if (s.shifts.some((x) => x.status === "open" && x.cashierId === cashierId)) return fail("You already have an open register.");
        if (openingCash < 0) return fail("Opening cash cannot be negative.");
        const shift: Shift = { id: uid("shf"), cashierId, register: s.settings.pos.registerName, openedAt: nowIso(), closedAt: null, openingCash, countedCash: null, expectedCash: null, status: "open", adjustments: [], notes };
        set({ shifts: [shift, ...s.shifts] });
        return ok(shift);
      },
      closeShift: (id, countedCash, notes, expectedCash) => {
        const s = get();
        const shift = s.shifts.find((x) => x.id === id);
        if (!shift) return fail("Shift not found.");
        if (shift.status === "closed") return fail("This register is already closed.");
        if (countedCash < 0) return fail("Counted cash cannot be negative.");
        const updated: Shift = { ...shift, status: "closed", closedAt: nowIso(), countedCash, expectedCash, notes: notes || shift.notes };
        set({ shifts: s.shifts.map((x) => (x.id === id ? updated : x)) });
        return ok(updated);
      },
      addCashAdjustment: (shiftId, input) => {
        const s = get();
        const shift = s.shifts.find((x) => x.id === shiftId);
        if (!shift || shift.status !== "open") return fail("The register must be open.");
        if (input.amount <= 0) return fail("Amount must be greater than zero.");
        const adj: CashAdjustment = { ...input, id: uid("adj"), date: nowIso() };
        set({ shifts: s.shifts.map((x) => (x.id === shiftId ? { ...x, adjustments: [...x.adjustments, adj] } : x)) });
        return ok(undefined);
      },

      // ---------------- Held bills ----------------
      holdBill: (bill) => {
        if (bill.items.length === 0) return fail("Nothing to hold — the cart is empty.");
        const held: HeldBill = { ...bill, id: uid("hold"), createdAt: nowIso() };
        set((s) => ({ heldBills: [held, ...s.heldBills] }));
        return ok(held);
      },
      removeHeldBill: (id) => set((s) => ({ heldBills: s.heldBills.filter((h) => h.id !== id) })),

      // ---------------- Notifications ----------------
      addNotification: (n) => set((s) => ({ notifications: withNotifications(s.notifications, [makeNotification(n)]) })),
      markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      removeNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
      clearNotifications: () => set({ notifications: [] }),

      /** Condition-based alerts (low stock, expiry). De-duplicated per day. */
      scanConditions: () => {
        const s = get();
        if (!s.products.length) return;
        const day = format(new Date(), "yyyy-MM-dd");
        const now = new Date();
        const active = s.products.filter((p) => p.status === "active");
        const out = active.filter((p) => p.stock <= 0);
        const low = active.filter((p) => p.stock > 0 && p.stock <= p.minStock);
        const expiring = s.batches.filter((b) => b.quantity > 0 && daysUntil(b.expiryDate, now) <= 3 && daysUntil(b.expiryDate, now) >= 0);
        const expired = s.batches.filter((b) => b.quantity > 0 && daysUntil(b.expiryDate, now) < 0);
        const incoming: AppNotification[] = [];
        if (low.length + out.length > 0)
          incoming.push(makeNotification({ type: "low_stock", title: `${low.length + out.length} products need restocking`, message: `${out.length} out of stock and ${low.length} below minimum level.`, href: "/inventory?status=low_stock", key: `scan-low:${day}` }));
        if (expiring.length > 0)
          incoming.push(makeNotification({ type: "expiry", title: `${expiring.length} batches expire within 3 days`, message: "Consider discounting or moving these items to the front shelf.", href: "/inventory/expiry", key: `scan-exp:${day}` }));
        if (expired.length > 0)
          incoming.push(makeNotification({ type: "expiry", title: `${expired.length} expired batches on hand`, message: "Write off expired stock so it is not sold.", href: "/inventory/expiry?tab=expired", key: `scan-expired:${day}` }));
        if (incoming.length) set({ notifications: withNotifications(s.notifications, incoming) });
      },

      // ---------------- Settings & users ----------------
      updateSettings: (patch) =>
        set((s) => ({ settings: { shop: { ...s.settings.shop, ...patch.shop }, pos: { ...s.settings.pos, ...patch.pos } } })),
      addUser: (input) => {
        const s = get();
        if (s.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) return fail("A user with this email already exists.");
        const user: User = { ...input, id: uid("usr"), createdAt: nowIso() };
        set({ users: [...s.users, user] });
        return ok(user);
      },
      updateUser: (id, input) => {
        const s = get();
        const current = s.users.find((u) => u.id === id);
        if (!current) return fail("User not found.");
        if (input.email && s.users.some((u) => u.id !== id && u.email.toLowerCase() === input.email!.toLowerCase())) return fail("Another user already uses this email.");
        if (current.role === "admin" && (input.active === false || (input.role && input.role !== "admin")) && s.users.filter((u) => u.role === "admin" && u.active).length <= 1)
          return fail("At least one active admin is required.");
        const updated = { ...current, ...input };
        set({ users: s.users.map((u) => (u.id === id ? updated : u)) });
        return ok(updated);
      },

      // ---------------- Offline simulation ----------------
      setSimulatedOffline: (offline) => set((s) => ({ meta: { ...s.meta, simulatedOffline: offline } })),
      syncPendingSales: () => {
        const s = get();
        if (s.meta.simulatedOffline) return fail("Go back online before syncing.");
        const pending = s.sales.filter((x) => !x.synced).length;
        set({ sales: s.sales.map((x) => (x.synced ? x : { ...x, synced: true })), meta: { ...s.meta, lastSyncAt: nowIso() } });
        return ok(pending);
      },
    }),
    {
      name: STORAGE_KEY,
      version: SEED_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => dataOnly(state),
      // Incompatible versions are discarded and re-seeded by ensureSeeded() (see StoreHydrator).
      migrate: () => ({}) as AppState,
    },
  ),
);
