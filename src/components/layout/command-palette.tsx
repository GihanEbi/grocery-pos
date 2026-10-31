"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Receipt, Sparkles, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { NAV_SECTIONS } from "@/config/navigation";
import { useAppStore } from "@/store/app-store";
import { useCurrentUser } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/formatting";
import { ProductThumb } from "@/components/shared/product-thumb";

/** Global search (Ctrl/⌘ K): pages, products, customers, receipts. */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const router = useRouter();
  const user = useCurrentUser();
  const products = useAppStore((s) => s.products);
  const customers = useAppStore((s) => s.customers);
  const sales = useAppStore((s) => s.sales);
  const categories = useAppStore((s) => s.categories);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();
  const catColor = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories]);
  const pages = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => can(user?.role, i.permission));
  const productHits = q.length >= 1 && can(user?.role, "products.view") ? products.filter((p) => p.status !== "archived" && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q))).slice(0, 6) : [];
  const customerHits = q.length >= 2 && can(user?.role, "customers.view") ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))).slice(0, 5) : [];
  const saleHits = q.length >= 3 && can(user?.role, "sales.view") ? sales.filter((s) => s.receiptNo.toLowerCase().includes(q)).slice(0, 5) : [];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideClose size="lg" className="overflow-hidden p-0 sm:top-[18%] sm:translate-y-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command shouldFilter={false} loop>
          <CommandInput placeholder="Search pages, products, customers, receipts…" value={query} onValueChange={setQuery} data-testid="command-input" />
          <CommandList>
            <CommandEmpty>No results for “{query}”.</CommandEmpty>
            {productHits.length > 0 && (
              <CommandGroup heading="Products">
                {productHits.map((p) => (
                  <CommandItem key={p.id} value={`p-${p.id}`} onSelect={() => go(`/products?q=${encodeURIComponent(p.sku)}`)}>
                    <ProductThumb image={p.image} name={p.name} color={catColor.get(p.categoryId)} size="sm" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground tabular">{p.sku} · {formatMoney(p.sellingPrice)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {customerHits.length > 0 && (
              <CommandGroup heading="Customers">
                {customerHits.map((c) => (
                  <CommandItem key={c.id} value={`c-${c.id}`} onSelect={() => go(`/customers?id=${c.id}`)}>
                    <User />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {saleHits.length > 0 && (
              <CommandGroup heading="Receipts">
                {saleHits.map((s) => (
                  <CommandItem key={s.id} value={`s-${s.id}`} onSelect={() => go(`/sales/${s.id}`)}>
                    <Receipt />
                    <span className="flex-1 font-mono text-xs">{s.receiptNo}</span>
                    <span className="text-xs text-muted-foreground tabular">{formatMoney(s.total)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Pages">
              {pages
                .filter((p) => !q || p.title.toLowerCase().includes(q))
                .map((p) => (
                  <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                    <p.icon />
                    {p.title}
                  </CommandItem>
                ))}
            </CommandGroup>
            {q && can(user?.role, "ai.use") && (
              <CommandGroup heading="Ask AI">
                <CommandItem value="ask-ai" onSelect={() => go(`/ai-assistant?q=${encodeURIComponent(query)}`)}>
                  <Sparkles className="!text-primary" />
                  Ask the assistant: “{query}”
                </CommandItem>
              </CommandGroup>
            )}
            {!q && (
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground"><Package className="size-3" />Tip: type a SKU or barcode to jump to a product.</div>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
