import type { PaymentMethod, ReturnReason, Sale } from "@/types";
import { RETURN_REASONS } from "@/config/defaults";

export type PaymentFilter = PaymentMethod | "split";

/** "split" when a sale was paid with more than one method, else that method. */
export function paymentKind(sale: Pick<Sale, "payments">): PaymentFilter {
  const unique = [...new Set(sale.payments.filter((p) => p.amount > 0).map((p) => p.method))];
  if (unique.length > 1) return "split";
  return unique[0] ?? sale.payments[0]?.method ?? "cash";
}

export const PAYMENT_FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "qr", label: "QR Pay" },
  { value: "split", label: "Split" },
];

export const SALE_STATUS_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "partially_refunded", label: "Partly refunded" },
  { value: "refunded", label: "Refunded" },
] as const;

export function reasonLabel(reason: ReturnReason): string {
  return RETURN_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/** Total refunded so far on a sale. */
export function saleRefunded(sale: Pick<Sale, "items">): number {
  return sale.items.reduce((a, i) => a + i.refundedAmount, 0);
}
