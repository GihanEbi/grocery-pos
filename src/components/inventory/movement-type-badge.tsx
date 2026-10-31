import type { MovementType } from "@/types";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

export const MOVEMENT_TYPES: { value: MovementType; label: string; variant: BadgeVariant }[] = [
  { value: "opening", label: "Opening", variant: "secondary" },
  { value: "sale", label: "Sale", variant: "info" },
  { value: "purchase", label: "Purchase", variant: "success" },
  { value: "return", label: "Return", variant: "default" },
  { value: "adjustment", label: "Adjustment", variant: "outline" },
  { value: "damage", label: "Damage", variant: "warning" },
  { value: "expired", label: "Expired", variant: "destructive" },
];

const byType = new Map(MOVEMENT_TYPES.map((t) => [t.value, t]));

export function movementLabel(type: MovementType): string {
  return byType.get(type)?.label ?? type;
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  const t = byType.get(type);
  return <Badge variant={t?.variant ?? "secondary"} dot>{t?.label ?? type}</Badge>;
}
