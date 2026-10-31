"use client";

import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "@/store/app-store";
import { useAuthStore, useCurrentUser } from "@/store/auth-store";
import { can, type Permission } from "@/lib/permissions";
import type { Category, Customer, Product, Supplier, User } from "@/types";

export { useCurrentUser };

/** Permission check for the signed-in user. */
export function useCan(permission: Permission): boolean {
  const user = useCurrentUser();
  return can(user?.role, permission);
}

/** Stable id → entity maps for fast lookups in tables. */
export function useProductMap(): Map<string, Product> {
  const products = useAppStore((s) => s.products);
  return useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
}
export function useCategoryMap(): Map<string, Category> {
  const categories = useAppStore((s) => s.categories);
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
}
export function useSupplierMap(): Map<string, Supplier> {
  const suppliers = useAppStore((s) => s.suppliers);
  return useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
}
export function useCustomerMap(): Map<string, Customer> {
  const customers = useAppStore((s) => s.customers);
  return useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
}
export function useUserMap(): Map<string, User> {
  const users = useAppStore((s) => s.users);
  return useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
}

/** The open register (shift) of the signed-in user, if any. */
export function useActiveShift() {
  const userId = useAuthStore((s) => s.userId);
  return useAppStore((s) => s.shifts.find((x) => x.status === "open" && x.cashierId === userId) ?? null);
}

export function useSettings() {
  return useAppStore(useShallow((s) => s.settings));
}

/** Browser online status (real network) — distinct from the simulated offline mode. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Debounced value for search inputs over large lists. */
export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Media query hook (client only). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const fn = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", fn);
    return () => m.removeEventListener("change", fn);
  }, [query]);
  return matches;
}
