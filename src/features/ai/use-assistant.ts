"use client";

import { useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import { useAuthStore } from "@/store/auth-store";
import { uid } from "@/lib/utils";
import type { AppData } from "@/types/data";
import { useAiStore } from "./ai-store";
import { getAiProvider, type AiContext } from "./provider";

/** Read-only snapshot of the persisted dataset (actions stripped). */
export function snapshotData(): AppData {
  const s = useAppStore.getState();
  return {
    users: s.users,
    categories: s.categories,
    products: s.products,
    batches: s.batches,
    movements: s.movements,
    suppliers: s.suppliers,
    purchaseOrders: s.purchaseOrders,
    customers: s.customers,
    sales: s.sales,
    returns: s.returns,
    expenses: s.expenses,
    shifts: s.shifts,
    notifications: s.notifications,
    heldBills: s.heldBills,
    settings: s.settings,
    meta: s.meta,
  };
}

export function buildAiContext(): AiContext {
  const data = snapshotData();
  const userId = useAuthStore.getState().userId;
  const user = data.users.find((u) => u.id === userId);
  return { data, now: new Date(), role: user?.role ?? "cashier", userName: user?.name.split(" ")[0] };
}

/** Sends a question to the active provider and records both sides in the shared chat store. */
export async function askAssistant(question: string): Promise<void> {
  const q = question.trim();
  const store = useAiStore.getState();
  if (!q || store.pending) return;
  store.push({ id: uid("msg"), role: "user", content: q, createdAt: new Date().toISOString() });
  store.setPending(true);
  try {
    const provider = await getAiProvider();
    const response = await provider.ask(q, buildAiContext());
    useAiStore.getState().push({ id: uid("msg"), role: "assistant", content: response.text, createdAt: new Date().toISOString(), response });
  } catch {
    useAiStore.getState().push({
      id: uid("msg"),
      role: "assistant",
      content: "Sorry — something went wrong while calculating that answer. Please try again.",
      createdAt: new Date().toISOString(),
      response: { intent: "fallback", text: "Sorry — something went wrong while calculating that answer. Please try again.", blocks: [], actions: [], followUps: ["What can you do?"] },
    });
  } finally {
    useAiStore.getState().setPending(false);
  }
}

export function useAssistant() {
  const messages = useAiStore((s) => s.messages);
  const pending = useAiStore((s) => s.pending);
  const clear = useAiStore((s) => s.clear);
  const ask = useCallback((q: string) => askAssistant(q), []);
  return { messages, pending, ask, clear };
}
