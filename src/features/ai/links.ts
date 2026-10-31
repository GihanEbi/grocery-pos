import type { AiReorderLine } from "./types";

/**
 * Deep link into the purchase-order form with suggested lines pre-selected.
 * The form only opens prefilled — the user still reviews and saves it.
 */
export function draftPoHref(supplierId: string | null, lines: Pick<AiReorderLine, "productId" | "suggestedQty">[]): string {
  const params = new URLSearchParams();
  if (supplierId) params.set("supplier", supplierId);
  params.set("items", lines.map((l) => `${l.productId}:${l.suggestedQty}`).join(","));
  params.set("source", "ai");
  // Keep ":" and "," readable in the URL.
  return `/purchasing/new?${params.toString().replace(/%3A/g, ":").replace(/%2C/g, ",")}`;
}

/** Link that opens the assistant and asks a question once. */
export function askHref(question: string): string {
  return `/ai-assistant?q=${encodeURIComponent(question)}`;
}
