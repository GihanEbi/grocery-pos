"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2, Sparkles, X } from "lucide-react";
import { useCan } from "@/hooks";
import { useAiStore } from "@/features/ai/ai-store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { DemoBadge } from "@/components/shared/demo-badge";
import { AiChat, ClearConversationButton } from "./chat";
import { AssistantAvatar } from "./chat-message";

/**
 * Floating assistant button (bottom-right) on management pages. Opens a side sheet
 * with a compact chat that shares its history with the full /ai-assistant page.
 */
export function AssistantLauncher() {
  const pathname = usePathname();
  const allowed = useCan("ai.use");
  const pending = useAiStore((s) => s.pending);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  if (!allowed || pathname.startsWith("/ai-assistant")) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Tooltip content="Ask the AI assistant" side="left">
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="assistant-launcher"
          aria-label="Open AI assistant"
          className="no-print fixed bottom-5 right-5 z-40 flex size-13 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.62_0.11_195)] text-primary-foreground shadow-elevated ring-4 ring-background transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:size-14"
        >
          <Sparkles className="size-5 sm:size-6" />
          {pending && <span className="absolute right-0.5 top-0.5 size-3 animate-pulse rounded-full bg-warning ring-2 ring-background" />}
        </button>
      </Tooltip>
      <SheetContent side="right" size="lg" hideClose className="p-0" aria-describedby="assistant-sheet-desc">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <AssistantAvatar className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle>AI Assistant</SheetTitle>
              <DemoBadge label="Simulated" />
            </div>
            <SheetDescription id="assistant-sheet-desc" className="truncate text-xs">Answers computed from your demo data</SheetDescription>
          </div>
          <ClearConversationButton size="icon-sm" />
          <Tooltip content="Open full assistant">
            <Button asChild variant="ghost" size="icon-sm">
              <Link href="/ai-assistant" aria-label="Open full assistant" data-testid="assistant-open-full">
                <Maximize2 />
              </Link>
            </Button>
          </Tooltip>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close assistant">
            <X />
          </Button>
        </div>
        <AiChat variant="compact" onNavigate={() => setOpen(false)} className="flex-1" />
        <div className="border-t px-4 py-2 text-center">
          <Link href="/ai-assistant" className="text-xs font-medium text-primary hover:underline">
            Open full assistant →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
