"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartItem, DiscountType, HeldBill } from "@/types";
import { roundQty } from "@/lib/calculations/money";
import { uid } from "@/lib/utils";

/**
 * The POS cart. Persisted so an in-progress bill survives navigation and reloads.
 * Prices are always read live from products until checkout, when they are snapshotted.
 */
interface CartState {
  items: CartItem[];
  customerId: string | null;
  billDiscount: { type: DiscountType; value: number } | null;
  /** Product id of the most recently added/changed line — used for highlight & scroll. */
  lastTouched: string | null;
  add: (productId: string, quantity: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  setItemDiscount: (productId: string, discount: number) => void;
  setBillDiscount: (d: { type: DiscountType; value: number } | null) => void;
  setCustomer: (id: string | null) => void;
  clear: () => void;
  load: (bill: HeldBill) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      customerId: null,
      billDiscount: null,
      lastTouched: null,
      add: (productId, quantity) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === productId);
          if (existing)
            return {
              items: s.items.map((i) => (i.productId === productId ? { ...i, quantity: roundQty(i.quantity + quantity) } : i)),
              lastTouched: productId,
            };
          return { items: [...s.items, { lineId: uid("ln"), productId, quantity: roundQty(quantity), discount: 0 }], lastTouched: productId };
        }),
      setQuantity: (productId, quantity) =>
        set((s) => ({
          items: quantity <= 0 ? s.items.filter((i) => i.productId !== productId) : s.items.map((i) => (i.productId === productId ? { ...i, quantity: roundQty(quantity) } : i)),
          lastTouched: productId,
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      setItemDiscount: (productId, discount) => set((s) => ({ items: s.items.map((i) => (i.productId === productId ? { ...i, discount: Math.max(0, Math.round(discount)) } : i)) })),
      setBillDiscount: (billDiscount) => set({ billDiscount }),
      setCustomer: (customerId) => set({ customerId }),
      clear: () => set({ items: [], customerId: null, billDiscount: null, lastTouched: null }),
      load: (bill) => set({ items: bill.items, customerId: bill.customerId, billDiscount: bill.billDiscount, lastTouched: null }),
    }),
    { name: "freshmart-pos-cart", skipHydration: true, storage: createJSONStorage(() => localStorage) },
  ),
);
