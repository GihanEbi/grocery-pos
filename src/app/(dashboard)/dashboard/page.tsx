"use client";
import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CalendarClock, CircleDollarSign, Package, ReceiptText, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/kpi-card";
import { DateRangePicker, rangeLabel, useRangeState } from "@/components/shared/date-range-picker";
import { AiDailySummary, AiInsightCards } from "@/components/ai/insight-cards";
import { CategorySalesCard, PaymentMixCard, SalesTrendCard, TopProductsCard, WeekComparisonCard } from "@/components/dashboard/dashboard-charts";
import { ExpiryAlerts, LowStockList, RecentSales } from "@/components/dashboard/dashboard-sections";
import { ChartSkeleton, KpiSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { useAppStore } from "@/store/app-store";
import { useCurrentUser, useSettings } from "@/hooks";
import { expiryRows, percentChange, previousRange, rangeFromPreset, stockCounts, summarize } from "@/lib/analytics";
import { formatMoney, formatNumber, formatPercent } from "@/lib/formatting";

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const settings = useSettings();
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const products = useAppStore((s) => s.products);
  const batches = useAppStore((s) => s.batches);
  const [value, setValue] = useRangeState("today");
  const [refreshing, setRefreshing] = React.useState(false);
  const range = value.range;

  const kpis = React.useMemo(() => {
    const cur = summarize(sales, returns, range);
    const prev = summarize(sales, returns, previousRange(range));
    const stock = stockCounts(products);
    const expiring = expiryRows(batches, products).filter((r) => r.daysLeft <= 7 && r.product.status !== "archived");
    return {
      cur,
      salesChange: percentChange(cur.grossSales, prev.grossSales),
      txChange: percentChange(cur.transactions, prev.transactions),
      profitChange: percentChange(cur.grossProfit, prev.grossProfit),
      stock,
      expiringProducts: new Set(expiring.map((r) => r.product.id)).size,
      expiringBatches: expiring.length,
      expiredBatches: expiring.filter((r) => r.daysLeft < 0).length,
    };
  }, [sales, returns, products, batches, range]);

  const refresh = () => {
    setRefreshing(true);
    if (value.preset !== "custom") setValue({ preset: value.preset, range: rangeFromPreset(value.preset) });
    useAppStore.getState().scanConditions();
    window.setTimeout(() => {
      setRefreshing(false);
      toast.success("Dashboard refreshed", { description: "Figures and alerts are up to date." });
    }, 600);
  };

  const firstName = user?.name.split(" ")[0] ?? "there";
  const rangeText = rangeLabel(value);
  const compareLabel = value.preset === "today" ? "vs yesterday" : "vs previous period";

  return (
    <div className="space-y-6">
      {/* Greeting header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM yyyy")} · {settings?.shop.name}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s how the store is performing.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={value} onChange={setValue} className="min-w-0 flex-1 sm:w-48 sm:flex-none" />
          <Button variant="outline" onClick={refresh} disabled={refreshing} data-testid="dashboard-refresh" aria-label="Refresh dashboard">
            <RefreshCw className={refreshing ? "animate-spin" : undefined} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <AiDailySummary />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" data-testid="dashboard-kpis">
        {refreshing ? (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <div data-testid="kpi-sales" className="[&>a]:h-full">
              <KpiCard label={value.preset === "today" ? "Today's sales" : "Sales"} value={formatMoney(kpis.cur.grossSales)} icon={CircleDollarSign} tone="primary" change={kpis.salesChange} changeLabel={compareLabel} hint={rangeText} href="/sales" />
            </div>
            <KpiCard label="Transactions" value={formatNumber(kpis.cur.transactions)} icon={ReceiptText} tone="info" change={kpis.txChange} changeLabel={compareLabel} hint={`Avg basket ${formatMoney(kpis.cur.avgBasket)}`} href="/sales" />
            <KpiCard
              label="Gross profit"
              value={formatMoney(kpis.cur.grossProfit)}
              icon={TrendingUp}
              tone="success"
              hint={<span>Margin <span className="font-medium text-foreground">{formatPercent(kpis.cur.marginBps)}</span> on {formatMoney(kpis.cur.revenue)} revenue</span>}
              href="/reports?tab=profit"
            />
            <KpiCard label="Total products" value={formatNumber(kpis.stock.active)} icon={Package} tone="neutral" hint={`${kpis.stock.inStock} in stock`} href="/products" />
            <div data-testid="kpi-low-stock" className="[&>a]:h-full">
              <KpiCard
                label="Low-stock products"
                value={formatNumber(kpis.stock.low + kpis.stock.out)}
                icon={AlertTriangle}
                tone={kpis.stock.out > 0 ? "destructive" : "warning"}
                hint={`${kpis.stock.low} low · ${kpis.stock.out} out of stock`}
                href="/inventory?status=low_stock"
              />
            </div>
            <KpiCard
              label="Expiring products"
              value={formatNumber(kpis.expiringProducts)}
              icon={CalendarClock}
              tone="warning"
              hint={`${kpis.expiringBatches} batch${kpis.expiringBatches === 1 ? "" : "es"} ≤ 7 days${kpis.expiredBatches ? ` · ${kpis.expiredBatches} expired` : ""}`}
              href="/inventory/expiry"
            />
          </>
        )}
      </div>

      {/* Trend charts */}
      {refreshing ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartSkeleton className="lg:col-span-2" />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <SalesTrendCard range={range} rangeText={rangeText} />
          <WeekComparisonCard />
        </div>
      )}

      {refreshing ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ChartSkeleton height={220} />
          <ChartSkeleton height={220} />
          <ChartSkeleton height={220} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="lg:col-span-2 xl:col-span-1 [&>*]:h-full">
            <TopProductsCard range={range} />
          </div>
          <CategorySalesCard range={range} />
          <PaymentMixCard range={range} />
        </div>
      )}

      {/* AI insights */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <Sparkles className="size-4 text-primary" />
            AI business insights
          </h2>
          <Button asChild variant="ghost" size="sm" className="text-primary">
            <Link href="/ai-assistant">
              Ask the assistant
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <AiInsightCards limit={4} />
      </section>

      {/* Operational lists */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 2xl:col-span-1">
          <RecentSales />
        </div>
        <LowStockList />
        <ExpiryAlerts />
      </div>
    </div>
  );
}
