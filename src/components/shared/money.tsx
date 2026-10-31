import { formatMoney } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export function Money({ value, className, muted }: { value: number; className?: string; muted?: boolean }) {
  return <span className={cn("tabular whitespace-nowrap", muted && "text-muted-foreground", className)}>{formatMoney(value)}</span>;
}
