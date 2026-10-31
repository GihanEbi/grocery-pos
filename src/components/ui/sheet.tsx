"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Side drawer built on Radix Dialog. */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({ className, children, side = "right", size = "md", hideClose, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right"; size?: "sm" | "md" | "lg" | "xl"; hideClose?: boolean }) {
  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-xl", xl: "sm:max-w-3xl" };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full flex-col bg-card shadow-elevated outline-none transition-transform duration-300",
          side === "right" ? "right-0 border-l data-[state=open]:animate-[slide-in-right_0.25s_ease-out]" : "left-0 border-r data-[state=open]:animate-[slide-in-left_0.25s_ease-out]",
          widths[size],
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-3.5 top-3.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 border-b px-5 py-4 pr-12", className)} {...props} />;
}
export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4 scrollbar-thin", className)} {...props} />;
}
export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex gap-2 border-t bg-muted/30 px-5 py-3 justify-end", className)} {...props} />;
}
export const SheetTitle = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn("text-base font-semibold tracking-tight", className)} {...props} />
);
export const SheetDescription = ({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description className={cn("text-[13px] text-muted-foreground", className)} {...props} />
);
