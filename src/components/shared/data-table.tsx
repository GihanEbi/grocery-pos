"use client";
import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type { ColumnDef };

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  initialSorting?: SortingState;
  getRowId?: (row: T) => string;
  loading?: boolean;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  /** Reset to page 1 when this key changes (e.g. filters). */
  resetKey?: unknown;
  testId?: string;
}

/** Sortable, paginated table built on TanStack Table. Scrolls horizontally on small screens. */
export function DataTable<T>({ columns, data, pageSize = 10, onRowClick, empty, initialSorting = [], getRowId, loading, className, rowClassName, resetKey, testId }: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize });

  React.useEffect(() => setPagination((p) => ({ ...p, pageIndex: 0 })), [resetKey]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    autoResetPageIndex: false,
  });

  const rows = table.getRowModel().rows;
  const total = data.length;
  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  // Keep page in range when data shrinks.
  React.useEffect(() => {
    const max = Math.max(0, Math.ceil(total / pagination.pageSize) - 1);
    if (pagination.pageIndex > max) setPagination((p) => ({ ...p, pageIndex: max }));
  }, [total, pagination.pageIndex, pagination.pageSize]);

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-soft", className)} data-testid={testId}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                const meta = header.column.columnDef.meta as { className?: string; align?: "right" | "center" } | undefined;
                return (
                  <TableHead key={header.id} className={cn(meta?.className, meta?.align === "right" && "text-right", meta?.align === "center" && "text-center")} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
                    {header.isPlaceholder ? null : sortable ? (
                      <button type="button" onClick={header.column.getToggleSortingHandler()} className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground", meta?.align === "right" && "flex-row-reverse")}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {dir === "asc" ? <ArrowUp className="size-3" /> : dir === "desc" ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {columns.map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full max-w-32" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">{empty ?? <div className="py-12 text-center text-sm text-muted-foreground">No records found.</div>}</TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row.original); } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(onRowClick && "cursor-pointer focus-visible:bg-muted/50 outline-none", rowClassName?.(row.original))}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as { className?: string; align?: "right" | "center" } | undefined;
                  return (
                    <TableCell key={cell.id} className={cn(meta?.className, meta?.align === "right" && "text-right", meta?.align === "center" && "text-center")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {!loading && total > 0 && (
        <div className="no-print flex flex-col gap-3 border-t px-4 py-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="tabular">
            Showing <span className="font-medium text-foreground">{from}–{to}</span> of <span className="font-medium text-foreground">{total}</span>
          </span>
          <div className="flex items-center gap-2">
            <Select value={String(pagination.pageSize)} onValueChange={(v) => setPagination({ pageIndex: 0, pageSize: Number(v) })}>
              <SelectTrigger className="h-8 w-[110px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="tabular min-w-16 text-center">{pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}</span>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page"><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
