"use client";

import { useMemo } from "react";
import type { Sale } from "@/types";
import { useAppStore } from "@/store/app-store";

export interface CustomerStats {
  /** Number of sales (visits). */
  purchases: number;
  /** Sum of sale totals minus refunds. */
  spending: number;
  refunds: number;
  lastVisit: string | null;
  sales: Sale[];
}

const EMPTY: CustomerStats = { purchases: 0, spending: 0, refunds: 0, lastVisit: null, sales: [] };

/** Per-customer purchase aggregates computed from sale + return records. */
export function useCustomerStats(): Map<string, CustomerStats> {
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  return useMemo(() => {
    const map = new Map<string, CustomerStats>();
    const saleCustomer = new Map<string, string>();
    for (const s of sales) {
      if (!s.customerId) continue;
      saleCustomer.set(s.id, s.customerId);
      const st = map.get(s.customerId) ?? { purchases: 0, spending: 0, refunds: 0, lastVisit: null, sales: [] };
      st.purchases += 1;
      st.spending += s.total;
      st.sales.push(s);
      if (!st.lastVisit || s.date > st.lastVisit) st.lastVisit = s.date;
      map.set(s.customerId, st);
    }
    for (const r of returns) {
      const cid = saleCustomer.get(r.saleId);
      if (!cid) continue;
      const st = map.get(cid);
      if (!st) continue;
      st.refunds += r.refundAmount;
      st.spending -= r.refundAmount;
    }
    for (const st of map.values()) st.sales.sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }, [sales, returns]);
}

export function statsFor(map: Map<string, CustomerStats>, id: string): CustomerStats {
  return map.get(id) ?? EMPTY;
}
