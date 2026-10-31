# FreshMart POS — Developer Guide

Frontend-only Next.js 16 (App Router) + TypeScript + Tailwind v4 prototype. All data is mock data persisted in
`localStorage`. There is **no backend**; every "API" call is simulated in `src/mocks/services`.

## Golden rules

1. **Money is integer cents** (LKR minor units). Never store or add floats for money.
   - Display: `formatMoney(cents)` → `"Rs 1,250.00"` (from `@/lib/formatting`), or `<Money value={cents} />`.
   - Inputs: users type rupees; convert with `toCents(rupees)` / `fromCents(cents)` from `@/lib/calculations/money`.
   - Rates are **basis points** (1800 = 18%). Display with `formatPercent(bps)`.
   - Quantities: whole numbers, except `unit === "kg"` products (up to 3 decimals). Use `roundQty`, `formatQty(qty, unit)`.
2. **One shared store.** Read data with selectors from `useAppStore` (`@/store/app-store`). Never create page-local mock data.
3. **Mutations go through `api.*`** (`@/mocks/services`) — async, simulated latency, returns `Result<T>` = `{ok:true,data}|{ok:false,error}`.
   Show `toast.success(...)` (from `sonner`) only when `r.ok`; otherwise `toast.error(r.error)`.
4. **No native `alert`/`confirm`.** Use `const confirm = useConfirm()` → `if (await confirm({ title, description, confirmLabel, tone: "destructive" }))`.
5. **Permissions are centralized** in `@/lib/permissions`. Hide/disable guarded actions with `useCan("products.manage")`. Routes are guarded by `AuthGuard` automatically.
6. Historical figures (revenue, profit) come from **snapshots on `Sale.items`** — never recompute history from current product prices. Use `@/lib/analytics`.
7. Every visible button must do something. If simulated, say so (`<DemoBadge />`).
8. Pages are client components (`"use client"`). For dynamic route params use `useParams()`; for query strings use `useSearchParams()` inside a `<Suspense>` boundary.

## Folder map

```
src/app/(auth)/login          Login
src/app/(dashboard)/…         Management pages (shared AppShell: sidebar + topbar + AuthGuard)
src/app/pos                   POS terminal (own full-screen layout)
src/components/ui             shadcn-style primitives (button, input, dialog, sheet, select, tabs, table, …)
src/components/shared         App-level building blocks (see below)
src/components/layout         Shell: sidebar, topbar, command palette, notifications, user menu
src/components/<module>       Module-specific components
src/features/ai               Mock AI intent engine + chat store
src/store                     Zustand stores: app-store (data), auth-store, cart-store, ui-store
src/mocks/seed                Deterministic seed generator (catalog.ts + generate.ts)
src/mocks/services            Simulated async API (`api`)
src/lib/calculations          Pure, unit-tested business math (money, cart, inventory, forecasting, register, returns)
src/lib/analytics             Shared report/dashboard/AI aggregations
src/lib/permissions           Role → permission map, route guards
src/lib/formatting            Money/date/qty formatting
src/config                    Navigation, defaults (settings, reasons, units, expense categories)
src/types                     Domain types (`index.ts`) and `AppData` (`data.ts`)
```

## Shared components (import paths)

| Component | Path | Notes |
|---|---|---|
| `PageHeader` | `@/components/shared/page-header` | `title, description, actions, breadcrumbs` |
| `KpiCard` | `@/components/shared/kpi-card` | `label, value, icon, tone, change, hint, href` |
| `DataTable` | `@/components/shared/data-table` | TanStack Table; `columns: ColumnDef<T, unknown>[]`, sorting + pagination, `onRowClick`, `empty`, `resetKey`. Column `meta: { align: "right" }` |
| `EmptyState` | `@/components/shared/empty-state` | `icon, title, description, action` |
| `SearchInput` | `@/components/shared/search-input` | controlled `value/onChange` |
| `FormField` | `@/components/shared/form-field` | label + error + hint wrapper |
| `DateRangePicker`, `useRangeState` | `@/components/shared/date-range-picker` | presets + custom; value `{preset, range:{from,to}}` |
| `ChartCard`, `ChartTooltip`, `CHART_COLORS`, `moneyTick`, `ChartLegend` | `@/components/shared/chart` | Recharts, theme-aware via CSS vars |
| Status badges | `@/components/shared/status-badges` | `StockStatusBadge, POStatusBadge, SaleStatusBadge, ExpiryBadge, ProductStatusBadge, PaymentBadge` |
| `ProductThumb` | `@/components/shared/product-thumb` | emoji or uploaded image; pass category color |
| `Money` | `@/components/shared/money` | |
| `Receipt`, `PrintButton` | `@/components/shared/receipt` | thermal receipt for a `Sale` |
| `useConfirm` | `@/components/shared/confirm-dialog` | promise-based confirm |
| `DemoBadge` | `@/components/shared/demo-badge` | marks simulated features |

UI primitives: `Button` (variants default/secondary/outline/ghost/destructive/destructive-outline/soft/link; sizes sm/default/lg/xl/icon/icon-sm/icon-lg; `loading` prop),
`Input`, `Textarea`, `Label`, `Badge` (variants default/secondary/outline/success/warning/destructive/info, `dot`), `Card*`,
`Dialog*` (`DialogContent size="sm|md|lg|xl|2xl"`, `DialogHeader/Body/Footer/Title/Description`), `Sheet*` (side drawer: `SheetContent side size`, `SheetHeader/Body/Footer/Title/Description`),
`Select*`, `Tabs*`, `Table*`, `Tooltip` (`content` prop), `Popover*`, `DropdownMenu*`, `Switch`, `Checkbox`, `Skeleton`, `Separator`, `UserAvatar`, `Command*`.

## Hooks (`@/hooks`)

`useCurrentUser()`, `useCan(permission)`, `useProductMap()`, `useCategoryMap()`, `useSupplierMap()`, `useCustomerMap()`, `useUserMap()`,
`useActiveShift()` (open register of signed-in user), `useSettings()`, `useDebounced(v)`, `useMediaQuery(q)`, `useOnlineStatus()`.

## Store actions (call via `api`)

`api.products.create/update/archive/restore`, `api.inventory.adjust/writeOffBatch`, `api.suppliers.create/update`,
`api.purchasing.create/update/approve/cancel/receive`, `api.customers.create/update`, `api.sales.complete/processReturn`,
`api.expenses.create/update/remove`, `api.shifts.open/close/adjust`, `api.users.create/update`, `api.sync.pushPending`, `api.demo.reset`.
See signatures in `src/store/app-store.ts`.

## Design language

Emerald primary, slate neutrals, soft teal accent. Tokens in `src/app/globals.css` (`bg-primary-soft`, `text-muted-foreground`,
`bg-warning-soft text-warning-foreground`, `shadow-soft`, `shadow-elevated`, `tabular` for numbers). Cards: `rounded-xl border bg-card shadow-soft`.
Page rhythm: `PageHeader` → KPI grid (`grid gap-4 sm:grid-cols-2 xl:grid-cols-4`) → filters row → table/cards. Always design for 375px wide.
Use `data-testid` on key controls used by Playwright tests.
