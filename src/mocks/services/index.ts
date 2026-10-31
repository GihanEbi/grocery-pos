"use client";

import type { Result } from "@/types";
import { sleep } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

/**
 * Simulated API layer. Each call waits a short, realistic delay and then runs
 * the business rule against the shared store. Swap these implementations for
 * real `fetch` calls when a backend exists — the UI only depends on this shape.
 */
const latency = (ms = 350) => sleep(ms + Math.round(Math.random() * 150));
const store = () => useAppStore.getState();

async function call<T>(fn: () => Result<T>, ms?: number): Promise<Result<T>> {
  await latency(ms);
  try {
    return fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

type Args<K extends keyof ReturnType<typeof store>> = ReturnType<typeof store>[K] extends (...a: infer A) => unknown ? A : never;

export const api = {
  products: {
    create: (...a: Args<"addProduct">) => call(() => store().addProduct(...a)),
    update: (...a: Args<"updateProduct">) => call(() => store().updateProduct(...a)),
    archive: (...a: Args<"archiveProduct">) => call(() => store().archiveProduct(...a)),
    restore: (...a: Args<"restoreProduct">) => call(() => store().restoreProduct(...a)),
  },
  inventory: {
    adjust: (...a: Args<"adjustStock">) => call(() => store().adjustStock(...a)),
    writeOffBatch: (...a: Args<"writeOffBatch">) => call(() => store().writeOffBatch(...a)),
  },
  suppliers: {
    create: (...a: Args<"addSupplier">) => call(() => store().addSupplier(...a)),
    update: (...a: Args<"updateSupplier">) => call(() => store().updateSupplier(...a)),
  },
  purchasing: {
    create: (...a: Args<"createPurchaseOrder">) => call(() => store().createPurchaseOrder(...a)),
    update: (...a: Args<"updatePurchaseOrder">) => call(() => store().updatePurchaseOrder(...a)),
    approve: (...a: Args<"approvePurchaseOrder">) => call(() => store().approvePurchaseOrder(...a)),
    cancel: (...a: Args<"cancelPurchaseOrder">) => call(() => store().cancelPurchaseOrder(...a)),
    receive: (...a: Args<"receivePurchaseOrder">) => call(() => store().receivePurchaseOrder(...a), 600),
  },
  customers: {
    create: (...a: Args<"addCustomer">) => call(() => store().addCustomer(...a)),
    update: (...a: Args<"updateCustomer">) => call(() => store().updateCustomer(...a)),
  },
  sales: {
    /** Card/QR payments get a longer "authorisation" delay to feel real. */
    complete: (...a: Args<"completeSale">) => call(() => store().completeSale(...a), a[0].payments.some((p) => p.method !== "cash" && p.amount > 0) ? 1100 : 450),
    processReturn: (...a: Args<"processReturn">) => call(() => store().processReturn(...a), 600),
  },
  expenses: {
    create: (...a: Args<"addExpense">) => call(() => store().addExpense(...a)),
    update: (...a: Args<"updateExpense">) => call(() => store().updateExpense(...a)),
    remove: (...a: Args<"deleteExpense">) => call(() => store().deleteExpense(...a)),
  },
  shifts: {
    open: (...a: Args<"openShift">) => call(() => store().openShift(...a)),
    close: (...a: Args<"closeShift">) => call(() => store().closeShift(...a)),
    adjust: (...a: Args<"addCashAdjustment">) => call(() => store().addCashAdjustment(...a)),
  },
  users: {
    create: (...a: Args<"addUser">) => call(() => store().addUser(...a)),
    update: (...a: Args<"updateUser">) => call(() => store().updateUser(...a)),
  },
  sync: {
    pushPending: () => call(() => store().syncPendingSales(), 1400),
  },
  demo: {
    reset: async () => {
      await latency(700);
      store().resetDemoData();
      return { ok: true as const, data: undefined };
    },
  },
};
