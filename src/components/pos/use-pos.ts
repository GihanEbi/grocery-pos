"use client";

import { useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { useCartStore } from "@/store/cart-store";
import { useCurrentUser } from "@/store/auth-store";
import { calculateCart, type CartTotals } from "@/lib/calculations/cart";
import { multiply } from "@/lib/calculations/money";
import type { CartItem, Product } from "@/types";

export interface PosLine {
  item: CartItem;
  product: Product;
  gross: number;
  lineTotal: number;
  /** Requested quantity exceeds stock on hand. */
  overStock: boolean;
}

/** Live cart totals using current prices + settings. Snapshotted only at checkout. */
export function usePosCart() {
  const items = useCartStore((s) => s.items);
  const billDiscount = useCartStore((s) => s.billDiscount);
  const products = useAppStore((s) => s.products);
  const pos = useAppStore((s) => s.settings.pos);
  const user = useCurrentUser();

  return useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const valid = items.filter((i) => byId.has(i.productId));
    const totals: CartTotals = calculateCart(
      valid.map((i) => {
        const p = byId.get(i.productId)!;
        return { productId: p.id, unitPrice: p.sellingPrice, quantity: i.quantity, discount: i.discount, taxable: p.taxable };
      }),
      billDiscount,
      { rateBps: pos.taxRateBps, mode: pos.taxMode },
    );
    const lines: PosLine[] = valid.map((item, idx) => {
      const product = byId.get(item.productId)!;
      return {
        item,
        product,
        gross: multiply(product.sellingPrice, item.quantity),
        lineTotal: totals.lines[idx].lineTotal,
        overStock: !pos.allowNegativeStock && item.quantity > product.stock + 1e-9,
      };
    });
    const totalDiscount = totals.itemDiscountTotal + totals.billDiscountAmount;
    const discountBps = totals.grossTotal > 0 ? Math.round((totalDiscount * 10000) / totals.grossTotal) : 0;
    const limitBps = user ? pos.discountLimits[user.role] : 0;
    const units = valid.reduce((a, i) => a + (byId.get(i.productId)!.unit === "kg" ? 1 : i.quantity), 0);
    return {
      lines,
      totals,
      totalDiscount,
      discountBps,
      limitBps,
      discountExceeded: discountBps > limitBps,
      hasStockIssue: lines.some((l) => l.overStock),
      units: Math.round(units),
      empty: valid.length === 0,
    };
  }, [items, billDiscount, products, pos, user]);
}

/** Quantity of a product already in the cart. */
export function useCartQty(productId: string) {
  return useCartStore((s) => s.items.find((i) => i.productId === productId)?.quantity ?? 0);
}
