import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_2px_6px_-1px_color-mix(in_oklch,var(--primary)_50%,transparent)]", className)}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h2l1.6 8.2a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.1L20 10H7" />
        <path d="M13 4.5c1.2-1.4 3-1.6 4-1-0.2 1.6-1.6 2.8-3.4 2.8" />
        <circle cx="9.5" cy="20" r="1" fill="currentColor" />
        <circle cx="16.5" cy="20" r="1" fill="currentColor" />
      </svg>
    </span>
  );
}

export function BrandName({ shopName }: { shopName?: string }) {
  return (
    <div className="min-w-0 leading-tight">
      <p className="truncate text-[15px] font-semibold tracking-tight">FreshMart<span className="text-primary"> POS</span></p>
      {shopName && <p className="truncate text-[11px] text-muted-foreground">{shopName}</p>}
    </div>
  );
}
