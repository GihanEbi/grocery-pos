"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BadgePercent, Minus, PauseCircle, Plus, PlayCircle, Scale, ShoppingBasket, Tag, Trash2, X } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { useAppStore } from "@/store/app-store";
import { formatMoney, formatPercent, formatQty, unitShort } from "@/lib/formatting";
import { fromCents, toCents } from "@/lib/calculations/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { ProductThumb } from "@/components/shared/product-thumb";
import { useCategoryMap } from "@/hooks";
import { CustomerPicker } from "./customer-picker";
import { setCartQty } from "./pos-actions";
import { usePosCart, type PosLine } from "./use-pos";

export function CartPanel({
  onPay,
  onHold,
  onResume,
  onClear,
  onDiscount,
  onWeigh,
  payDisabledReason,
  className,
  inSheet,
}: {
  onPay: () => void;
  onHold: () => void;
  onResume: () => void;
  onClear: () => void;
  onDiscount: () => void;
  onWeigh: (productId: string) => void;
  payDisabledReason: string | null;
  className?: string;
  /** Leaves room for the drawer's close button. */
  inSheet?: boolean;
}) {
  const cart = usePosCart();
  const heldCount = useAppStore((s) => s.heldBills.length);
  const taxName = useAppStore((s) => s.settings.pos.taxName);
  const taxMode = useAppStore((s) => s.settings.pos.taxMode);
  const billDiscount = useCartStore((s) => s.billDiscount);
  const lastTouched = useCartStore((s) => s.lastTouched);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the most recently added line visible.
  useEffect(() => {
    if (!lastTouched) return;
    listRef.current?.querySelector(`[data-line="${lastTouched}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lastTouched, cart.lines.length]);

  const { totals } = cart;

  return (
    <section className={cn("flex min-h-0 flex-col bg-card", className)} aria-label="Current bill">
      <div className={cn("flex items-center justify-between gap-2 border-b px-4 py-3", inSheet && "pr-12")}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            Current bill
            {!cart.empty && <span className="rounded-full bg-primary-soft px-2 text-xs font-semibold leading-5 text-primary-soft-foreground tabular" data-testid="cart-count">{cart.lines.length}</span>}
          </h2>
          <p className="text-xs text-muted-foreground">{cart.empty ? "Scan or tap products to start" : `${cart.lines.length} line${cart.lines.length === 1 ? "" : "s"} · ${cart.units} item${cart.units === 1 ? "" : "s"}`}</p>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="Resume held bill (F7)">
            <Button variant="ghost" size="icon-sm" onClick={onResume} className="relative" aria-label="Resume held bill" data-testid="pos-resume">
              <PlayCircle />
              {heldCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-warning px-1 text-[9px] font-bold leading-4 text-white">{heldCount}</span>}
            </Button>
          </Tooltip>
          <Tooltip content="Hold bill (F6)">
            <Button variant="ghost" size="icon-sm" onClick={onHold} disabled={cart.empty} aria-label="Hold bill" data-testid="pos-hold"><PauseCircle /></Button>
          </Tooltip>
          <Tooltip content="Clear bill (F8)">
            <Button variant="ghost" size="icon-sm" onClick={onClear} disabled={cart.empty} aria-label="Clear bill" className="hover:text-destructive-foreground" data-testid="pos-clear"><Trash2 /></Button>
          </Tooltip>
        </div>
      </div>

      <div className="border-b px-4 py-2.5">
        <CustomerPicker />
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin" data-testid="cart-lines">
        {cart.empty ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><ShoppingBasket className="size-6" /></span>
            <div>
              <p className="text-sm font-medium">The bill is empty</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Scan a barcode, search, or tap a product. Weighed items open a scale dialog.</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            <AnimatePresence initial={false}>
              {cart.lines.map((l) => (
                <CartLineRow key={l.item.lineId} line={l} highlight={lastTouched === l.product.id} onWeigh={onWeigh} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <div className="border-t bg-muted/30 px-4 pb-4 pt-3">
        <dl className="space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatMoney(totals.grossTotal)} testId="cart-subtotal" />
          {totals.itemDiscountTotal > 0 && <Row label="Item discounts" value={`− ${formatMoney(totals.itemDiscountTotal)}`} tone="discount" />}
          <div className="flex items-center justify-between">
            <dt>
              <button type="button" onClick={onDiscount} disabled={cart.empty} className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline disabled:no-underline disabled:opacity-60" data-testid="pos-discount">
                <BadgePercent className="size-3.5" />
                {billDiscount ? `Bill discount${billDiscount.type === "percent" ? ` (${formatPercent(billDiscount.value)})` : ""}` : "Add discount"}
              </button>
            </dt>
            <dd className={cn("tabular", totals.billDiscountAmount > 0 ? "text-success-foreground" : "text-muted-foreground")}>{totals.billDiscountAmount > 0 ? `− ${formatMoney(totals.billDiscountAmount)}` : "—"}</dd>
          </div>
          <Row label={`${taxName}${taxMode === "inclusive" ? " (incl.)" : ""}`} value={formatMoney(totals.taxTotal)} testId="cart-tax" />
        </dl>
        {cart.discountExceeded && (
          <p className="mt-2 rounded-md bg-destructive-soft px-2.5 py-1.5 text-xs text-destructive-foreground">Discount {formatPercent(cart.discountBps)} exceeds your limit of {formatPercent(cart.limitBps)}. Ask a manager.</p>
        )}
        <div className="mt-3 flex items-end justify-between border-t border-dashed pt-3">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <motion.span key={totals.grandTotal} initial={{ opacity: 0.4, y: 2 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-semibold tracking-tight tabular" data-testid="cart-total">
            {formatMoney(totals.grandTotal)}
          </motion.span>
        </div>
        <Button size="xl" className="mt-3 w-full justify-between text-base" disabled={cart.empty || !!payDisabledReason} onClick={onPay} data-testid="pos-pay">
          <span>Charge</span>
          <span className="flex items-center gap-2 tabular">{formatMoney(totals.grandTotal)}<kbd className="rounded border border-white/30 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-normal">F9</kbd></span>
        </Button>
        {payDisabledReason && !cart.empty && <p className="mt-2 text-center text-xs text-warning-foreground" data-testid="pay-blocked-reason">{payDisabledReason}</p>}
      </div>
    </section>
  );
}

function Row({ label, value, tone, testId }: { label: string; value: string; tone?: "discount"; testId?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular", tone === "discount" && "text-success-foreground")} data-testid={testId}>{value}</dd>
    </div>
  );
}

const CartLineRow = memo(function CartLineRow({ line, highlight, onWeigh }: { line: PosLine; highlight: boolean; onWeigh: (id: string) => void }) {
  const { item, product } = line;
  const catMap = useCategoryMap();
  const remove = useCartStore((s) => s.remove);
  const weighted = product.unit === "kg";
  const [draft, setDraft] = useState(String(item.quantity));
  useEffect(() => setDraft(String(item.quantity)), [item.quantity]);

  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n < 0 || (!weighted && !Number.isInteger(n)) || !setCartQty(product, n)) setDraft(String(item.quantity));
  };

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }}
      transition={{ duration: 0.16 }}
      data-line={product.id}
      data-testid={`cart-line-${product.sku}`}
      className={cn("group flex gap-3 px-4 py-3 transition-colors", highlight && "bg-primary-soft/30", line.overStock && "bg-destructive-soft/40")}
    >
      <ProductThumb image={product.image} name={product.name} color={catMap.get(product.categoryId)?.color} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-[13px] font-medium leading-snug">{product.name}</p>
          <p className="shrink-0 text-sm font-semibold tabular" data-testid={`cart-line-total-${product.sku}`}>{formatMoney(line.gross - item.discount)}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground tabular">
          {formatMoney(product.sellingPrice)} / {unitShort(product.unit)}
          {item.discount > 0 && <span className="ml-1.5 text-success-foreground">− {formatMoney(item.discount)} off</span>}
        </p>
        {line.overStock && <p className="mt-0.5 text-xs font-medium text-destructive-foreground">Only {formatQty(product.stock, product.unit)} in stock</p>}
        <div className="mt-2 flex items-center justify-between gap-2">
          {weighted ? (
            <button type="button" onClick={() => onWeigh(product.id)} className="flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-medium tabular hover:border-ring/50" data-testid={`cart-weight-${product.sku}`}>
              <Scale className="size-3.5 text-muted-foreground" />
              {formatQty(item.quantity, "kg")}
            </button>
          ) : (
            <div className="flex items-center rounded-lg border bg-card">
              <button type="button" onClick={() => setCartQty(product, item.quantity - 1)} className="flex size-8 items-center justify-center rounded-l-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Decrease ${product.name}`} data-testid={`cart-dec-${product.sku}`}>
                <Minus className="size-3.5" />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={commit}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                inputMode="numeric"
                className="h-8 w-10 border-x bg-transparent text-center text-[13px] font-semibold tabular outline-none focus:bg-primary-soft/40"
                aria-label={`Quantity of ${product.name}`}
                data-testid={`cart-qty-${product.sku}`}
              />
              <button type="button" onClick={() => setCartQty(product, item.quantity + 1)} className="flex size-8 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Increase ${product.name}`} data-testid={`cart-inc-${product.sku}`}>
                <Plus className="size-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
            <LineDiscount productId={product.id} gross={line.gross} current={item.discount} />
            <Button variant="ghost" size="icon-sm" onClick={() => remove(product.id)} aria-label={`Remove ${product.name}`} className="text-muted-foreground hover:text-destructive-foreground" data-testid={`cart-remove-${product.sku}`}>
              <X />
            </Button>
          </div>
        </div>
      </div>
    </motion.li>
  );
});

function LineDiscount({ productId, gross, current }: { productId: string; gross: number; current: number }) {
  const setItemDiscount = useCartStore((s) => s.setItemDiscount);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  useEffect(() => {
    if (open) setValue(current ? String(fromCents(current)) : "");
  }, [open, current]);
  const cents = toCents(Number(value || 0));
  const invalid = !Number.isFinite(cents) || cents < 0 || cents > gross;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Item discount">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" className={cn("text-muted-foreground", current > 0 && "text-success-foreground")} aria-label="Item discount"><Tag /></Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-60 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            setItemDiscount(productId, cents);
            setOpen(false);
          }}
          className="space-y-2"
        >
          <p className="text-sm font-medium">Item discount (Rs)</p>
          <Input autoFocus type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" aria-invalid={invalid} />
          {invalid && <p className="text-xs text-destructive-foreground">Must be between 0 and {formatMoney(gross)}.</p>}
          <p className="text-[11px] text-muted-foreground">Counts toward your role&apos;s discount limit.</p>
          <div className="flex gap-2">
            {current > 0 && <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => { setItemDiscount(productId, 0); setOpen(false); }}>Remove</Button>}
            <Button type="submit" size="sm" className="flex-1" disabled={invalid}>Apply</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
