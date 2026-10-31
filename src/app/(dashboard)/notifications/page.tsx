"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { isToday, isYesterday } from "date-fns";
import { ArrowUpRight, BellOff, Check, CheckCheck, MoreHorizontal, Trash2, Inbox } from "lucide-react";
import { toast } from "sonner";
import type { AppNotification, NotificationType } from "@/types";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NOTIFICATION_STYLE, NotificationItem } from "@/components/layout/notification-bell";

type FilterKey = "all" | "unread" | Extract<NotificationType, "low_stock" | "expiry" | "purchase" | "ai_insight" | "success">;

const FILTERS: { key: FilterKey; label: string; match: (n: AppNotification) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "unread", label: "Unread", match: (n) => !n.read },
  { key: "low_stock", label: "Low stock", match: (n) => n.type === "low_stock" },
  { key: "expiry", label: "Expiry", match: (n) => n.type === "expiry" },
  { key: "purchase", label: "Purchasing", match: (n) => n.type === "purchase" },
  { key: "ai_insight", label: "AI insights", match: (n) => n.type === "ai_insight" },
  { key: "success", label: "Success", match: (n) => n.type === "success" },
];

function groupLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return "Earlier";
}

export default function NotificationsPage() {
  const notifications = useAppStore((s) => s.notifications);
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAll = useAppStore((s) => s.markAllNotificationsRead);
  const remove = useAppStore((s) => s.removeNotification);
  const clearAll = useAppStore((s) => s.clearNotifications);
  const router = useRouter();
  const confirm = useConfirm();
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const unread = notifications.filter((n) => !n.read).length;
  const active = FILTERS.find((f) => f.key === filter)!;
  const sorted = React.useMemo(() => [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [notifications]);
  const visible = sorted.filter(active.match);
  const groups = React.useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    for (const n of visible) map.set(groupLabel(n.createdAt), [...(map.get(groupLabel(n.createdAt)) ?? []), n]);
    return [...map.entries()];
  }, [visible]);

  const open = (n: AppNotification) => {
    markRead(n.id);
    if (n.href) router.push(n.href);
  };

  return (
    <div className="mx-auto max-w-4xl pb-20">
      <PageHeader
        title="Notifications"
        description={notifications.length ? `${notifications.length} notification${notifications.length === 1 ? "" : "s"} · ${unread ? `${unread} unread` : "all caught up"}` : "Stock alerts, expiry warnings, purchasing updates and AI insights."}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!unread}
              onClick={() => {
                markAll();
                toast.success("All notifications marked as read");
              }}
              data-testid="notifications-mark-all"
            >
              <CheckCheck />
              Mark all as read
            </Button>
            <Button
              variant="destructive-outline"
              size="sm"
              disabled={!notifications.length}
              data-testid="notifications-clear"
              onClick={async () => {
                if (await confirm({ title: "Clear all notifications?", description: "This removes every notification from this browser. New alerts will still appear when stock or expiry conditions change.", confirmLabel: "Clear all", tone: "destructive" })) {
                  clearAll();
                  toast.success("Notifications cleared");
                }
              }}
            >
              <Trash2 />
              Clear all
            </Button>
          </>
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0" role="tablist" aria-label="Filter notifications">
        <div className="inline-flex gap-1.5">
          {FILTERS.map((f) => {
            const count = notifications.filter(f.match).length;
            const selected = f.key === filter;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.key)}
                data-testid={`notifications-filter-${f.key}`}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors",
                  selected ? "border-primary/30 bg-primary-soft text-primary-soft-foreground" : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {f.label}
                <span className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] tabular leading-5", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-soft" data-testid="notifications-list">
        {visible.length === 0 ? (
          notifications.length === 0 ? (
            <EmptyState icon={BellOff} title="No notifications" description="You're all caught up. Low-stock, expiry and purchasing alerts will appear here as they happen." />
          ) : (
            <EmptyState icon={Inbox} title={filter === "unread" ? "No unread notifications" : `No ${active.label.toLowerCase()} notifications`} description="Try another filter to see the rest of your notifications." action={<Button variant="outline" size="sm" onClick={() => setFilter("all")}>Show all</Button>} />
          )
        ) : (
          groups.map(([label, items]) => (
            <section key={label}>
              <h2 className="border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</h2>
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id} className="group flex items-start gap-1 px-2 py-1.5 sm:px-3" data-testid="notification-row">
                    <div className="min-w-0 flex-1">
                      <NotificationItem n={n} onOpen={open} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1 pt-2">
                      <span className="hidden rounded-full border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground md:inline">{NOTIFICATION_STYLE[n.type].label}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Notification actions" data-testid="notification-menu">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!n.read && (
                            <DropdownMenuItem onSelect={() => markRead(n.id)}>
                              <Check />
                              Mark as read
                            </DropdownMenuItem>
                          )}
                          {n.href && (
                            <DropdownMenuItem onSelect={() => open(n)}>
                              <ArrowUpRight />
                              Open related page
                            </DropdownMenuItem>
                          )}
                          {(!n.read || n.href) && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            destructive
                            onSelect={() => {
                              remove(n.id);
                              toast.success("Notification deleted");
                            }}
                            data-testid="notification-delete"
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
