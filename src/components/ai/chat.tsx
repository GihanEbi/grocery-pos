"use client";
import * as React from "react";
import { ArrowUp, Boxes, LineChart, Sparkles, Trash2, Wallet } from "lucide-react";
import { useAssistant } from "@/features/ai/use-assistant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DemoBadge } from "@/components/shared/demo-badge";
import { ChatMessage, TypingIndicator } from "./chat-message";

export const SUGGESTION_GROUPS = [
  { label: "Sales", icon: LineChart, questions: ["How much did we sell today?", "Compare this week's sales with last week", "What are the top-selling products?"] },
  { label: "Inventory", icon: Boxes, questions: ["What should I reorder?", "Which products are low on stock?", "Which products will expire soon?"] },
  { label: "Profit", icon: Wallet, questions: ["How much gross profit did we make?", "Which products have the highest profit margin?"] },
] as const;

export const DEMO_DISCLAIMER = "Simulated demo assistant — answers are computed from your demo data, no AI service is called.";

export function AssistantDemoNote({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground", className)}>
      <DemoBadge label="Demo" className="shrink-0" />
      <span>{DEMO_DISCLAIMER}</span>
    </p>
  );
}

export function ClearConversationButton({ size = "sm", className }: { size?: "sm" | "icon-sm"; className?: string }) {
  const { messages, pending, clear } = useAssistant();
  const confirm = useConfirm();
  return (
    <Button
      variant="ghost"
      size={size}
      className={className}
      disabled={!messages.length || pending}
      data-testid="ai-clear"
      aria-label="Clear conversation"
      onClick={async () => {
        if (await confirm({ title: "Clear this conversation?", description: "The demo chat history stored in this browser will be removed. Your store data is not affected.", confirmLabel: "Clear conversation", tone: "destructive" })) clear();
      }}
    >
      <Trash2 />
      {size === "sm" && "Clear"}
    </Button>
  );
}

/** Chat thread + composer. `page` shows the full hero empty state; `compact` is for the side sheet. */
export function AiChat({ variant = "page", onNavigate, className }: { variant?: "page" | "compact"; onNavigate?: () => void; className?: string }) {
  const { messages, pending, ask } = useAssistant();
  const [value, setValue] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const mountedAt = React.useRef(new Date().toISOString());
  const compact = variant === "compact";

  // While thinking, follow the bottom. When an answer arrives, align the question
  // that produced it with the top so long answers are read from the start.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    if (!pending && last?.role === "assistant") {
      const questions = el.querySelectorAll<HTMLElement>('[data-testid="ai-user-message"]');
      const q = questions[questions.length - 1];
      if (q) {
        const top = q.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 16;
        el.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return;
      }
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = (q: string) => {
    const text = q.trim();
    if (!text || pending) return;
    setValue("");
    void ask(text);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-y-auto scrollbar-thin", compact ? "px-4 py-4" : "px-4 py-5 sm:px-6")} data-testid="ai-thread">
        {messages.length === 0 && !pending ? (
          <EmptyChat compact={compact} onAsk={send} />
        ) : (
          <div className={cn("mx-auto space-y-5", !compact && "max-w-3xl")}>
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} animate={m.createdAt >= mountedAt.current} compact={compact} onFollowUp={send} onNavigate={onNavigate} disabled={pending} />
            ))}
            {pending && <TypingIndicator />}
          </div>
        )}
      </div>
      <div className={cn("border-t bg-card/80 backdrop-blur", compact ? "p-3" : "p-3 sm:p-4")}>
        <form
          className={cn("mx-auto flex items-end gap-2 rounded-xl border bg-background p-1.5 shadow-soft transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15", !compact && "max-w-3xl")}
          onSubmit={(e) => {
            e.preventDefault();
            send(value);
          }}
        >
          <label htmlFor={`ai-input-${variant}`} className="sr-only">Ask the assistant</label>
          <textarea
            id={`ai-input-${variant}`}
            ref={inputRef}
            rows={1}
            value={value}
            maxLength={300}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(value);
              }
            }}
            placeholder="Ask about sales, stock, profit or reordering…"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground/70 field-sizing-content"
            data-testid="ai-input"
          />
          <Button type="submit" size="icon" className="rounded-lg" disabled={!value.trim() || pending} aria-label="Send question" data-testid="ai-send">
            <ArrowUp />
          </Button>
        </form>
        <p className={cn("mx-auto mt-2 text-center text-[11px] text-muted-foreground", !compact && "max-w-3xl")}>{DEMO_DISCLAIMER}</p>
      </div>
    </div>
  );
}

function EmptyChat({ compact, onAsk }: { compact?: boolean; onAsk: (q: string) => void }) {
  return (
    <div className={cn("mx-auto flex flex-col items-center text-center", compact ? "max-w-sm pt-4" : "max-w-2xl pt-6 sm:pt-12")}>
      <div className="relative">
        <div className="absolute inset-0 -m-4 rounded-full bg-primary/15 blur-2xl" />
        <span className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.62_0.11_195)] text-primary-foreground shadow-elevated">
          <Sparkles className="size-6" />
        </span>
      </div>
      <h2 className={cn("mt-5 font-semibold tracking-tight", compact ? "text-lg" : "text-xl sm:text-2xl")}>Ask anything about your store</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">Sales, stock, expiry, profit and reordering — answered instantly from your FreshMart data, with tables, charts and next steps.</p>
      <div className={cn("mt-6 grid w-full gap-4 text-left", !compact && "sm:grid-cols-3")}>
        {SUGGESTION_GROUPS.map((g) => (
          <div key={g.label} className="space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <g.icon className="size-3.5" />
              {g.label}
            </p>
            <div className="flex flex-col gap-1.5">
              {(compact ? g.questions.slice(0, 2) : g.questions).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onAsk(q)}
                  data-testid="ai-suggestion"
                  className="rounded-lg border bg-card px-3 py-2 text-left text-[13px] leading-snug shadow-soft transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-primary-soft/40 hover:shadow-elevated"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
