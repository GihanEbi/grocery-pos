"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, Keyboard, Lock, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import type { Product, Sale } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCartStore } from "@/store/cart-store";
import { useCurrentUser } from "@/store/auth-store";
import { formatMoney, formatRelative } from "@/lib/formatting";
import { isTypingTarget } from "@/lib/utils";
import { useActiveShift, useMediaQuery } from "@/hooks";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ProductPanel, type ProductPanelHandle } from "./product-panel";
import { CartPanel } from "./cart-panel";
import { DiscountDialog, HeldBillsDialog, OpenRegisterDialog, WeightDialog } from "./pos-dialogs";
import { PaymentDialog, SaleCompleteDialog } from "./payment-dialog";
import { findByCode, addToCart } from "./pos-actions";
import { usePosCart } from "./use-pos";

const SHORTCUTS = [
  ["F2", "Search products"],
  ["F3", "Barcode input"],
  ["F9", "Open payment"],
  ["F6", "Hold bill"],
  ["F7", "Resume held bill"],
  ["F8", "Clear bill"],
  ["Esc", "Clear search / selection"],
];

export function PosTerminal() {
  const user = useCurrentUser();
  const shift = useActiveShift();
  const requireRegister = useAppStore((s) => s.settings.pos.requireOpenRegister);
  const holdBill = useAppStore((s) => s.holdBill);
  const customers = useAppStore((s) => s.customers);
  const cart = usePosCart();
  const confirm = useConfirm();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const panelRef = useRef<ProductPanelHandle>(null);

  const [weighing, setWeighing] = useState<Product | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [completed, setCompleted] = useState<Sale | null>(null);

  const registerClosed = requireRegister && !shift;
  const payDisabledReason = registerClosed
    ? "Open your register to take payments."
    : cart.hasStockIssue
      ? "Some items exceed available stock."
      : cart.discountExceeded
        ? "Discount exceeds your limit."
        : null;

  const openPay = useCallback(() => {
    if (cart.empty) return toast("Add products to the bill first");
    if (registerClosed) {
      toast.warning("Register is closed", { description: "Open your register before taking payment." });
      setRegisterOpen(true);
      return;
    }
    if (payDisabledReason) return toast.error(payDisabledReason);
    setMobileCartOpen(false);
    setPayOpen(true);
  }, [cart.empty, registerClosed, payDisabledReason]);

  const hold = useCallback(() => {
    const c = useCartStore.getState();
    if (!c.items.length || !user) return toast("Nothing to hold — the bill is empty");
    const cust = customers.find((x) => x.id === c.customerId);
    const r = holdBill({ label: cust ? `${cust.name}'s bill` : `Bill at ${formatRelative(new Date())}`, items: c.items, customerId: c.customerId, billDiscount: c.billDiscount, cashierId: user.id });
    if (r.ok) {
      c.clear();
      toast.success("Bill on hold", { description: "Resume it any time with F7." });
    } else toast.error(r.error);
  }, [customers, holdBill, user]);

  const clear = useCallback(async () => {
    if (!useCartStore.getState().items.length) return;
    if (await confirm({ title: "Clear the current bill?", description: "All items, the customer and discounts will be removed.", confirmLabel: "Clear bill", tone: "destructive" })) {
      useCartStore.getState().clear();
      toast("Bill cleared");
    }
  }, [confirm]);

  const weighById = useCallback((id: string) => setWeighing(useAppStore.getState().products.find((p) => p.id === id) ?? null), []);

  // Keyboard shortcuts + USB barcode scanner detection (fast keystrokes ending in Enter).
  useEffect(() => {
    let buffer = "";
    let last = 0;
    const anyDialogOpen = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);
      if (!anyDialogOpen()) {
        const map: Record<string, () => void> = {
          F2: () => panelRef.current?.focusSearch(),
          F3: () => panelRef.current?.focusBarcode(),
          F9: openPay,
          F6: hold,
          F7: () => setHeldOpen(true),
          F8: clear,
        };
        if (map[e.key]) {
          e.preventDefault();
          map[e.key]();
          return;
        }
        if (e.key === "Escape" && !typing) panelRef.current?.clearSearch();
      }
      // Scanner: characters arriving < 35ms apart while no field is focused.
      if (typing || anyDialogOpen()) return;
      const now = performance.now();
      if (e.key === "Enter") {
        if (buffer.length >= 6) {
          e.preventDefault();
          const p = findByCode(buffer);
          if (!p) toast.error("No product matches that barcode", { description: buffer });
          else if (p.unit === "kg") setWeighing(p);
          else if (addToCart(p, 1)) toast.success(`${p.name} added`, { duration: 900, id: "pos-add" });
        }
        buffer = "";
        return;
      }
      if (e.key.length === 1) {
        buffer = now - last < 35 ? buffer + e.key : e.key;
        last = now;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPay, hold, clear]);

  const cartPanel = (inSheet = false) => (
    <CartPanel
      inSheet={inSheet}
      onPay={openPay}
      onHold={hold}
      onResume={() => setHeldOpen(true)}
      onClear={clear}
      onDiscount={() => setDiscountOpen(true)}
      onWeigh={weighById}
      payDisabledReason={payDisabledReason}
      className="h-full"
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {registerClosed && (
        <div className="flex flex-col gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning-foreground sm:flex-row sm:items-center" data-testid="register-closed-banner">
          <Lock className="size-4 shrink-0" />
          <span className="flex-1"><b>Register closed.</b> You can build a bill, but checkout is blocked until you open your register.</span>
          <Button size="sm" onClick={() => setRegisterOpen(true)} data-testid="pos-open-register">Open register</Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <ProductPanel ref={panelRef} onWeighed={setWeighing} />
        {isDesktop && <div className="w-[400px] shrink-0 border-l xl:w-[430px]">{cartPanel()}</div>}
      </div>

      {!isDesktop && (
        <>
          <div className="sticky bottom-0 z-20 border-t bg-card/95 p-3 backdrop-blur">
            <Button size="xl" className="w-full justify-between" onClick={() => setMobileCartOpen(true)} data-testid="mobile-cart">
              <span className="flex items-center gap-2"><ShoppingBasket />{cart.lines.length} item{cart.lines.length === 1 ? "" : "s"}<ChevronUp className="size-4 opacity-70" /></span>
              <span className="tabular">{formatMoney(cart.totals.grandTotal)}</span>
            </Button>
          </div>
          <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
            <SheetContent side="right" size="md" className="w-full max-w-full p-0 sm:max-w-md" aria-describedby={undefined}>
              <SheetTitle className="sr-only">Current bill</SheetTitle>
              {cartPanel(true)}
            </SheetContent>
          </Sheet>
        </>
      )}

      <WeightDialog product={weighing} onClose={() => setWeighing(null)} />
      <DiscountDialog open={discountOpen} onOpenChange={setDiscountOpen} />
      <HeldBillsDialog open={heldOpen} onOpenChange={setHeldOpen} />
      <OpenRegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} onComplete={setCompleted} />
      <SaleCompleteDialog sale={completed} onClose={() => { setCompleted(null); setTimeout(() => panelRef.current?.focusBarcode(), 50); }} />
    </div>
  );
}

export function ShortcutHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts" data-testid="pos-shortcuts"><Keyboard className="size-[18px]" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-sm font-semibold">Keyboard shortcuts</p>
        <ul className="space-y-1.5 text-sm">
          {SHORTCUTS.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between">
              <span className="text-muted-foreground">{label}</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{k}</kbd>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">USB barcode scanners that type + Enter work anywhere on this screen.</p>
      </PopoverContent>
    </Popover>
  );
}
