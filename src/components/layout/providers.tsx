"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmDialogHost } from "@/components/shared/confirm-dialog";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import { useUiStore } from "@/store/ui-store";
import { useAiStore } from "@/features/ai/ai-store";

/** Loads persisted demo data from browser storage (seeding it on first run) before rendering. */
function StoreHydrator({ children }: { children: React.ReactNode }) {
  const hydrated = useAppStore((s) => s.hydrated);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await useAppStore.persist.rehydrate();
      await Promise.all([useAuthStore.persist.rehydrate(), useCartStore.persist.rehydrate(), useUiStore.persist.rehydrate(), useAiStore.persist.rehydrate()]);
      if (cancelled) return;
      const s = useAppStore.getState();
      s.ensureSeeded();
      s.scanConditions();
      s._setHydrated();
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!hydrated) return <BootScreen />;
  return <>{children}</>;
}

function BootScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex size-12 items-center justify-center rounded-2xl bg-primary text-xl text-primary-foreground shadow-elevated animate-pulse-ring">🛒</div>
        <p className="text-sm text-muted-foreground">Loading FreshMart POS…</p>
      </div>
    </div>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={(resolvedTheme as "light" | "dark") ?? "light"} position="top-right" richColors closeButton toastOptions={{ className: "!rounded-xl" }} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="freshmart-theme">
      <TooltipProvider delayDuration={250}>
        <StoreHydrator>{children}</StoreHydrator>
        <ConfirmDialogHost />
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
