"use client";

import * as React from "react";
import { Check, PackagePlus, Search } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ProductThumb } from "@/components/shared/product-thumb";
import { useCategoryMap } from "@/hooks";
import { useAppStore } from "@/store/app-store";
import { stockStatus } from "@/lib/calculations/inventory";
import { formatQty } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

const MAX_PER_GROUP = 40;
const statusRank = { out_of_stock: 0, low_stock: 1, in_stock: 2 } as const;

/**
 * Searchable product combobox for purchase orders. The supplier's own products
 * are listed first (most urgent stock first), then every other product.
 */
export function ProductPicker({ supplierId, supplierName, excludeIds, onSelect, disabled }: { supplierId: string; supplierName?: string; excludeIds: Set<string>; onSelect: (p: Product) => void; disabled?: boolean }) {
  const products = useAppStore((s) => s.products);
  const categoryMap = useCategoryMap();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (p: Product) => p.status !== "archived" && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q) || p.brand.toLowerCase().includes(q));
    const sort = (a: Product, b: Product) => statusRank[stockStatus(a.stock, a.minStock)] - statusRank[stockStatus(b.stock, b.minStock)] || a.name.localeCompare(b.name);
    const all = products.filter(match);
    const own = supplierId ? all.filter((p) => p.supplierId === supplierId).sort(sort) : [];
    const other = all.filter((p) => !supplierId || p.supplierId !== supplierId).sort(sort);
    const out: { label: string; items: Product[]; total: number }[] = [];
    if (own.length) out.push({ label: supplierName ? `From ${supplierName}` : "From this supplier", items: own.slice(0, MAX_PER_GROUP), total: own.length });
    if (other.length) out.push({ label: supplierId ? "Other products" : "Products", items: other.slice(0, MAX_PER_GROUP), total: other.length });
    return out;
  }, [products, query, supplierId, supplierName]);

  const flat = React.useMemo(() => groups.flatMap((g) => g.items), [groups]);
  React.useEffect(() => setActive(0), [query, supplierId]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(p: Product) {
    if (excludeIds.has(p.id)) return;
    onSelect(p);
    setQuery("");
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = flat[active];
      if (open && p) choose(p);
      else setOpen(true);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  let index = -1;
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search products by name, SKU or barcode to add…"
            className="h-10 pl-9"
            role="combobox"
            aria-expanded={open}
            aria-controls="po-product-listbox"
            aria-autocomplete="list"
            disabled={disabled}
            data-testid="po-add-item-search"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <div ref={listRef} id="po-product-listbox" role="listbox" className="max-h-[min(380px,55dvh)] overflow-y-auto p-1.5 scrollbar-thin">
          {flat.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
              <PackagePlus className="mb-2 size-5" />
              No products match &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label} role="group" aria-label={g.label} className="mb-1 last:mb-0">
                <p className="flex items-center justify-between px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  <span className="truncate">{g.label}</span>
                  <span className="tabular">{g.total > g.items.length ? `${g.items.length} of ${g.total}` : g.total}</span>
                </p>
                {g.items.map((p) => {
                  index++;
                  const i = index;
                  const added = excludeIds.has(p.id);
                  const status = stockStatus(p.stock, p.minStock);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      aria-disabled={added}
                      data-index={i}
                      data-testid={`po-product-option-${p.id}`}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(p)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm outline-none",
                        i === active && !added && "bg-accent text-accent-foreground",
                        added && "cursor-default opacity-55",
                      )}
                    >
                      <ProductThumb image={p.image} name={p.name} color={categoryMap.get(p.categoryId)?.color} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                      </span>
                      {added ? (
                        <span className="flex items-center gap-1 text-xs text-primary"><Check className="size-3.5" /> Added</span>
                      ) : (
                        <span className="shrink-0 text-right text-[11px] leading-tight tabular">
                          <span className={cn("block font-medium", status === "out_of_stock" ? "text-destructive-foreground" : status === "low_stock" ? "text-warning-foreground" : "text-foreground")}>
                            {formatQty(p.stock, p.unit)}
                          </span>
                          <span className="block text-muted-foreground">min {formatQty(p.minStock)}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
