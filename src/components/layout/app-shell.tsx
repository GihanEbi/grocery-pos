"use client";
import { AuthGuard } from "./auth-guard";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { AssistantLauncher } from "@/components/ai/assistant-launcher";

/** Shared layout for all management pages. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <MobileNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8" id="main">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
      <CommandPalette />
      <AssistantLauncher />
    </div>
  );
}
