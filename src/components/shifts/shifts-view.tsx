"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/page-header";
import { CurrentRegister } from "./current-register";
import { ShiftHistory } from "./shift-history";
import { ShiftSummaryDialog } from "./shift-summary-dialog";

export function ShiftsView() {
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [justClosed, setJustClosed] = useState(false);
  const shift = useAppStore((s) => (summaryId ? s.shifts.find((x) => x.id === summaryId) ?? null : null));

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Cash Register"
          description="Open and close your register, record cash movements and reconcile the drawer."
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Cash Register" }]}
          className="mb-5"
        />
        <CurrentRegister
          onClosed={(id) => {
            setJustClosed(true);
            setSummaryId(id);
          }}
        />
      </div>

      <ShiftHistory
        onSelect={(s) => {
          setJustClosed(false);
          setSummaryId(s.id);
        }}
      />

      <ShiftSummaryDialog shift={shift} open={!!shift} justClosed={justClosed} onOpenChange={(v) => !v && setSummaryId(null)} />
    </div>
  );
}
