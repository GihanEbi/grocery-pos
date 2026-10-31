"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, History, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/inventory", label: "Overview", icon: LayoutGrid },
  { href: "/inventory/movements", label: "Stock movements", icon: History },
  { href: "/inventory/expiry", label: "Expiry", icon: CalendarClock },
] as const;

/** Pill tabs shared by the three inventory pages. */
export function InventorySubnav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Inventory sections" className={cn("-mx-4 mb-5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0", className)}>
      <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1 shadow-soft">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              data-testid={`inventory-tab-${href.split("/")[2] ?? "overview"}`}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                active ? "bg-primary-soft text-primary-soft-foreground shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_18%,transparent)]" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
