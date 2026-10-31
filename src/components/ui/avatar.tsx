import { cn } from "@/lib/utils";
import { initials } from "@/lib/formatting";
export function UserAvatar({ name, color, className }: { name: string; color?: string; className?: string }) {
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-card", className)} style={{ background: color ?? "var(--primary)" }} aria-hidden>
      {initials(name)}
    </span>
  );
}
