import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + control + inline validation message. */
export function FormField({ label, htmlFor, error, hint, required, className, children }: { label: string; htmlFor?: string; error?: string; hint?: React.ReactNode; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive-foreground">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive-foreground" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
