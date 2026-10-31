"use client";

import { useMemo } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import type { Shift } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useUserMap } from "@/hooks";
import { summarizeShift } from "@/lib/calculations/register";
import { formatDateTime, formatMoney, formatTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DifferenceBadge, shiftDuration } from "./shift-utils";

export function ShiftSummaryDialog({ shift, open, onOpenChange, justClosed }: { shift: Shift | null; open: boolean; onOpenChange: (v: boolean) => void; justClosed?: boolean }) {
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const userMap = useUserMap();
  const summary = useMemo(() => (shift ? summarizeShift(shift, sales, returns) : null), [shift, sales, returns]);

  return (
    <Dialog open={open && !!shift} onOpenChange={onOpenChange}>
      <DialogContent size="md" data-testid="shift-summary">
        {shift && summary && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {justClosed ? <CheckCircle2 className="size-4 text-success-foreground" /> : <ClipboardList className="size-4 text-primary" />}
                {justClosed ? "Register closed — shift summary" : "Shift summary"}
              </DialogTitle>
              <DialogDescription>
                {shift.register} · {userMap.get(shift.cashierId)?.name ?? "Unknown cashier"} · {shiftDuration(shift.openedAt, shift.closedAt)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Meta label="Cashier" value={userMap.get(shift.cashierId)?.name ?? "—"} />
                <Meta label="Status" value={<Badge variant={shift.status === "open" ? "success" : "secondary"} dot>{shift.status === "open" ? "Open" : "Closed"}</Badge>} />
                <Meta label="Opened" value={formatDateTime(shift.openedAt)} />
                <Meta label="Closed" value={shift.closedAt ? formatDateTime(shift.closedAt) : "Still open"} />
              </dl>

              <div className="rounded-xl border">
                <Line label="Opening cash" value={summary.openingCash} />
                <Line label="Cash sales" value={summary.cashSales} sign="+" />
                <Line label="Cash refunds" value={summary.cashRefunds} sign="-" />
                <Line label="Pay-ins" value={summary.payIns} sign="+" />
                <Line label="Pay-outs" value={summary.payOuts} sign="-" />
                <div className="flex items-center justify-between border-t bg-muted/40 px-3.5 py-2.5 font-semibold">
                  <span>Expected cash</span>
                  <span className="tabular">{formatMoney(summary.expectedCash)}</span>
                </div>
                <Line label="Counted cash" value={summary.countedCash} />
                <div className="flex items-center justify-between border-t px-3.5 py-2.5">
                  <span className="text-sm font-medium">Difference</span>
                  {summary.difference === null ? <span className="text-sm text-muted-foreground">Not counted yet</span> : <DifferenceBadge value={summary.difference} large />}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini label="Transactions" value={summary.transactions.toLocaleString("en-LK")} />
                <Mini label="Card sales" value={formatMoney(summary.cardSales)} />
                <Mini label="QR sales" value={formatMoney(summary.qrSales)} />
              </div>
              <p className="text-xs text-muted-foreground">Total sales this shift: <span className="font-medium text-foreground tabular">{formatMoney(summary.totalSales)}</span></p>

              {shift.adjustments.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Cash adjustments</p>
                  <ul className="divide-y rounded-xl border text-sm">
                    {shift.adjustments.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-3.5 py-2">
                        <span className="min-w-0 truncate">
                          <Badge variant={a.type === "pay_in" ? "success" : "warning"} className="mr-2">{a.type === "pay_in" ? "Pay in" : "Pay out"}</Badge>
                          {a.reason} <span className="text-xs text-muted-foreground">· {formatTime(a.date)}</span>
                        </span>
                        <span className="tabular font-medium">{a.type === "pay_in" ? "+" : "-"}{formatMoney(a.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {shift.notes && <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Notes: {shift.notes}</p>}
            </DialogBody>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} data-testid="shift-summary-close">Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function Line({ label, value, sign }: { label: string; value: number | null; sign?: "+" | "-" }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2 text-sm [&+&]:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular", value === 0 && "text-muted-foreground")}>
        {value === null ? "—" : `${sign && value > 0 ? `${sign} ` : ""}${formatMoney(value)}`}
      </span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-2 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular">{value}</p>
    </div>
  );
}
