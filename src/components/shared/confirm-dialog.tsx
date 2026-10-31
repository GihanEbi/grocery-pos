"use client";
import * as React from "react";
import { create } from "zustand";
import { AlertTriangle, Info } from "lucide-react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((v: boolean) => void) | null;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  settle: (v: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolve: null,
  ask: (options) => new Promise<boolean>((resolve) => set({ open: true, options, resolve })),
  settle: (v) => {
    get().resolve?.(v);
    set({ open: false, resolve: null });
  },
}));

/**
 * Promise-based confirmation dialog, used instead of window.confirm().
 * `if (await confirm({ title: "Delete?" })) { ... }`
 */
export function useConfirm() {
  return useConfirmStore((s) => s.ask);
}

export function ConfirmDialogHost() {
  const { open, options, settle } = useConfirmStore();
  const destructive = options?.tone === "destructive";
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && settle(false)}>
      <AlertDialogContent>
        <div className="flex gap-4">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", destructive ? "bg-destructive-soft text-destructive-foreground" : "bg-primary-soft text-primary-soft-foreground")}>
            {destructive ? <AlertTriangle className="size-5" /> : <Info className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            {options?.description && <AlertDialogDescription asChild><div>{options.description}</div></AlertDialogDescription>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel onClick={() => settle(false)}>{options?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => settle(true)} data-testid="confirm-action" autoFocus>
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
