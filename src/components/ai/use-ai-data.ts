"use client";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/app-store";
import type { AppData } from "@/types/data";

/** Reactive AppData snapshot (only re-renders when a data slice changes). */
export function useAiData(): AppData {
  return useAppStore(
    useShallow((s) => ({
      users: s.users,
      categories: s.categories,
      products: s.products,
      batches: s.batches,
      movements: s.movements,
      suppliers: s.suppliers,
      purchaseOrders: s.purchaseOrders,
      customers: s.customers,
      sales: s.sales,
      returns: s.returns,
      expenses: s.expenses,
      shifts: s.shifts,
      notifications: s.notifications,
      heldBills: s.heldBills,
      settings: s.settings,
      meta: s.meta,
    })),
  );
}
