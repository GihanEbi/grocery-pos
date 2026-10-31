import { stockStatus } from "@/lib/calculations/inventory";
import { cn } from "@/lib/utils";

/**
 * Mini bar of stock vs. minimum level. The scale runs to 2× minimum, so the
 * tick in the middle marks the minimum level.
 */
export function StockBar({ stock, minStock, className }: { stock: number; minStock: number; className?: string }) {
  const status = stockStatus(stock, minStock);
  const scale = Math.max(minStock * 2, 1);
  const pct = Math.max(0, Math.min(100, (stock / scale) * 100));
  return (
    <div className={cn("relative h-1.5 w-20 overflow-hidden rounded-full bg-muted", className)} role="img" aria-label={`Stock ${stock} vs minimum ${minStock}`}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", status === "out_of_stock" ? "bg-destructive" : status === "low_stock" ? "bg-warning" : "bg-success")}
        style={{ width: `${status === "out_of_stock" ? 0 : Math.max(pct, 4)}%` }}
      />
      {minStock > 0 && <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/25" />}
    </div>
  );
}
