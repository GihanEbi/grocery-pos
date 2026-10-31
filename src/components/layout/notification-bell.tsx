"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CalendarClock, CheckCheck, CheckCircle2, ClipboardList, Info, Sparkles } from "lucide-react";
import type { AppNotification, NotificationType } from "@/types";
import { useAppStore } from "@/store/app-store";
import { timeAgo } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

export const NOTIFICATION_STYLE: Record<NotificationType, { icon: typeof Bell; className: string; label: string }> = {
  low_stock: { icon: AlertTriangle, className: "bg-warning-soft text-warning-foreground", label: "Low stock" },
  expiry: { icon: CalendarClock, className: "bg-destructive-soft text-destructive-foreground", label: "Expiry" },
  purchase: { icon: ClipboardList, className: "bg-info-soft text-info-foreground", label: "Purchasing" },
  success: { icon: CheckCircle2, className: "bg-success-soft text-success-foreground", label: "Success" },
  ai_insight: { icon: Sparkles, className: "bg-primary-soft text-primary-soft-foreground", label: "AI insight" },
  system: { icon: Info, className: "bg-secondary text-secondary-foreground", label: "System" },
};

export function NotificationItem({ n, onOpen, compact }: { n: AppNotification; onOpen: (n: AppNotification) => void; compact?: boolean }) {
  const style = NOTIFICATION_STYLE[n.type];
  return (
    <button type="button" onClick={() => onOpen(n)} className={cn("flex w-full gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-accent", !n.read && "bg-primary-soft/30")}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", style.className)}><style.icon className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-[13px] leading-snug", !n.read ? "font-semibold" : "font-medium")}>{n.title}</span>
          {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        </span>
        <span className={cn("mt-0.5 block text-xs text-muted-foreground", compact && "line-clamp-2")}>{n.message}</span>
        <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
      </span>
    </button>
  );
}

export function NotificationBell() {
  const notifications = useAppStore((s) => s.notifications);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAll = useAppStore((s) => s.markAllNotificationsRead);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  const openNotification = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`} data-testid="notification-bell">
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9.5px] font-bold leading-4 text-white ring-2 ring-background">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(380px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread ? `${unread} unread` : "You're all caught up"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={!unread}><CheckCheck />Mark all read</Button>
        </div>
        <div className="max-h-[min(420px,60dvh)] space-y-0.5 overflow-y-auto p-1.5 scrollbar-thin">
          {notifications.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            notifications.slice(0, 8).map((n) => <NotificationItem key={n.id} n={n} onOpen={openNotification} compact />)
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}><Link href="/notifications">View all notifications</Link></Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
