"use client";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = "top", disabled }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left"; disabled?: boolean }) {
  if (disabled) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className={cn("z-[70] max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md animate-fade-in")}>
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
