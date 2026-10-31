"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Purely presentational preferences (sidebar, assistant panel). */
interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  assistantOpen: boolean;
  commandOpen: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  setMobileNavOpen: (v: boolean) => void;
  setAssistantOpen: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      assistantOpen: false,
      commandOpen: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setAssistantOpen: (assistantOpen) => set({ assistantOpen }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    {
      name: "freshmart-pos-ui",
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
