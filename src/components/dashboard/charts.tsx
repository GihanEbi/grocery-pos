"use client";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS, ChartLegend, ChartTooltip, moneyTick } from "@/components/shared/chart";
import { formatMoney, formatMoneyCompact, formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";

/**
 * Chart primitives shared by the dashboard, reports and expenses screens.
 * Every color is a CSS variable (or an entity color from the data), so charts
 * restyle with the theme. One y-axis per chart; thin marks; recessive grid.
 */

export const PAYMENT_COLORS: Record<string, string> = {
  cash: CHART_COLORS[0],
  card: CHART_COLORS[1],
  qr: CHART_COLORS[3],
};

const axisProps = { tickLine: false, axisLine: false, tickMargin: 8 } as const;
const barCursor = { fill: "var(--muted)", opacity: 0.6 };

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

/** Smooth area chart for trends over time (money values). */
export function TrendAreaChart({ data, xKey, series, height = 260, money = true }: { data: object[]; xKey: string; series: SeriesDef[]; height?: number; money?: boolean }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <div className="space-y-3">
      {series.length > 1 && <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.22 }} />
                  <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey={xKey} {...axisProps} minTickGap={16} />
            <YAxis {...axisProps} width={48} tickFormatter={money ? moneyTick : (v: number) => formatNumber(v)} />
            <Tooltip content={<ChartTooltip money={money} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#${id}-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                animationDuration={600}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Vertical grouped bars (e.g. this week vs last week). */
export function GroupedBarChart({ data, xKey, series, height = 260, money = true, stacked = false }: { data: object[]; xKey: string; series: SeriesDef[]; height?: number; money?: boolean; stacked?: boolean }) {
  return (
    <div className="space-y-3">
      {series.length > 1 && <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap={stacked ? "28%" : "22%"}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey={xKey} {...axisProps} minTickGap={8} />
            <YAxis {...axisProps} width={48} tickFormatter={money ? moneyTick : (v: number) => formatNumber(v)} />
            <Tooltip content={<ChartTooltip money={money} />} cursor={barCursor} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={s.color}
                maxBarSize={stacked ? 36 : 22}
                stackId={stacked ? "a" : undefined}
                radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
                stroke={stacked ? "var(--card)" : undefined}
                strokeWidth={stacked ? 1 : 0}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TruncTick({ x, y, payload, max = 16 }: { x?: number; y?: number; payload?: { value: string }; max?: number }) {
  const v = payload?.value ?? "";
  const text = v.length > max ? `${v.slice(0, max - 1)}…` : v;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" className="recharts-text" style={{ fontSize: 12 }}>
      <title>{v}</title>
      {text}
    </text>
  );
}

/** Horizontal ranked bars (top products, categories). */
export function HBarChart({ data, color = CHART_COLORS[0], money = true, valueLabel = "Revenue", labelWidth = 120, rowHeight = 34 }: { data: { name: string; value: number; color?: string }[]; color?: string; money?: boolean; valueLabel?: string; labelWidth?: number; rowHeight?: number }) {
  const height = Math.max(120, data.length * rowHeight + 16);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" {...axisProps} tickFormatter={money ? moneyTick : (v: number) => formatNumber(v)} />
          <YAxis type="category" dataKey="name" {...axisProps} width={labelWidth} tick={<TruncTick max={Math.floor(labelWidth / 7)} />} interval={0} />
          <Tooltip content={<ChartTooltip money={money} />} cursor={barCursor} />
          <Bar dataKey="value" name={valueLabel} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
  /** Optional secondary line in the legend / tooltip, e.g. "42 payments". */
  meta?: string;
}

function DonutTooltip({ active, payload, total, money }: { active?: boolean; payload?: { payload?: DonutDatum }[]; total: number; money: boolean }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  const share = total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0;
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-elevated">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
        <span className="size-2 rounded-full" style={{ background: d.color }} />
        {d.name}
      </p>
      <p className="tabular text-foreground">{money ? formatMoney(d.value) : formatNumber(d.value)} <span className="text-muted-foreground">· {share}%</span></p>
      {d.meta && <p className="mt-0.5 text-muted-foreground">{d.meta}</p>}
    </div>
  );
}

/** Donut with a centered total and a value legend beside/below it. */
export function DonutChart({ data, centerLabel = "Total", money = true, size = 180, className, legendLimit = 6 }: { data: DonutDatum[]; centerLabel?: string; money?: boolean; size?: number; className?: string; legendLimit?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const visible = data.filter((d) => d.value > 0);
  const legend = data.slice(0, legendLimit);
  return (
    <div className={cn("flex flex-col items-center gap-5 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<DonutTooltip total={total} money={money} />} />
            <Pie
              data={visible.length ? visible : [{ name: "None", value: 1, color: "var(--muted)" }]}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={visible.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {(visible.length ? visible : [{ color: "var(--muted)" }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted-foreground">{centerLabel}</span>
          <span className="text-base font-semibold tracking-tight tabular">{money ? formatMoneyCompact(total) : formatNumber(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {legend.map((d) => {
          const share = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <li key={d.name} className="flex items-center gap-2 text-[13px]">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {d.name}
                {d.meta && <span className="ml-1 text-xs text-muted-foreground/80">· {d.meta}</span>}
              </span>
              <span className="tabular font-medium">{money ? formatMoneyCompact(d.value) : formatNumber(d.value)}</span>
              <span className="w-11 text-right text-xs tabular text-muted-foreground">{share.toFixed(share >= 10 || share === 0 ? 0 : 1)}%</span>
            </li>
          );
        })}
        {data.length > legendLimit && <li className="text-xs text-muted-foreground">+{data.length - legendLimit} more</li>}
      </ul>
    </div>
  );
}

/** Thin horizontal share bar used in breakdown lists. */
export function ShareBar({ value, color, className }: { value: number; color: string; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

/** Small "no data" placeholder sized like a chart. */
export function ChartEmpty({ height = 220, message = "No data for this period." }: { height?: number; message?: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed text-[13px] text-muted-foreground" style={{ height }}>
      {message}
    </div>
  );
}
