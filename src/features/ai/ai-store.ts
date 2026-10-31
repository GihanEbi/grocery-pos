"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AiMessage } from "./types";

/** Demo conversation history for the simulated AI assistant (persisted locally). */
interface AiState {
  messages: AiMessage[];
  pending: boolean;
  push: (m: AiMessage) => void;
  setPending: (v: boolean) => void;
  clear: () => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      messages: [],
      pending: false,
      push: (m) => set((s) => ({ messages: [...s.messages, m].slice(-60) })),
      setPending: (pending) => set({ pending }),
      clear: () => set({ messages: [] }),
    }),
    { name: "freshmart-pos-ai", skipHydration: true, storage: createJSONStorage(() => localStorage), partialize: (s) => ({ messages: s.messages }) },
  ),
);
