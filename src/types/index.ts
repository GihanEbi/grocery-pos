/**
 * Shared domain types for FreshMart POS.
 *
 * MONEY CONVENTION: every monetary value is an integer number of cents
 * (LKR minor units). Use helpers in `@/lib/calculations/money` for math and
 * `@/lib/formatting` for display. Never store floats for money.
 *
 * RATES are stored in basis points (1800 = 18.00%).
 * QUANTITIES are numbers; weighted products (unit "kg") may have up to 3 decimals.
 */

export type ID = string;
/** Integer cents (LKR minor units). */
export type Cents = number;
/** ISO-8601 date-time string. */
export type ISODate = string;

export type Role = "admin" | "manager" | "cashier";

export interface User {
  id: ID;
  name: string;
  email: string;
  /** Demo-only plain text password. Never do this in production. */
  password: string;
  role: Role;
  phone: string;
  active: boolean;
  avatarColor: string;
  createdAt: ISODate;
}

export interface Category {
  id: ID;
  name: string;
  /** Emoji used as the category icon. */
  icon: string;
  /** Tailwind-independent hex color for chips/charts. */
  color: string;
}

export type ProductUnit = "pcs" | "kg" | "pack" | "bottle" | "l" | "dozen" | "box";
export type ProductStatus = "active" | "inactive" | "archived";

export interface Product {
  id: ID;
  name: string;
  sku: string;
  barcode: string;
  categoryId: ID;
  brand: string;
  description: string;
  purchasePrice: Cents;
  sellingPrice: Cents;
  unit: ProductUnit;
  /** Current on-hand stock. Kept in sync with batches for expiry-tracked products. */
  stock: number;
  minStock: number;
  /** Emoji illustration or a data: URL uploaded by the user. */
  image: string;
  status: ProductStatus;
  supplierId: ID | null;
  /** Whether VAT applies to this product. */
  taxable: boolean;
  trackExpiry: boolean;
  /** Typical shelf life used when receiving new batches. */
  shelfLifeDays: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Batch {
  id: ID;
  productId: ID;
  batchNo: string;
  quantity: number;
  receivedDate: ISODate;
  expiryDate: ISODate;
  costPrice: Cents;
}

export type MovementType =
  | "opening"
  | "sale"
  | "purchase"
  | "return"
  | "adjustment"
  | "damage"
  | "expired";

export interface StockMovement {
  id: ID;
  productId: ID;
  type: MovementType;
  /** Signed quantity: positive adds stock, negative removes stock. */
  quantity: number;
  balanceAfter: number;
  reference: string;
  userId: ID;
  reason: string;
  date: ISODate;
}

export type SupplierStatus = "active" | "inactive";

export interface Supplier {
  id: ID;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  status: SupplierStatus;
  /** Typical delivery lead time in days, used by reorder forecasting. */
  leadTimeDays: number;
  createdAt: ISODate;
}

export type POStatus = "draft" | "approved" | "partially_received" | "received" | "cancelled";

export interface PurchaseOrderItem {
  productId: ID;
  quantity: number;
  unitCost: Cents;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: ID;
  poNumber: string;
  supplierId: ID;
  status: POStatus;
  items: PurchaseOrderItem[];
  notes: string;
  expectedDate: ISODate | null;
  createdAt: ISODate;
  createdBy: ID;
  approvedAt: ISODate | null;
  approvedBy: ID | null;
  receivedAt: ISODate | null;
  /** "ai" when created from an AI reorder suggestion (still requires human save/approve). */
  source: "manual" | "ai";
}

export type CustomerStatus = "active" | "inactive";

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email: string;
  address: string;
  loyaltyPoints: number;
  status: CustomerStatus;
  createdAt: ISODate;
}

export type PaymentMethod = "cash" | "card" | "qr";

export interface Payment {
  method: PaymentMethod;
  /** Amount applied to the bill (cash tendered minus change). */
  amount: Cents;
  /** Cash tendered, only for cash payments. */
  tendered?: Cents;
  reference?: string;
}

/** Immutable snapshot of a sold line. Prices/costs are frozen at time of sale. */
export interface SaleItem {
  productId: ID;
  name: string;
  sku: string;
  unit: ProductUnit;
  quantity: number;
  unitPrice: Cents;
  unitCost: Cents;
  /** Line-level discount amount. */
  itemDiscount: Cents;
  /** Share of the bill-level discount allocated to this line. */
  billDiscountShare: Cents;
  taxRateBps: number;
  taxAmount: Cents;
  /** Revenue excluding tax, after all discounts. */
  revenue: Cents;
  /** Amount the customer paid for this line (incl. tax). */
  lineTotal: Cents;
  returnedQty: number;
  refundedAmount: Cents;
}

export type SaleStatus = "completed" | "partially_refunded" | "refunded";
export type DiscountType = "percent" | "fixed";

export interface BillDiscount {
  type: DiscountType;
  /** bps for percent, cents for fixed */
  value: number;
  amount: Cents;
}

export interface Sale {
  id: ID;
  receiptNo: string;
  date: ISODate;
  customerId: ID | null;
  cashierId: ID;
  shiftId: ID | null;
  items: SaleItem[];
  subtotal: Cents;
  itemDiscountTotal: Cents;
  billDiscount: BillDiscount | null;
  taxTotal: Cents;
  total: Cents;
  payments: Payment[];
  change: Cents;
  status: SaleStatus;
  loyaltyEarned: number;
  /** Created while the terminal was in simulated offline mode. */
  offline: boolean;
  synced: boolean;
}

export type ReturnReason =
  | "damaged"
  | "expired"
  | "wrong_item"
  | "customer_changed_mind"
  | "quality_issue"
  | "other";

export interface ReturnItem {
  productId: ID;
  name: string;
  quantity: number;
  refundAmount: Cents;
  restocked: boolean;
}

export interface SaleReturn {
  id: ID;
  returnNo: string;
  saleId: ID;
  receiptNo: string;
  date: ISODate;
  items: ReturnItem[];
  reason: ReturnReason;
  notes: string;
  refundAmount: Cents;
  refundMethod: PaymentMethod;
  userId: ID;
  shiftId: ID | null;
}

export type ExpenseCategory =
  | "rent"
  | "electricity"
  | "water"
  | "salaries"
  | "transportation"
  | "maintenance"
  | "other";

export interface Expense {
  id: ID;
  category: ExpenseCategory;
  description: string;
  amount: Cents;
  date: ISODate;
  paymentMethod: "cash" | "bank" | "card";
  createdBy: ID;
  createdAt: ISODate;
}

export interface CashAdjustment {
  id: ID;
  type: "pay_in" | "pay_out";
  amount: Cents;
  reason: string;
  date: ISODate;
}

export interface Shift {
  id: ID;
  cashierId: ID;
  register: string;
  openedAt: ISODate;
  closedAt: ISODate | null;
  openingCash: Cents;
  countedCash: Cents | null;
  /** Snapshot of the expected cash at close time. */
  expectedCash: Cents | null;
  status: "open" | "closed";
  adjustments: CashAdjustment[];
  notes: string;
}

export type NotificationType = "low_stock" | "expiry" | "purchase" | "success" | "ai_insight" | "system";

export interface AppNotification {
  id: ID;
  type: NotificationType;
  title: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: ISODate;
  /** De-duplication key for condition-based notifications. */
  key?: string;
}

export interface CartItem {
  /** Line id (a product can appear once per cart, but id keeps React keys stable). */
  lineId: ID;
  productId: ID;
  quantity: number;
  /** Line discount amount in cents. */
  discount: Cents;
}

export interface HeldBill {
  id: ID;
  label: string;
  items: CartItem[];
  customerId: ID | null;
  billDiscount: { type: DiscountType; value: number } | null;
  createdAt: ISODate;
  cashierId: ID;
}

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  currency: string;
  registrationNo: string;
}

export interface PosSettings {
  receiptHeader: string;
  receiptFooter: string;
  taxName: string;
  taxRateBps: number;
  taxMode: "exclusive" | "inclusive";
  defaultPaymentMethod: PaymentMethod;
  /** Maximum bill discount per role, in bps. */
  discountLimits: Record<Role, number>;
  requireOpenRegister: boolean;
  registerName: string;
  /** Loyalty points earned per Rs 100 spent. */
  loyaltyPointsPer100: number;
  allowNegativeStock: boolean;
}

export interface Settings {
  shop: ShopSettings;
  pos: PosSettings;
}

export interface AppMeta {
  seedVersion: number;
  /** ISO date the demo data was generated relative to. */
  demoDate: ISODate;
  /** Simulated offline mode for the POS. */
  simulatedOffline: boolean;
  lastSyncAt: ISODate | null;
  counters: { receipt: number; po: number; ret: number };
}

/** Result type returned by every mutating action / mock service. */
export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };
