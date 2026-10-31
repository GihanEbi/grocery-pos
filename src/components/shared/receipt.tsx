"use client";

import { Printer } from "lucide-react";
import type { Sale } from "@/types";
import { useAppStore } from "@/store/app-store";
import { formatDateTime, formatMoney, formatPercent, formatQty, paymentMethodLabel } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Thermal-style receipt. The `.print-area` class makes it the only visible
 * element when the browser print dialog is opened.
 */
export function Receipt({ sale, className }: { sale: Sale; className?: string }) {
  const settings = useAppStore((s) => s.settings);
  const cashier = useAppStore((s) => s.users.find((u) => u.id === sale.cashierId));
  const customer = useAppStore((s) => (sale.customerId ? s.customers.find((c) => c.id === sale.customerId) : null));
  const allReturns = useAppStore((s) => s.returns);
  const returns = allReturns.filter((r) => r.saleId === sale.id);
  const { shop, pos } = settings;
  const itemDisc = sale.itemDiscountTotal;
  const billDisc = sale.billDiscount?.amount ?? 0;

  return (
    <div className={cn("print-area mx-auto w-full max-w-[340px] bg-white px-5 py-6 font-mono text-[12px] leading-relaxed text-neutral-900 shadow-[0_1px_3px_rgb(0_0_0/0.12)] dark:shadow-none", className)} data-testid="receipt">
      <div className="text-center">
        {shop.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logo} alt="" className="mx-auto mb-2 h-10 object-contain" />
        ) : (
          <div className="mx-auto mb-2 flex size-9 items-center justify-center rounded-full bg-neutral-900 text-base text-white">🛒</div>
        )}
        <p className="text-sm font-bold uppercase tracking-wide">{shop.name}</p>
        <p>{shop.address}</p>
        <p>Tel: {shop.phone}</p>
        {shop.registrationNo && <p>Reg: {shop.registrationNo}</p>}
        {pos.receiptHeader && <p className="mt-2 whitespace-pre-line italic">{pos.receiptHeader}</p>}
      </div>
      <Divider />
      <Row l="Receipt" r={sale.receiptNo} bold />
      <Row l="Date" r={formatDateTime(sale.date)} />
      <Row l="Cashier" r={cashier?.name ?? "—"} />
      <Row l="Customer" r={customer?.name ?? "Walk-in customer"} />
      {sale.offline && <Row l="Mode" r={sale.synced ? "Offline (synced)" : "Offline (pending sync)"} />}
      <Divider />
      <div className="space-y-1.5">
        {sale.items.map((it) => (
          <div key={it.productId}>
            <p className="font-semibold">{it.name}</p>
            <div className="flex justify-between">
              <span>{formatQty(it.quantity, it.unit)} × {formatMoney(it.unitPrice, { symbol: false })}</span>
              <span>{formatMoney(it.lineTotal + it.itemDiscount + it.billDiscountShare - (pos.taxMode === "exclusive" ? it.taxAmount : 0), { symbol: false })}</span>
            </div>
            {it.itemDiscount > 0 && <Row l="  Item discount" r={`-${formatMoney(it.itemDiscount, { symbol: false })}`} />}
            {it.taxRateBps > 0 && <p className="text-[10px] text-neutral-500">{pos.taxName} {formatPercent(it.taxRateBps)}{pos.taxMode === "inclusive" ? " incl." : ""}</p>}
            {it.returnedQty > 0 && <p className="text-[10px] font-semibold text-neutral-500">Returned: {formatQty(it.returnedQty, it.unit)}</p>}
          </div>
        ))}
      </div>
      <Divider />
      <Row l="Subtotal" r={formatMoney(sale.subtotal + itemDisc, { symbol: false })} />
      {itemDisc > 0 && <Row l="Item discounts" r={`-${formatMoney(itemDisc, { symbol: false })}`} />}
      {billDisc > 0 && <Row l={`Bill discount${sale.billDiscount?.type === "percent" ? ` (${formatPercent(sale.billDiscount.value)})` : ""}`} r={`-${formatMoney(billDisc, { symbol: false })}`} />}
      <Row l={`${pos.taxName}${pos.taxMode === "inclusive" ? " (included)" : ""}`} r={formatMoney(sale.taxTotal, { symbol: false })} />
      <div className="my-1.5 flex justify-between border-y border-dashed border-neutral-400 py-1.5 text-sm font-bold">
        <span>TOTAL ({shop.currency})</span>
        <span>{formatMoney(sale.total, { symbol: false })}</span>
      </div>
      {sale.payments.map((p, i) => (
        <Row key={i} l={paymentMethodLabel[p.method] + (p.reference ? ` (${p.reference})` : "")} r={formatMoney(p.tendered ?? p.amount, { symbol: false })} />
      ))}
      {sale.change > 0 && <Row l="Change" r={formatMoney(sale.change, { symbol: false })} bold />}
      {sale.loyaltyEarned > 0 && <Row l="Loyalty points earned" r={`+${sale.loyaltyEarned}`} />}
      {returns.length > 0 && (
        <>
          <Divider />
          {returns.map((r) => <Row key={r.id} l={`Refund ${r.returnNo}`} r={`-${formatMoney(r.refundAmount, { symbol: false })}`} />)}
        </>
      )}
      <Divider />
      <p className="whitespace-pre-line text-center text-[11px]">{pos.receiptFooter}</p>
      <div className="mx-auto mt-3 h-8 w-48" style={{ background: "repeating-linear-gradient(90deg,#111 0 2px,transparent 2px 4px,#111 4px 5px,transparent 5px 8px)" }} aria-hidden />
      <p className="mt-1 text-center text-[10px] tracking-[0.3em]">{sale.receiptNo}</p>
    </div>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", bold && "font-bold")}>
      <span className="truncate">{l}</span>
      <span className="shrink-0 text-right">{r}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-dashed border-neutral-400" />;
}

export function PrintButton({ label = "Print receipt", ...props }: React.ComponentProps<typeof Button> & { label?: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()} {...props}>
      <Printer /> {label}
    </Button>
  );
}
