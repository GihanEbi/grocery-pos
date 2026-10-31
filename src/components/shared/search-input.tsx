"use client";
import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const SearchInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void; kbd?: string }>(
  ({ value, onChange, className, kbd, ...props }, ref) => (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className="pl-9 pr-9" type="search" {...props} />
      {value ? (
        <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      ) : kbd ? (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{kbd}</kbd>
      ) : null}
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
