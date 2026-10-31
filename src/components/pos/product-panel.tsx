"use client";

import { forwardRef, memo, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Flame, Plus, ScanBarcode, Scale, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { Category, Product } from "@/types";
import { useAppStore } from "@/store/app-store";
import { useCartStore } from "@/store/cart-store";
import { productPerformance, rangeFromPreset } from "@/lib/analytics";
import { formatMoney, formatQty, unitShort } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useDebounced } from "@/hooks";
import { ProductThumb } from "@/components/shared/product-thumb";
import { EmptyState } from "@/components/shared/empty-state";
import { addToCart, findByCode } from "./pos-actions";

export interface ProductPanelHandle {
  focusSearch: () => void;
  focusBarcode: () => void;
  clearSearch: () => void;
}

const POPULAR = "__popular";

export const ProductPanel = forwardRef<ProductPanelHandle, { onWeighed: (p: Product) => void }>(function ProductPanel({ onWeighed }, ref) {
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const sales = useAppStore((s) => s.sales);
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const q = useDebounced(query.trim().toLowerCase(), 80);

  useImperativeHandle(ref, () => ({
    focusSearch: () => searchRef.current?.focus(),
    focusBarcode: () => barcodeRef.current?.focus(),
    clearSearch: () => {
      setQuery("");
      setCategory("all");
    },
  }));

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const sellable = useMemo(() => products.filter((p) => p.status === "active"), [products]);
  const popularIds = useMemo(() => new Set(productPerformance(sales, rangeFromPreset("last30")).sort((a, b) => b.transactions - a.transactions).slice(0, 15).map((p) => p.productId)), [sales]);

  const visible = useMemo(() => {
    let list = sellable;
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q) || p.brand.toLowerCase().includes(q));
    else if (category === POPULAR) list = list.filter((p) => popularIds.has(p.id));
    else if (category !== "all") list = list.filter((p) => p.categoryId === category);
    return list;
  }, [sellable, q, category, popularIds]);

  const handleAdd = (p: Product) => {
    if (p.unit === "kg") onWeighed(p);
    else if (addToCart(p, 1)) toast.success(`${p.name} added`, { duration: 900, id: "pos-add" });
  };

  const scan = (code: string) => {
    const p = findByCode(code);
    if (!p) {
      toast.error("No product matches that barcode", { description: code });
      return;
    }
    if (p.status !== "active") {
      toast.error(`${p.name} is not available for sale`);
      return;
    }
    handleAdd(p);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Product selection">
      <div className="space-y-3 border-b bg-card/60 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && visible.length === 1) {
                  handleAdd(visible[0]);
                  setQuery("");
                }
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Search name, SKU or barcode…"
              className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-16 text-[15px] outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-ring focus:ring-3 focus:ring-ring/15"
              data-testid="pos-search"
              aria-label="Search products"
            />
            {query ? (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-accent" aria-label="Clear search"><X className="size-4" /></button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">F2</kbd>
            )}
          </div>
          <form
            className="relative sm:w-64"
            onSubmit={(e) => {
              e.preventDefault();
              if (barcode.trim()) scan(barcode);
              setBarcode("");
            }}
          >
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              inputMode="numeric"
              placeholder="Scan / type barcode ↵"
              className="h-11 w-full rounded-xl border border-dashed border-primary/40 bg-primary-soft/30 pl-9 pr-12 font-mono text-sm outline-none transition-shadow placeholder:font-sans placeholder:text-muted-foreground/80 focus:border-solid focus:border-ring focus:ring-3 focus:ring-ring/15"
              data-testid="pos-barcode"
              aria-label="Barcode"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">F3</kbd>
          </form>
        </div>
        <CategoryChips categories={categories} value={q ? "" : category} onChange={(c) => { setCategory(c); setQuery(""); }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin sm:p-4" data-testid="pos-product-grid">
        {visible.length === 0 ? (
          <EmptyState icon={Search} title="No products found" description={q ? `Nothing matches “${query}”. Try a different name, SKU or barcode.` : "No active products in this category."} />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} category={catMap.get(p.categoryId)} onAdd={handleAdd} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
});

function CategoryChips({ categories, value, onChange }: { categories: Category[]; value: string; onChange: (v: string) => void }) {
  const chip = (id: string, label: React.ReactNode, testId?: string) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange(id)}
      data-testid={testId}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
        value === id ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground hover:border-ring/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 no-scrollbar" role="tablist" aria-label="Categories">
      {chip("all", "All items", "pos-cat-all")}
      {chip(POPULAR, <><Flame className="size-3.5" />Popular</>, "pos-cat-popular")}
      {categories.map((c) => chip(c.id, <><span aria-hidden>{c.icon}</span>{c.name}</>, `pos-cat-${c.id}`))}
    </div>
  );
}

const ProductCard = memo(function ProductCard({ product: p, category, onAdd }: { product: Product; category?: Category; onAdd: (p: Product) => void }) {
  const inCart = useCartStore((s) => s.items.find((i) => i.productId === p.id)?.quantity ?? 0);
  const out = p.stock <= 0;
  const low = !out && p.stock <= p.minStock;
  const remaining = Math.max(0, p.stock - inCart);
  return (
    <button
      type="button"
      onClick={() => onAdd(p)}
      disabled={out}
      data-testid={`pos-product-${p.sku}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-soft transition-all active:scale-[0.98]",
        out ? "cursor-not-allowed opacity-55" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated",
        inCart > 0 && "border-primary/50 ring-1 ring-primary/30",
      )}
      aria-label={`Add ${p.name}, ${formatMoney(p.sellingPrice)} per ${unitShort(p.unit)}`}
    >
      <div className="relative flex h-20 items-center justify-center sm:h-24" style={{ background: `color-mix(in oklch, ${category?.color ?? "var(--primary)"} 12%, var(--card))` }}>
        <ProductThumb image={p.image} name={p.name} color="transparent" size="lg" className="bg-transparent text-4xl transition-transform group-hover:scale-110" />
        {p.unit === "kg" && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-card/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm"><Scale className="size-3" />Weighed</span>
        )}
        {inCart > 0 && <span className="absolute right-2 top-2 min-w-6 rounded-full bg-primary px-1.5 text-center text-[11px] font-bold leading-6 text-primary-foreground shadow-sm tabular">{formatQty(inCart)}</span>}
        {out && <span className="absolute inset-x-0 bottom-0 bg-destructive/90 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">Out of stock</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug">{p.name}</p>
        <div className="mt-auto flex items-end justify-between gap-1">
          <div>
            <p className="text-[15px] font-semibold tabular text-foreground">{formatMoney(p.sellingPrice)}</p>
            <p className={cn("text-[11px] tabular", low ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
              {out ? "No stock" : `${formatQty(remaining, p.unit)} left`} · /{unitShort(p.unit)}
            </p>
          </div>
          {!out && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden>
              <Plus className="size-4" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
