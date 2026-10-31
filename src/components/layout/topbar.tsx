"use client";
import { usePathname } from "next/navigation";
import { Menu, Search, Store } from "lucide-react";
import { PAGE_TITLES } from "@/config/navigation";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { ConnectionStatus } from "./connection-status";

function titleFor(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/sales/")) return "Transaction Details";
  const base = "/" + pathname.split("/")[1];
  return PAGE_TITLES[base] ?? "FreshMart POS";
}

export function Topbar() {
  const pathname = usePathname();
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const shop = useAppStore((s) => s.settings.shop);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-xl sm:gap-3 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="mobile-menu">
        <Menu className="size-5" />
      </Button>
      <p className="min-w-0 truncate text-[15px] font-semibold tracking-tight" data-testid="page-title">{titleFor(pathname)}</p>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="ml-auto hidden h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-colors hover:border-ring/40 md:flex"
        data-testid="global-search"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search products, customers, receipts…</span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setCommandOpen(true)} aria-label="Search"><Search className="size-[18px]" /></Button>
        <ConnectionStatus />
        <div className="hidden items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground 2xl:flex" title={shop.address}>
          <Store className="size-3.5" />
          <span className="max-w-40 truncate">{shop.name}</span>
        </div>
        <ThemeToggle />
        <NotificationBell />
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
