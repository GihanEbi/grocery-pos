import { cn } from "@/lib/utils";

/** Card layout used by every settings panel: header, body and an optional sticky-ish footer. */
export function SettingsSection({ title, description, actions, children, footer, className }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-card shadow-soft", className)}>
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:items-center sm:justify-end">{footer}</div>}
    </section>
  );
}

export function UnsavedPill({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-warning-foreground">
      <span className="size-1.5 rounded-full bg-warning" />
      Unsaved changes
    </span>
  );
}
