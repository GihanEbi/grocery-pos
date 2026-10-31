"use client";

import { toast } from "sonner";
import type { Product } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCartStore } from "@/store/cart-store";
import { roundQty } from "@/lib/calculations/money";
import { formatQty } from "@/lib/formatting";

/**
 * Add a product to the cart with stock validation. Returns true when added.
 * Weighted products must pass an explicit quantity (from the weight dialog).
 */
export function addToCart(product: Product, quantity: number): boolean {
  const allowNegative = useAppStore.getState().settings.pos.allowNegativeStock;
  if (product.status !== "active") {
    toast.error(`${product.name} is not available for sale`);
    return false;
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    toast.error("Enter a quantity greater than zero");
    return false;
  }
  if (product.unit !== "kg" && !Number.isInteger(quantity)) {
    toast.error(`${product.name} is sold in whole units`);
    return false;
  }
  const inCart = useCartStore.getState().items.find((i) => i.productId === product.id)?.quantity ?? 0;
  if (!allowNegative && roundQty(inCart + quantity) > product.stock) {
    const left = roundQty(product.stock - inCart);
    toast.error(product.stock <= 0 ? `${product.name} is out of stock` : `Not enough stock for ${product.name}`, {
      description: left > 0 ? `Only ${formatQty(left, product.unit)} more available.` : `All ${formatQty(product.stock, product.unit)} on hand are already in the cart.`,
    });
    return false;
  }
  useCartStore.getState().add(product.id, quantity);
  return true;
}

/** Set an exact quantity with the same validation. */
export function setCartQty(product: Product, quantity: number): boolean {
  const allowNegative = useAppStore.getState().settings.pos.allowNegativeStock;
  if (quantity <= 0) {
    useCartStore.getState().remove(product.id);
    return true;
  }
  if (product.unit !== "kg" && !Number.isInteger(quantity)) return false;
  if (!allowNegative && roundQty(quantity) > product.stock) {
    toast.error(`Only ${formatQty(product.stock, product.unit)} of ${product.name} in stock`);
    return false;
  }
  useCartStore.getState().setQuantity(product.id, quantity);
  return true;
}

/** Find a product by exact barcode or SKU (case-insensitive). */
export function findByCode(code: string): Product | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return useAppStore.getState().products.find((p) => p.status !== "archived" && (p.barcode === c || p.sku.toLowerCase() === c));
}
