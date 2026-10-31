"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, CornerDownRight, Sparkles } from "lucide-react";
import type { AiMessage } from "@/features/ai/types";
import { formatTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { AiBlocks } from "./ai-blocks";
import { RichText } from "./rich-text";

export function AssistantAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.62_0.11_195)] text-primary-foreground shadow-soft ring-2 ring-card", className)} aria-hidden>
      <Sparkles className="size-4" />
    </span>
  );
}

export function ChatMessage({ message, animate, compact, onFollowUp, onNavigate, disabled }: { message: AiMessage; animate?: boolean; compact?: boolean; onFollowUp: (q: string) => void; onNavigate?: () => void; disabled?: boolean }) {
  const user = useCurrentUser();
  const isUser = message.role === "user";
  const r = message.response;

  return (
    <motion.div initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }} className={cn("flex gap-2.5", isUser && "flex-row-reverse")} data-testid={isUser ? "ai-user-message" : "ai-message"}>
      {isUser ? <UserAvatar name={user?.name ?? "You"} color={user?.avatarColor} className="size-8" /> : <AssistantAvatar />}
      {isUser ? (
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="rounded-2xl rounded-tr-md bg-primary px-3.5 py-2 text-[13.5px] leading-relaxed text-primary-foreground shadow-soft">{message.content}</div>
          <p className="mt-1 text-right text-[10.5px] text-muted-foreground">{formatTime(message.createdAt)}</p>
        </div>
      ) : (
        <div className="min-w-0 flex-1 space-y-3">
          <div className="rounded-2xl rounded-tl-md border bg-card px-3.5 py-2.5 text-[13.5px] leading-relaxed text-foreground/90 shadow-soft">
            <RichText text={r?.text ?? message.content} />
          </div>
          {r && <AiBlocks blocks={r.blocks} compact={compact} />}
          {r && r.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.actions.map((a) => (
                <Button key={a.href + a.label} asChild size="sm" variant={a.variant === "outline" ? "outline" : "soft"}>
                  <Link href={a.href} onClick={onNavigate} data-testid="ai-action">
                    {a.label}
                    <ArrowRight />
                  </Link>
                </Button>
              ))}
            </div>
          )}
          {r && r.followUps.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.followUps.map((f) => (
                <button key={f} type="button" disabled={disabled} onClick={() => onFollowUp(f)} data-testid="ai-followup" className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/50 hover:text-primary-soft-foreground disabled:pointer-events-none disabled:opacity-50">
                  <CornerDownRight className="size-3 shrink-0" />
                  {f}
                </button>
              ))}
            </div>
          )}
          <p className="text-[10.5px] text-muted-foreground">{formatTime(message.createdAt)} · computed from demo data</p>
        </div>
      )}
    </motion.div>
  );
}

export function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5" data-testid="ai-typing" role="status" aria-live="polite">
      <AssistantAvatar />
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border bg-card px-3.5 py-2.5 shadow-soft">
        <span className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span key={d} className="size-1.5 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        <span className="text-xs text-muted-foreground">Analysing your store data…</span>
      </div>
    </motion.div>
  );
}
