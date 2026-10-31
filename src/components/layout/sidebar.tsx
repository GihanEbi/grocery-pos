"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/config/navigation";
import { useAppStore } from "@/store/app-store";
import { useCurrentUser } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { BrandMark, BrandName } from "./brand";

function useBadgeCounts() {
  const lowStock = useAppStore((s) => s.products.filter((p) => p.status === "active" && p.stock <= p.minStock).length);
  const unread = useAppStore((s) => s.notifications.filter((n) => !n.read).length);
  return { lowStock, notifications: unread };
}

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const badges = useBadgeCounts();
  const isActive = (item: NavItem) => pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Main navigation">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((i) => can(user?.role, i.permission));
        if (!items.length) return null;
        return (
          <div key={section.label}>
            {!collapsed && <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{section.label}</p>}
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const active = isActive(item);
                const badge = item.badge ? badges[item.badge] : 0;
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    data-testid={`nav-${item.href.slice(1)}`}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                    <item.icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                    {badge > 0 && (
                      <span className={cn("ml-auto rounded-full px-1.5 text-[10.5px] font-semibold tabular leading-[18px]", item.badge === "lowStock" ? "bg-warning-soft text-warning-foreground" : "bg-primary text-primary-foreground", collapsed && "absolute -right-0.5 -top-0.5 ml-0 min-w-4 px-1 text-[9px] leading-4")}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                    {item.title === "AI Assistant" && !collapsed && !badge && <span className="ml-auto rounded-full bg-gradient-to-r from-primary/15 to-chart-2/20 px-1.5 text-[10px] font-semibold text-primary-soft-foreground">AI</span>}
                  </Link>
                );
                return <li key={item.href}>{collapsed ? <Tooltip content={item.title} side="right">{link}</Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const shopName = useAppStore((s) => s.settings.shop.name);

  return (
    <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex", collapsed ? "w-[68px]" : "w-[248px]")}>
      <div className={cn("flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        <BrandMark />
        {!collapsed && <BrandName shopName={shopName} />}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", collapsed && "justify-center px-0")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
