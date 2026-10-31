import type { Settings } from "@/types";

export const SEED_VERSION = 3;
export const STORAGE_KEY = "freshmart-pos-data";

export const DEFAULT_SETTINGS: Settings = {
  shop: {
    name: "FreshMart Grocery",
    address: "No. 24, Peradeniya Road, Kandy 20000",
    phone: "+94 81 222 4567",
    email: "hello@freshmart.lk",
    logo: "",
    currency: "LKR",
    registrationNo: "PV 00123456",
  },
  pos: {
    receiptHeader: "Thank you for shopping with us!",
    receiptFooter: "Goods once sold can be returned within 7 days with this receipt.\nThis is a demo receipt — no real transaction took place.",
    taxName: "VAT",
    taxRateBps: 1800,
    taxMode: "exclusive",
    defaultPaymentMethod: "cash",
    discountLimits: { admin: 10000, manager: 2500, cashier: 1000 },
    requireOpenRegister: true,
    registerName: "Counter 01",
    loyaltyPointsPer100: 1,
    allowNegativeStock: false,
  },
};

export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Rent", color: "#6366f1" },
  { value: "electricity", label: "Electricity", color: "#f59e0b" },
  { value: "water", label: "Water", color: "#0ea5e9" },
  { value: "salaries", label: "Salaries", color: "#10b981" },
  { value: "transportation", label: "Transportation", color: "#f97316" },
  { value: "maintenance", label: "Maintenance", color: "#8b5cf6" },
  { value: "other", label: "Other", color: "#64748b" },
] as const;

export const RETURN_REASONS = [
  { value: "damaged", label: "Damaged item" },
  { value: "expired", label: "Expired / near expiry" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "quality_issue", label: "Quality issue" },
  { value: "customer_changed_mind", label: "Customer changed mind" },
  { value: "other", label: "Other" },
] as const;

export const ADJUSTMENT_REASONS = [
  { value: "count_correction", label: "Stock count correction", direction: "both" },
  { value: "damage", label: "Damaged stock", direction: "out" },
  { value: "expired", label: "Expired stock write-off", direction: "out" },
  { value: "theft", label: "Theft / loss", direction: "out" },
  { value: "internal_use", label: "Internal use", direction: "out" },
  { value: "found", label: "Found stock", direction: "in" },
  { value: "supplier_bonus", label: "Supplier free issue", direction: "in" },
] as const;

export const UNITS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "kg", label: "Kilogram (kg) — weighed" },
  { value: "pack", label: "Pack" },
  { value: "bottle", label: "Bottle" },
  { value: "l", label: "Litre (L)" },
  { value: "dozen", label: "Dozen" },
  { value: "box", label: "Box" },
] as const;
