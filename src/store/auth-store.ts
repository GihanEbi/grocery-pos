"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Result } from "@/types";
import { useAppStore } from "./app-store";

/**
 * SIMULATED authentication. Credentials are checked against the mock user list
 * in the browser. This is intentionally insecure and for demo purposes only.
 */
interface AuthState {
  userId: string | null;
  remember: boolean;
  login: (email: string, password: string, remember: boolean) => Result<{ userId: string }>;
  switchUser: (userId: string) => Result<{ userId: string }>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      remember: true,
      login: (email, password, remember) => {
        const user = useAppStore.getState().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user || user.password !== password) return { ok: false, error: "Incorrect email or password." };
        if (!user.active) return { ok: false, error: "This account has been deactivated. Ask an admin to reactivate it." };
        set({ userId: user.id, remember });
        return { ok: true, data: { userId: user.id } };
      },
      switchUser: (userId) => {
        const user = useAppStore.getState().users.find((u) => u.id === userId);
        if (!user || !user.active) return { ok: false, error: "That account is not available." };
        set({ userId });
        return { ok: true, data: { userId } };
      },
      logout: () => set({ userId: null }),
    }),
    {
      name: "freshmart-pos-auth",
      skipHydration: true,
      // "Remember demo session" off → keep the session in sessionStorage only.
      storage: createJSONStorage(() => ({
        getItem: (k) => localStorage.getItem(k) ?? sessionStorage.getItem(k),
        setItem: (k, v) => {
          const parsed = JSON.parse(v) as { state: { remember: boolean } };
          if (parsed.state.remember) {
            localStorage.setItem(k, v);
            sessionStorage.removeItem(k);
          } else {
            sessionStorage.setItem(k, v);
            localStorage.removeItem(k);
          }
        },
        removeItem: (k) => {
          localStorage.removeItem(k);
          sessionStorage.removeItem(k);
        },
      })),
      partialize: (s) => ({ userId: s.userId, remember: s.remember }),
    },
  ),
);

/** Current signed-in user (or null). */
export function useCurrentUser() {
  const userId = useAuthStore((s) => s.userId);
  return useAppStore((s) => (userId ? s.users.find((u) => u.id === userId) ?? null : null));
}
