"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, ClipboardList, Database, HardDrive, History, Package, Receipt, RotateCcw, Users } from "lucide-react";
import { api } from "@/mocks/services";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import { useAiStore } from "@/features/ai/ai-store";
import { STORAGE_KEY } from "@/config/defaults";
import { formatDateTime, formatNumber } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DemoBadge } from "@/components/shared/demo-badge";
import { SettingsSection } from "./settings-section";

const STORAGE_ROWS = [
  { key: STORAGE_KEY, label: "Business data", detail: "Products, stock, batches, sales, returns, customers, suppliers, purchase orders, expenses, shifts, notifications and settings." },
  { key: "freshmart-pos-auth", label: "Demo session", detail: "Signed-in user (sessionStorage when “remember me” is off)." },
  { key: "freshmart-pos-cart", label: "POS cart", detail: "The bill currently being rung up." },
  { key: "freshmart-pos-ai", label: "Assistant chat", detail: "Simulated AI conversation history." },
  { key: "freshmart-pos-ui", label: "Interface", detail: "Sidebar and layout preferences." },
  { key: "freshmart-theme", label: "Theme", detail: "Light / dark / system choice." },
];

function storageSize(key: string): number | null {
  try {
    const v = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    return v === null ? null : new Blob([v]).size;
  } catch {
    return null;
  }
}

const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 102_400 ? 1 : 0)} KB`);

export function DemoDataSettings() {
  const router = useRouter();
  const confirm = useConfirm();
  const products = useAppStore((s) => s.products.length);
  const sales = useAppStore((s) => s.sales.length);
  const customers = useAppStore((s) => s.customers.length);
  const purchaseOrders = useAppStore((s) => s.purchaseOrders.length);
  const movements = useAppStore((s) => s.movements.length);
  const demoDate = useAppStore((s) => s.meta?.demoDate);
  const [resetting, setResetting] = React.useState(false);
  const [sizes, setSizes] = React.useState<Record<string, number | null>>({});

  React.useEffect(() => {
    setSizes(Object.fromEntries(STORAGE_ROWS.map((r) => [r.key, storageSize(r.key)])));
  }, [products, sales, customers, purchaseOrders, movements, resetting]);

  const stats = [
    { label: "Products", value: products, icon: Package },
    { label: "Sales", value: sales, icon: Receipt },
    { label: "Customers", value: customers, icon: Users },
    { label: "Purchase orders", value: purchaseOrders, icon: ClipboardList },
    { label: "Stock movements", value: movements, icon: History },
  ];

  const reset = async () => {
    const ok = await confirm({
      title: "Reset all demo data?",
      description: (
        <div className="space-y-2">
          <p>This restores the original sample catalog, sales history, customers and settings. Everything you created or changed in this browser will be lost, and the POS cart and assistant chat will be cleared.</p>
          <p className="font-medium text-foreground">This cannot be undone.</p>
        </div>
      ),
      confirmLabel: "Reset demo data",
      tone: "destructive",
    });
    if (!ok) return;
    setResetting(true);
    const r = await api.demo.reset();
    setResetting(false);
    if (!r.ok) return toast.error("Could not reset the demo data.");
    useCartStore.getState().clear();
    useAiStore.getState().clear();
    const userId = useAuthStore.getState().userId;
    const stillExists = useAppStore.getState().users.some((u) => u.id === userId && u.active);
    toast.success("Demo data restored to the initial sample set");
    if (!stillExists) {
      useAuthStore.getState().logout();
      router.replace("/login");
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Demo data"
        description={<>Everything in this prototype runs in your browser — there is no server. <DemoBadge className="ml-1 align-middle" /></>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-muted/30 px-3 py-2.5" data-testid="demo-count">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <s.icon className="size-3.5" />
                {s.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular">{formatNumber(s.value)}</p>
            </div>
          ))}
        </div>
        {demoDate && <p className="mt-3 text-xs text-muted-foreground">Sample data generated relative to {formatDateTime(demoDate)}.</p>}

        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold"><HardDrive className="size-4 text-muted-foreground" />What is stored where</p>
          <div className="overflow-hidden rounded-lg border">
            <ul className="divide-y">
              {STORAGE_ROWS.map((r) => (
                <li key={r.key} className="flex flex-col gap-1 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{r.key}</code>
                    <span className="w-16 text-right tabular text-muted-foreground">{sizes[r.key] == null ? "—" : kb(sizes[r.key]!)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Clearing your browser&apos;s site data has the same effect as a reset.</p>
        </div>
      </SettingsSection>

      <section className="overflow-hidden rounded-xl border border-destructive/30 bg-card shadow-soft">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive-soft text-destructive-foreground">
              <Database className="size-5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Reset demo data</h2>
              <p className="mt-0.5 max-w-xl text-[13px] text-muted-foreground">Restore the initial sample data set: the grocery catalog with stock and batches, six weeks of sales, customers, suppliers, purchase orders and default settings.</p>
            </div>
          </div>
          <Button variant="destructive" onClick={reset} loading={resetting} data-testid="reset-demo-data" className="shrink-0">
            {!resetting && <RotateCcw />}
            Reset demo data
          </Button>
        </div>
        <div className="flex items-center gap-2 border-t bg-destructive-soft/30 px-5 py-2.5 text-xs text-muted-foreground">
          <Boxes className="size-3.5" /> Your theme choice is kept. You stay signed in if your demo account still exists after the reset.
        </div>
      </section>
    </div>
  );
}
