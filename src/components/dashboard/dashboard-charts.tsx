"use client";
import * as React from "react";
import { differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";
import { ChartCard, CHART_COLORS } from "@/components/shared/chart";
import { useAppStore } from "@/store/app-store";
import {
  categoryPerformance,
  dailySeries,
  paymentBreakdown,
  rangeFromPreset,
  topProducts,
  weekComparison,
  type DateRange,
} from "@/lib/analytics";
import { formatMoney, formatNumber } from "@/lib/formatting";
import { ChartEmpty, DonutChart, GroupedBarChart, HBarChart, PAYMENT_COLORS, TrendAreaChart } from "./charts";

/** Trend charts need several points: single-day ranges fall back to the last 14 days. */
function trendRange(range: DateRange): { range: DateRange; fallback: boolean } {
  if (differenceInCalendarDays(range.to, range.from) < 1) {
    const to = endOfDay(new Date());
    return { range: { from: startOfDay(subDays(to, 13)), to }, fallback: true };
  }
  return { range, fallback: false };
}

export function SalesTrendCard({ range, rangeText }: { range: DateRange; rangeText: string }) {
  const sales = useAppStore((s) => s.sales);
  const returns = useAppStore((s) => s.returns);
  const t = React.useMemo(() => trendRange(range), [range]);
  const data = React.useMemo(() => dailySeries(sales, returns, t.range), [sales, returns, t.range]);
  const hasData = data.some((d) => d.sales > 0);
  return (
    <ChartCard title="Sales trend" description={t.fallback ? "Last 14 days · sales and gross profit" : `${rangeText} · sales and gross profit`} className="lg:col-span-2">
      {hasData ? (
        <TrendAreaChart
          data={data}
          xKey="label"
          height={270}
          series={[
            { key: "sales", label: "Sales", color: CHART_COLORS[0] },
            { key: "profit", label: "Gross profit", color: CHART_COLORS[1] },
          ]}
        />
      ) : (
        <ChartEmpty height={270} />
      )}
    </ChartCard>
  );
}

export function WeekComparisonCard() {
  const sales = useAppStore((s) => s.sales);
  const data = React.useMemo(() => weekComparison(sales), [sales]);
  const thisTotal = data.reduce((a, d) => a + (d.thisWeek ?? 0), 0);
  const lastTotal = data.reduce((a, d) => a + d.lastWeek, 0);
  return (
    <ChartCard
      title="Weekly revenue"
      description={`This week ${formatMoney(thisTotal)} · last week ${formatMoney(lastTotal)}`}
    >
      <GroupedBarChart
        data={data}
        xKey="day"
        height={270}
        series={[
          { key: "lastWeek", label: "Last week", color: CHART_COLORS[5] },
          { key: "thisWeek", label: "This week", color: CHART_COLORS[0] },
        ]}
      />
    </ChartCard>
  );
}

export function TopProductsCard({ range }: { range: DateRange }) {
  const sales = useAppStore((s) => s.sales);
  const { rows, fallback } = React.useMemo(() => {
    const inRange = topProducts(sales, range, 6, "revenue");
    if (inRange.length) return { rows: inRange, fallback: false };
    return { rows: topProducts(sales, rangeFromPreset("last7"), 6, "revenue"), fallback: true };
  }, [sales, range]);
  return (
    <ChartCard title="Top-selling products" description={fallback ? "No sales in the selected range — showing the last 7 days" : "Top 6 by revenue (ex-tax)"}>
      {rows.length ? (
        <HBarChart data={rows.map((r) => ({ name: r.name, value: r.revenue }))} labelWidth={124} />
      ) : (
        <ChartEmpty />
      )}
    </ChartCard>
  );
}

export function CategorySalesCard({ range }: { range: DateRange }) {
  const sales = useAppStore((s) => s.sales);
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const data = React.useMemo(() => {
    const rows = categoryPerformance(sales, products, categories, range).filter((c) => c.revenue > 0);
    const top = rows.slice(0, 5).map((c, i) => ({ name: c.name, value: c.revenue, color: CHART_COLORS[i] }));
    const rest = rows.slice(5).reduce((a, c) => a + c.revenue, 0);
    return rest > 0 ? [...top, { name: "Other", value: rest, color: "var(--chart-6)" }] : top;
  }, [sales, products, categories, range]);
  return (
    <ChartCard title="Sales by category" description="Revenue share (ex-tax)">
      {data.length ? <DonutChart data={data} size={164} className="xl:flex-col 2xl:flex-row" /> : <ChartEmpty />}
    </ChartCard>
  );
}

export function PaymentMixCard({ range }: { range: DateRange }) {
  const sales = useAppStore((s) => s.sales);
  const rows = React.useMemo(() => paymentBreakdown(sales, range), [sales, range]);
  const count = rows.reduce((a, r) => a + r.count, 0);
  return (
    <ChartCard title="Payment methods" description={`${formatNumber(count)} payment${count === 1 ? "" : "s"} in range`}>
      {count ? (
        <DonutChart
          size={164}
          className="xl:flex-col 2xl:flex-row"
          centerLabel="Collected"
          data={rows.map((r) => ({ name: r.label, value: r.amount, color: PAYMENT_COLORS[r.method], meta: `${r.count} txn` }))}
        />
      ) : (
        <ChartEmpty />
      )}
    </ChartCard>
  );
}
