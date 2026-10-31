import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small inline marker for anything simulated. */
export function DemoBadge({ label = "Simulated", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-dashed border-info/40 bg-info-soft/60 px-2 py-0.5 text-[11px] font-medium text-info-foreground", className)}>
      <FlaskConical className="size-3" />
      {label}
    </span>
  );
}
