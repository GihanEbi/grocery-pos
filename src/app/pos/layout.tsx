"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Receipt } from "lucide-react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { BrandMark } from "@/components/layout/brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { ConnectionStatus } from "@/components/layout/connection-status";
import { CommandPalette } from "@/components/layout/command-palette";
import { ShortcutHelp } from "@/components/pos/pos-terminal";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useActiveShift, useCan } from "@/hooks";
import { useAppStore } from "@/store/app-store";
import { formatTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <div className="hidden text-right leading-tight xl:block">
      <p className="text-sm font-semibold tabular">{format(now, "hh:mm a")}</p>
      <p className="text-[11px] text-muted-foreground">{format(now, "EEE, dd MMM")}</p>
    </div>
  );
}

function RegisterPill() {
  const shift = useActiveShift();
  const registerName = useAppStore((s) => s.settings.pos.registerName);
  return (
    <Link
      href="/shifts"
      className={cn("hidden h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors md:flex", shift ? "border-success/30 bg-success-soft/60 text-success-foreground hover:bg-success-soft" : "border-warning/40 bg-warning-soft text-warning-foreground")}
      data-testid="pos-register-pill"
    >
      <span className={cn("size-2 rounded-full", shift ? "bg-success animate-pulse" : "bg-warning")} />
      {registerName} · {shift ? `open since ${formatTime(shift.openedAt)}` : "closed"}
    </Link>
  );
}

export default function PosLayout({ children }: { children: React.ReactNode }) {
  const canDashboard = useCan("dashboard.view");
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:h-16 sm:gap-3 sm:px-4">
        <Tooltip content={canDashboard ? "Back to dashboard" : "Sales history"}>
          <Button asChild variant="ghost" size="icon" aria-label={canDashboard ? "Back to dashboard" : "Sales history"}>
            <Link href={canDashboard ? "/dashboard" : "/sales"}>{canDashboard ? <ArrowLeft className="size-[18px]" /> : <Receipt className="size-[18px]" />}</Link>
          </Button>
        </Tooltip>
        <BrandMark className="hidden size-8 sm:flex" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15px] font-semibold tracking-tight">POS Terminal</p>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">FreshMart Grocery checkout</p>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <RegisterPill />
          <ConnectionStatus />
          <Clock />
          <ShortcutHelp />
          <ThemeToggle />
          <NotificationBell />
          <UserMenu compact />
        </div>
      </header>
      <AuthGuard>{children}</AuthGuard>
      <CommandPalette />
    </div>
  );
}
