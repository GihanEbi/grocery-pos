"use client";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useOnlineStatus } from "@/hooks";
import { api } from "@/mocks/services";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DemoBadge } from "@/components/shared/demo-badge";
import { formatRelative } from "@/lib/formatting";
import { cn } from "@/lib/utils";

/** Online/offline indicator with the simulated offline-mode toggle and manual sync. */
export function ConnectionStatus({ showLabel = true }: { showLabel?: boolean }) {
  const browserOnline = useOnlineStatus();
  const simulatedOffline = useAppStore((s) => s.meta.simulatedOffline);
  const lastSyncAt = useAppStore((s) => s.meta.lastSyncAt);
  const pending = useAppStore((s) => s.sales.filter((x) => !x.synced).length);
  const setOffline = useAppStore((s) => s.setSimulatedOffline);
  const [syncing, setSyncing] = useState(false);
  const offline = simulatedOffline || !browserOnline;

  const sync = async () => {
    setSyncing(true);
    const r = await api.sync.pushPending();
    setSyncing(false);
    if (r.ok) toast.success(r.data ? `Synced ${r.data} offline sale${r.data === 1 ? "" : "s"}` : "Everything is already in sync", { description: "Demo sync — data stays in this browser." });
    else toast.error(r.error);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn("flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors", offline ? "border-warning/40 bg-warning-soft text-warning-foreground" : "border-success/30 bg-success-soft/60 text-success-foreground hover:bg-success-soft")} data-testid="connection-status">
          {offline ? <CloudOff className="size-3.5" /> : <Wifi className="size-3.5" />}
          {showLabel && <span className="hidden sm:inline">{offline ? "Offline" : "Online"}</span>}
          {pending > 0 && <span className="rounded-full bg-warning px-1.5 text-[10px] font-bold leading-4 text-white">{pending}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Connection</p>
          <DemoBadge />
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="sim-offline" className="flex flex-col items-start gap-1">
              <span>Simulate offline mode</span>
              <span className="text-xs font-normal text-muted-foreground">Only cash sales are allowed; they queue for sync.</span>
            </Label>
            <Switch id="sim-offline" checked={simulatedOffline} onCheckedChange={(v) => { setOffline(v); toast(v ? "Offline mode simulated" : "Back online", { description: v ? "Card & QR payments are disabled." : pending ? `${pending} sale(s) waiting to sync.` : undefined }); }} data-testid="offline-toggle" />
          </div>
          {!browserOnline && <p className="text-xs text-warning-foreground">Your browser reports no network connection.</p>}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pending sync: <b className="text-foreground">{pending}</b></span>
            <span>Last sync: {lastSyncAt ? formatRelative(lastSyncAt) : "never"}</span>
          </div>
          <Button size="sm" variant="outline" className="w-full" onClick={sync} loading={syncing} disabled={offline}><RefreshCw />Sync now</Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">This is a single-browser simulation. No real multi-device synchronization is implemented.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
