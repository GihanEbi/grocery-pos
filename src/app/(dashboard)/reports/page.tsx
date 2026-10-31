"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { BarChart3, Boxes, CalendarClock, CircleDollarSign, CreditCard, Download, PackageSearch, Printer, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker, rangeLabel, useRangeState } from "@/components/shared/date-range-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import { useSettings } from "@/hooks";
import { downloadCsv } from "@/lib/utils";
import { ReportContext, categoryName, type ReportExport } from "@/components/reports/report-kit";
import { SalesReport } from "@/components/reports/sales-report";
import { ProductsReport } from "@/components/reports/products-report";
import { InventoryReport } from "@/components/reports/inventory-report";
import { LowStockReport } from "@/components/reports/low-stock-report";
import { ExpiryReport } from "@/components/reports/expiry-report";
import { ProfitReport } from "@/components/reports/profit-report";
import { PaymentsReport } from "@/components/reports/payments-report";
import { ExpensesReport } from "@/components/reports/expenses-report";

type TabKey = "sales" | "products" | "inventory" | "low-stock" | "expiry" | "profit" | "payments" | "expenses";

const TABS: { key: TabKey; label: string; title: string; icon: LucideIcon; category: boolean; range: boolean; Component: React.ComponentType }[] = [
  { key: "sales", label: "Sales", title: "Sales Report", icon: BarChart3, category: false, range: true, Component: SalesReport },
  { key: "products", label: "Products", title: "Product Sales Report", icon: PackageSearch, category: true, range: true, Component: ProductsReport },
  { key: "inventory", label: "Inventory", title: "Inventory Report", icon: Boxes, category: true, range: false, Component: InventoryReport },
  { key: "low-stock", label: "Low stock", title: "Low-Stock Report", icon: TrendingUp, category: true, range: false, Component: LowStockReport },
  { key: "expiry", label: "Expiry", title: "Expiry Report", icon: CalendarClock, category: true, range: false, Component: ExpiryReport },
  { key: "profit", label: "Profit", title: "Profit Report", icon: CircleDollarSign, category: true, range: true, Component: ProfitReport },
  { key: "payments", label: "Payments", title: "Payment Report", icon: CreditCard, category: false, range: true, Component: PaymentsReport },
  { key: "expenses", label: "Expenses", title: "Expense Report", icon: Wallet, category: false, range: true, Component: ExpensesReport },
];

/** Accept a few aliases so links like ?tab=low_stock also work. */
function normalizeTab(v: string | null): TabKey {
  const k = (v ?? "").toLowerCase().replace(/_/g, "-");
  const alias: Record<string, TabKey> = { lowstock: "low-stock", product: "products", payment: "payments", expense: "expenses", categories: "products", category: "products", "gross-profit": "profit" };
  const key = (alias[k] ?? k) as TabKey;
  return TABS.some((t) => t.key === key) ? key : "sales";
}

function ReportsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const settings = useSettings();
  const categories = useAppStore((s) => s.categories);
  const [tab, setTab] = React.useState<TabKey>(() => normalizeTab(params.get("tab")));
  const [value, setValue] = useRangeState("last30");
  const [categoryId, setCategoryId] = React.useState("all");
  const [printing, setPrinting] = React.useState(false);
  const exportRef = React.useRef<ReportExport | null>(null);
  const setExport = React.useCallback((e: ReportExport | null) => {
    exportRef.current = e;
  }, []);

  React.useEffect(() => {
    const t = params.get("tab");
    if (t) setTab(normalizeTab(t));
  }, [params]);

  const active = TABS.find((t) => t.key === tab)!;
  const rangeText = rangeLabel(value);
  const ctx = React.useMemo(() => ({ range: value.range, rangeText, categoryId: active.category ? categoryId : "all", printing, setExport }), [value.range, rangeText, active.category, categoryId, printing, setExport]);

  const changeTab = (v: string) => {
    const key = normalizeTab(v);
    setTab(key);
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  };

  const onExport = () => {
    const e = exportRef.current;
    if (!e || e.rows.length === 0) {
      toast.error("Nothing to export", { description: "The table has no rows for the current filters." });
      return;
    }
    downloadCsv(e.filename, e.rows);
    toast.success(`Exported ${e.rows.length} row${e.rows.length === 1 ? "" : "s"}`, { description: `${e.filename}.csv` });
  };

  const onPrint = () => {
    setPrinting(true);
    // Let tables re-render with every row before opening the print dialog.
    window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 150);
  };

  const Component = active.Component;

  return (
    <ReportContext.Provider value={ctx}>
      <PageHeader
        title="Reports & analytics"
        description="Sales, stock, profit and expense reports built from the same records as the POS."
        actions={
          <>
            <Button variant="outline" onClick={onPrint} disabled={printing} data-testid="report-print">
              <Printer />
              Print
            </Button>
            <Button onClick={onExport} data-testid="report-export-csv">
              <Download />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        <div className="no-print flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <Tabs value={tab} onValueChange={changeTab} className="min-w-0">
            <TabsList data-testid="reports-tabs" className="h-10 w-full justify-start xl:w-auto">
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} data-testid={`report-tab-${t.key}`} className="h-8">
                  <t.icon />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <DateRangePicker value={value} onChange={setValue} className="w-full min-w-0 sm:w-52" />
            <Select value={active.category ? categoryId : "all"} onValueChange={setCategoryId} disabled={!active.category}>
              <SelectTrigger className="sm:w-48" aria-label="Category filter" data-testid="report-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="print-area">
          <div className="mb-5 hidden border-b pb-3 print:block">
            <p className="text-lg font-semibold">{settings?.shop.name}</p>
            <p className="text-sm">
              {active.title} · {active.range ? `${format(value.range.from, "dd MMM yyyy")} – ${format(value.range.to, "dd MMM yyyy")}` : `As of ${format(new Date(), "dd MMM yyyy")}`}
              {active.category && ` · ${categoryName(categories, categoryId)}`}
            </p>
            <p className="text-xs">Generated {format(new Date(), "dd MMM yyyy, hh:mm a")} · {settings?.shop.address}</p>
          </div>
          <Component key={active.key} />
        </div>
      </div>
    </ReportContext.Provider>
  );
}

function ReportsFallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <React.Suspense fallback={<ReportsFallback />}>
      <ReportsInner />
    </React.Suspense>
  );
}
