"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./settings-section";

const THEMES = [
  { value: "light", label: "Light", icon: Sun, description: "Bright and crisp for well-lit stores." },
  { value: "dark", label: "Dark", icon: Moon, description: "Easy on the eyes in the evening." },
  { value: "system", label: "System", icon: Monitor, description: "Follows your device setting." },
] as const;

/** Mini app mock-up drawn with fixed colors so each card previews its own theme. */
function Preview({ mode }: { mode: "light" | "dark" }) {
  const c =
    mode === "light"
      ? { bg: "#f7faf9", card: "#ffffff", side: "#ffffff", line: "#e5e9ef", text: "#cbd5e1", strong: "#334155", primary: "#10b981" }
      : { bg: "#0f141b", card: "#171d26", side: "#131921", line: "#273040", text: "#3a4555", strong: "#cbd5e1", primary: "#34d399" };
  return (
    <div className="flex h-full w-full" style={{ background: c.bg }}>
      <div className="flex w-[26%] flex-col gap-1.5 border-r p-2" style={{ background: c.side, borderColor: c.line }}>
        <span className="mb-1 h-2.5 w-2.5 rounded" style={{ background: c.primary }} />
        {[70, 55, 62, 48].map((w, i) => (
          <span key={i} className="h-1.5 rounded-full" style={{ width: `${w}%`, background: i === 1 ? c.primary : c.text, opacity: i === 1 ? 0.8 : 1 }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="h-1.5 w-1/3 rounded-full" style={{ background: c.strong }} />
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-5 rounded border" style={{ background: c.card, borderColor: c.line }} />
          ))}
        </div>
        <div className="flex flex-1 items-end gap-1 rounded border p-1.5" style={{ background: c.card, borderColor: c.line }}>
          {[40, 65, 50, 80, 60, 90].map((h, i) => (
            <span key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: c.primary, opacity: 0.35 + i * 0.1 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const current = mounted ? theme ?? "system" : null;

  return (
    <SettingsSection title="Appearance" description="Choose how FreshMart POS looks on this device. Your choice is remembered in this browser.">
      <div className="grid gap-4 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {THEMES.map((t) => {
          const selected = current === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(t.value)}
              data-testid={`theme-card-${t.value}`}
              className={cn(
                "group overflow-hidden rounded-xl border bg-card text-left shadow-soft outline-none transition-all hover:-translate-y-px hover:shadow-elevated focus-visible:ring-2 focus-visible:ring-ring/50",
                selected ? "border-primary ring-2 ring-primary/25" : "hover:border-primary/30",
              )}
            >
              <div className="relative aspect-[16/10] overflow-hidden border-b">
                {t.value === "system" ? (
                  <div className="flex h-full">
                    <div className="h-full w-1/2 overflow-hidden"><div className="h-full w-[200%]"><Preview mode="light" /></div></div>
                    <div className="h-full w-1/2 overflow-hidden"><div className="h-full w-[200%] -translate-x-1/2"><Preview mode="dark" /></div></div>
                  </div>
                ) : (
                  <Preview mode={t.value} />
                )}
                {selected && (
                  <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
                    <Check className="size-3.5" />
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2.5 p-3.5">
                <t.icon className={cn("mt-0.5 size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
        {mounted ? `Currently showing the ${resolvedTheme ?? "light"} theme${theme === "system" ? " (from your device)" : ""}.` : " "}
      </p>
    </SettingsSection>
  );
}
