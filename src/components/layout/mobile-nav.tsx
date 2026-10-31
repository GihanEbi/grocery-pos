"use client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";
import { SidebarNav } from "./sidebar";
import { BrandMark, BrandName } from "./brand";

export function MobileNav() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const shopName = useAppStore((s) => s.settings.shop.name);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" size="sm" className="w-[280px] max-w-[85vw] bg-sidebar" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <BrandMark />
          <BrandName shopName={shopName} />
        </div>
        <div className="flex-1 overflow-y-auto" data-testid="mobile-nav">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
