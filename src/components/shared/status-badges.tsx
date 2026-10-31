import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { ExpiryStatus, StockStatus } from "@/lib/calculations/inventory";
import type { POStatus, PaymentMethod, ProductStatus, SaleStatus } from "@/types";
import { Banknote, CreditCard, QrCode } from "lucide-react";

const stockMap: Record<StockStatus, [string, BadgeVariant]> = {
  in_stock: ["In stock", "success"],
  low_stock: ["Low stock", "warning"],
  out_of_stock: ["Out of stock", "destructive"],
};
export function StockStatusBadge({ status }: { status: StockStatus }) {
  const [label, v] = stockMap[status];
  return <Badge variant={v} dot>{label}</Badge>;
}

const poMap: Record<POStatus, [string, BadgeVariant]> = {
  draft: ["Draft", "secondary"],
  approved: ["Approved", "info"],
  partially_received: ["Partially received", "warning"],
  received: ["Received", "success"],
  cancelled: ["Cancelled", "destructive"],
};
export function POStatusBadge({ status }: { status: POStatus }) {
  const [label, v] = poMap[status];
  return <Badge variant={v} dot>{label}</Badge>;
}
export const PO_STATUS_LABEL: Record<POStatus, string> = Object.fromEntries(Object.entries(poMap).map(([k, [l]]) => [k, l])) as Record<POStatus, string>;

const saleMap: Record<SaleStatus, [string, BadgeVariant]> = {
  completed: ["Completed", "success"],
  partially_refunded: ["Partly refunded", "warning"],
  refunded: ["Refunded", "destructive"],
};
export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  const [label, v] = saleMap[status];
  return <Badge variant={v}>{label}</Badge>;
}

const expiryMap: Record<ExpiryStatus, [string, BadgeVariant]> = {
  expired: ["Expired", "destructive"],
  critical: ["Expires ≤ 3 days", "destructive"],
  soon: ["Expiring soon", "warning"],
  ok: ["Fresh", "success"],
};
export function ExpiryBadge({ status, daysLeft }: { status: ExpiryStatus; daysLeft?: number }) {
  const [label, v] = expiryMap[status];
  const text =
    daysLeft === undefined ? label
    : daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago`
    : daysLeft === 0 ? "Expires today"
    : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  return <Badge variant={v} dot>{text}</Badge>;
}

const productStatusMap: Record<ProductStatus, [string, BadgeVariant]> = {
  active: ["Active", "success"],
  inactive: ["Inactive", "secondary"],
  archived: ["Archived", "outline"],
};
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const [label, v] = productStatusMap[status];
  return <Badge variant={v}>{label}</Badge>;
}

const payIcons = { cash: Banknote, card: CreditCard, qr: QrCode };
const payLabel = { cash: "Cash", card: "Card", qr: "QR Pay" };
export function PaymentBadge({ methods }: { methods: PaymentMethod[] }) {
  const unique = [...new Set(methods)];
  if (unique.length > 1)
    return <Badge variant="outline" className="text-foreground/80">Split · {unique.map((m) => payLabel[m]).join(" + ")}</Badge>;
  const m = unique[0] ?? "cash";
  const Icon = payIcons[m];
  return <Badge variant="outline" className="text-foreground/80"><Icon />{payLabel[m]}</Badge>;
}
