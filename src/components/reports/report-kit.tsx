"use client";
import * as React from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable, type ColumnDef } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import type { DateRange } from "@/lib/analytics";
import type { Category, Product, Sale } from "@/types";
import { cn } from "@/lib/utils";
import { useDebounced } from "@/hooks";

export type CsvRow = Record<string, string | number | null | undefined>;
export interface ReportExport {
  filename: string;
  rows: CsvRow[];
}

export interface ReportContextValue {
  range: DateRange;
  rangeText: string;
  /** "all" or a category id. */
  categoryId: string;
  /** True while the browser print dialog is being prepared (tables show every row). */
  printing: boolean;
  setExport: (e: ReportExport | null) => void;
}

export const ReportContext = React.createContext<ReportContextValue | null>(null);

export function useReport() {
  const ctx = React.useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used inside a ReportContext provider");
  return ctx;
}

/** Register the rows that the page-level "Export CSV" button downloads (exactly the visible table rows). */
export function useReportExport(filename: string, rows: CsvRow[]) {
  const { setExport, range } = useReport();
  React.useEffect(() => {
    setExport({ filename: `${filename}_${format(range.from, "yyyyMMdd")}-${format(range.to, "yyyyMMdd")}`, rows });
  }, [filename, rows, range, setExport]);
  React.useEffect(() => () => setExport(null), [setExport]);
}

/** Restrict sale lines to products of one category (for category-filtered sales analytics). */
export function filterSalesByCategory(sales: Sale[], products: Product[], categoryId: string): Sale[] {
  if (categoryId === "all") return sales;
  const ids = new Set(products.filter((p) => p.categoryId === categoryId).map((p) => p.id));
  const out: Sale[] = [];
  for (const s of sales) {
    const items = s.items.filter((i) => ids.has(i.productId));
    if (items.length) out.push({ ...s, items });
  }
  return out;
}

export function categoryName(categories: Category[], id: string) {
  return id === "all" ? "All categories" : categories.find((c) => c.id === id)?.name ?? "Category";
}

/** Case-insensitive search over a set of text fields. */
export function useTableSearch<T>(rows: T[], fields: (row: T) => (string | null | undefined)[]) {
  const [q, setQ] = React.useState("");
  const term = useDebounced(q.trim().toLowerCase(), 150);
  const filtered = React.useMemo(
    () => (term ? rows.filter((r) => fields(r).some((f) => f?.toLowerCase().includes(term))) : rows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, term],
  );
  return { q, setQ, filtered, term };
}

export function KpiRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4", className)}>{children}</div>;
}

/** Compact KPI tile for reports (prints cleanly, no links). */
export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "positive" | "negative" | "warning" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft print:shadow-none">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-xl font-semibold tracking-tight tabular",
          tone === "positive" && "text-success-foreground",
          tone === "negative" && "text-destructive-foreground",
          tone === "warning" && "text-warning-foreground",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Title + search + DataTable, shared by all reports. */
export function ReportTable<T>({
  title,
  description,
  columns,
  rows,
  search,
  searchPlaceholder = "Search…",
  toolbar,
  getRowId,
  onRowClick,
  emptyTitle = "No records for this selection",
  initialSorting,
}: {
  title: string;
  description?: React.ReactNode;
  columns: ColumnDef<T, unknown>[];
  rows: T[];
  search: { q: string; setQ: (v: string) => void };
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  getRowId?: (r: T) => string;
  onRowClick?: (r: T) => void;
  emptyTitle?: string;
  initialSorting?: { id: string; desc: boolean }[];
}) {
  const { printing } = useReport();
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center">
          {toolbar}
          <SearchInput value={search.q} onChange={search.setQ} placeholder={searchPlaceholder} aria-label={`Search ${title}`} className="sm:w-64" />
        </div>
      </div>
      <DataTable
        key={printing ? "print" : "screen"}
        columns={columns}
        data={rows}
        pageSize={printing ? Math.max(10, rows.length) : 10}
        getRowId={getRowId}
        onRowClick={printing ? undefined : onRowClick}
        resetKey={rows}
        initialSorting={initialSorting}
        empty={<EmptyState compact title={emptyTitle} description="Try a different date range, category or search term." />}
      />
    </section>
  );
}

export function ChartGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 lg:grid-cols-2 print:grid-cols-2 [&>*]:break-inside-avoid", className)}>{children}</div>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return <Card className="border-dashed bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground shadow-none">{children}</Card>;
}
