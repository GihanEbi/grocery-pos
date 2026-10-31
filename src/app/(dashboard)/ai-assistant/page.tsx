"use client";
import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { askAssistant } from "@/features/ai/use-assistant";
import { PageHeader } from "@/components/shared/page-header";
import { DemoBadge } from "@/components/shared/demo-badge";
import { Card } from "@/components/ui/card";
import { AiChat, ClearConversationButton } from "@/components/ai/chat";
import { AiDailySummary, AiInsightCards, AiReorderCard } from "@/components/ai/insight-cards";

/** Module-level guard so React Strict Mode's double effect (or a remount) never asks the same ?q= twice. */
let lastAutoAsk: { q: string; at: number } | null = null;

function AutoAsk() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q");

  React.useEffect(() => {
    if (!q) return;
    const now = Date.now();
    if (lastAutoAsk && lastAutoAsk.q === q && now - lastAutoAsk.at < 4000) return;
    lastAutoAsk = { q, at: now };
    void askAssistant(q);
    // Drop ?q= so a reload doesn't ask again.
    router.replace("/ai-assistant", { scroll: false });
  }, [q, router]);

  return null;
}

export default function AiAssistantPage() {
  const chatRef = React.useRef<HTMLDivElement>(null);

  return (
    <div>
      <Suspense fallback={null}>
        <AutoAsk />
      </Suspense>
      <PageHeader
        title="AI Assistant"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <DemoBadge label="Simulated demo assistant" />
            <span className="hidden sm:inline">Answers are computed from your demo data — no AI service is called.</span>
          </span>
        }
        actions={<ClearConversationButton />}
        className="mb-4"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div ref={chatRef} className="scroll-mt-20">
          <Card className="flex h-[calc(100dvh-13rem)] min-h-[520px] flex-col overflow-hidden xl:h-[calc(100dvh-12rem)]">
            <AiChat variant="page" className="flex-1" />
          </Card>
        </div>
        <aside className="space-y-5 xl:max-h-[calc(100dvh-12rem)] xl:overflow-y-auto xl:pr-1 scrollbar-thin" aria-label="AI insights">
          <AiDailySummary />
          <AiReorderCard onAsk={() => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Business insights</h2>
              <span className="text-[11px] text-muted-foreground">Updated live from demo data</span>
            </div>
            <AiInsightCards />
          </section>
        </aside>
      </div>
    </div>
  );
}
