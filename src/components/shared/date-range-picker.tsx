"use client";
import * as React from "react";
import { endOfDay, format, startOfDay } from "date-fns";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RANGE_PRESETS, rangeFromPreset, type DateRange, type RangePreset } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export interface RangeValue {
  preset: RangePreset | "custom";
  range: DateRange;
}

export function useRangeState(initial: RangePreset = "last7") {
  return React.useState<RangeValue>(() => ({ preset: initial, range: rangeFromPreset(initial) }));
}

export function rangeLabel(v: RangeValue) {
  if (v.preset !== "custom") return RANGE_PRESETS.find((p) => p.value === v.preset)?.label ?? "";
  return `${format(v.range.from, "dd MMM")} – ${format(v.range.to, "dd MMM yyyy")}`;
}

/** Date range selector with presets and a custom from/to range. */
export function DateRangePicker({ value, onChange, presets = RANGE_PRESETS.map((p) => p.value), className, align = "end" }: { value: RangeValue; onChange: (v: RangeValue) => void; presets?: RangePreset[]; className?: string; align?: "start" | "end" }) {
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(format(value.range.from, "yyyy-MM-dd"));
  const [to, setTo] = React.useState(format(value.range.to, "yyyy-MM-dd"));
  const invalid = !from || !to || from > to;

  React.useEffect(() => {
    if (open) {
      setFrom(format(value.range.from, "yyyy-MM-dd"));
      setTo(format(value.range.to, "yyyy-MM-dd"));
    }
  }, [open, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-between gap-2 font-normal", className)} data-testid="date-range-trigger">
          <CalendarRange className="text-muted-foreground" />
          <span className="truncate">{rangeLabel(value)}</span>
          <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(340px,calc(100vw-2rem))] p-0">
        <div className="grid grid-cols-2 gap-1 p-2">
          {RANGE_PRESETS.filter((p) => presets.includes(p.value)).map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                onChange({ preset: p.value, range: rangeFromPreset(p.value) });
                setOpen(false);
              }}
              className={cn("rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent", value.preset === p.value && "bg-primary-soft font-medium text-primary-soft-foreground")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-3 border-t p-3">
          <p className="text-xs font-medium text-muted-foreground">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label htmlFor="dr-from" className="text-xs">From</Label><Input id="dr-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="dr-to" className="text-xs">To</Label><Input id="dr-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
          {invalid && <p className="text-xs text-destructive-foreground">Start date must be before end date.</p>}
          <Button
            size="sm"
            className="w-full"
            disabled={invalid}
            onClick={() => {
              onChange({ preset: "custom", range: { from: startOfDay(new Date(from + "T00:00")), to: endOfDay(new Date(to + "T00:00")) } });
              setOpen(false);
            }}
          >
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
