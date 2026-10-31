import { endOfDay, format, startOfDay, startOfMonth, startOfWeek, subDays, subMonths, differenceInCalendarDays } from "date-fns";
import type { Product, ProductUnit, Sale } from "@/types";
import type { AppData } from "@/types/data";
import {
  categoryPerformance,
  dailySeries,
  expenseTotal,
  expensesByCategory,
  expiryRows,
  paymentBreakdown,
  percentChange,
  previousRange,
  productPerformance,
  productStockStatus,
  rangeFromPreset,
  reorderSuggestions,
  salesInRange,
  slowMovers,
  stockCounts,
  summarize,
  topProducts,
  unitsSold,
  weekComparison,
  type DateRange,
  type RangePreset,
  type ReorderSuggestion,
} from "@/lib/analytics";
import { inventoryRetailValue, inventoryValue } from "@/lib/calculations/inventory";
import { multiply, sum } from "@/lib/calculations/money";
import { dailyVelocity } from "@/lib/calculations/forecasting";
import { canAccessRoute } from "@/lib/permissions";
import { formatMoney, formatNumber, formatPercent, formatQty } from "@/lib/formatting";
import { EXPENSE_CATEGORIES } from "@/config/defaults";
import { sleep } from "@/lib/utils";
import type { AiContext, AiProvider } from "./provider";
import type { AiAction, AiBlock, AiIntent, AiKpi, AiReorderLine, AiResponse } from "./types";
import { draftPoHref } from "./links";
import { dailySummary } from "./insights";

/* ========================================================================== *
 * Period parsing
 * ========================================================================== */

export type PeriodKind = RangePreset | "lastWeek" | "lastNDays";

export interface PeriodToken {
  kind: PeriodKind;
  /** Only for `lastNDays`. */
  days?: number;
}

export interface ResolvedPeriod extends PeriodToken {
  range: DateRange;
  /** "Today", "This week", "Last 14 days"… */
  label: string;
}

/** Lower-cases, unifies quotes/hyphens and strips punctuation so regexes stay simple. */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\bre-?order/g, "reorder")
    .replace(/\bout-of-stock\b/g, "out of stock")
    .replace(/[-_/]/g, " ")
    .replace(/[^a-z0-9%' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, fourteen: 14, thirty: 30 };

/** Finds a relative period ("today", "this week", "last 14 days"…) in a normalized question. */
export function parsePeriod(nq: string): PeriodToken | null {
  const nDays = nq.match(/\b(?:last|past|previous)\s+(\d{1,3}|two|three|four|five|six|seven|ten|fourteen|thirty)\s+days?\b/);
  if (nDays) {
    const n = Number(nDays[1]) || NUMBER_WORDS[nDays[1]!] || 7;
    if (n === 7) return { kind: "last7" };
    if (n === 30) return { kind: "last30" };
    if (n === 1) return { kind: "yesterday" };
    return { kind: "lastNDays", days: Math.min(n, 365) };
  }
  const nWeeks = nq.match(/\b(?:last|past|previous)\s+(\d{1,2}|two|three|four)\s+weeks?\b/);
  if (nWeeks) {
    const n = Number(nWeeks[1]) || NUMBER_WORDS[nWeeks[1]!] || 1;
    return { kind: "lastNDays", days: n * 7 };
  }
  if (/\b(today|todays|today's|tonight|so far)\b/.test(nq)) return { kind: "today" };
  if (/\b(yesterday|yesterdays|yesterday's)\b/.test(nq)) return { kind: "yesterday" };
  if (/\b(this weeks?|this week's|week to date|wtd)\b/.test(nq)) return { kind: "thisWeek" };
  if (/\b(last|previous) weeks?\b/.test(nq)) return { kind: "lastWeek" };
  if (/\b(past|recent) week\b/.test(nq)) return { kind: "last7" };
  if (/\b(this months?|this month's|month to date|mtd)\b/.test(nq)) return { kind: "thisMonth" };
  if (/\b(last|previous) month\b/.test(nq)) return { kind: "lastMonth" };
  if (/\b(past|recent) month\b/.test(nq)) return { kind: "last30" };
  if (/\b(all time|ever|overall|since (we )?(started|opened)|this year|ytd)\b/.test(nq)) return { kind: "all" };
  return null;
}

const PERIOD_LABEL: Record<Exclude<PeriodKind, "lastNDays">, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thisWeek: "This week",
  thisMonth: "This month",
  lastMonth: "Last month",
  lastWeek: "Last week",
  all: "All time",
};

export function resolvePeriod(token: PeriodToken, now: Date, data?: Pick<AppData, "sales">): ResolvedPeriod {
  if (token.kind === "lastNDays") {
    const days = token.days ?? 7;
    return { ...token, label: `Last ${days} days`, range: { from: startOfDay(subDays(now, days - 1)), to: endOfDay(now) } };
  }
  if (token.kind === "lastWeek") {
    const thisStart = startOfWeek(now, { weekStartsOn: 1 });
    return { ...token, label: PERIOD_LABEL.lastWeek, range: { from: subDays(thisStart, 7), to: endOfDay(subDays(thisStart, 1)) } };
  }
  let range = rangeFromPreset(token.kind, now);
  if (token.kind === "all" && data?.sales.length) {
    // Clamp "all time" to the first recorded sale so charts stay compact.
    const first = data.sales.reduce((min, s) => (s.date < min ? s.date : min), data.sales[0]!.date);
    range = { from: startOfDay(new Date(first)), to: range.to };
  }
  return { ...token, label: PERIOD_LABEL[token.kind], range };
}

/* ========================================================================== *
 * Intent classification
 * ========================================================================== */

type Rule = [RegExp, number];

const SALES_WORDS = /\b(sales?|sell|selling|sold|revenue|turnover|takings|income|earn|earned|make|made|bills?|transactions?|business)\b/;

/**
 * Keyword/regex scoring rules. Each matching pattern adds its weight; the
 * highest total wins (ties go to the earlier intent in this list).
 */
const RULES: [Exclude<AiIntent, "fallback" | "sales_today" | "sales_yesterday" | "sales_period">, Rule[]][] = [
  ["help", [[/\bhelp\b/, 4], [/\bwhat (can|do|could) you (do|know|answer|help)/, 6], [/\bwhat (questions|can i ask|should i ask)/, 6], [/\b(capabilities|features|examples?)\b/, 3], [/\b(who|what) are you\b/, 6], [/\bhow (do|does) (this|you) work\b/, 6]]],
  ["sales_compare_week", [[/\b(compare|comparison|compared|vs|versus|against|than)\b.*\bweeks?\b|\bweeks?\b.*\b(compare|comparison|compared|vs|versus|against|than)\b/, 8], [/\bthis weeks?\b.*\blast weeks?\b|\blast weeks?\b.*\bthis weeks?\b/, 8], [/\bweek (over|on) week\b|\bwow\b/, 8]]],
  ["top_customers", [[/\b(best|top|biggest|loyal|most loyal|vip|regular|frequent|highest spending|repeat) (customers?|shoppers?|buyers?)\b/, 9], [/\bwho (spends?|spent|buys?|bought|shops?) (the )?most\b/, 8], [/\bcustomers?\b/, 3], [/\bloyalty\b/, 3]]],
  ["top_categories", [[/\bcategor(y|ies)\b/, 7], [/\bdepartments?\b/, 5], [/\baisles?\b/, 2]]],
  ["top_margin", [[/\b(highest|best|top|biggest|most|high|largest|lowest|worst|low|better|good) (profit )?margins?\b/, 6], [/\bmost profitable\b/, 6], [/\bmargins? (by|per|for each) (product|item)/, 5], [/\b(products?|items?)\b.*\bmargins?\b/, 4], [/\bmargins?\b/, 2]]],
  ["gross_profit", [[/\bgross profit\b/, 5], [/\bprofit(s|ability)?\b/, 3], [/\bcogs\b|\bcost of goods\b/, 3], [/\bnet profit\b/, 4], [/\bmargin\b/, 1]]],
  ["payment_breakdown", [[/\bpayment (methods?|types?|modes?|split|mix|breakdown|options?)\b/, 7], [/\bpay(ments?)?\b/, 3], [/\b(cash|card|qr)\b.*\b(cash|card|qr)\b/, 5], [/\bhow (do|did|does) (customers|people|they|shoppers) pay\b/, 7], [/\b(card|qr|cash|cashless|digital) (payments?|sales|transactions)\b/, 5]]],
  ["slow_moving", [[/\bslow\s*(moving|movers?|sellers?|selling)\b/, 8], [/\b(not|isn't|aren't|never|nothing) (selling|sold|moving)\b/, 7], [/\bno sales\b/, 5], [/\bdead stock\b/, 8], [/\b(selling|sells?|sold|moving) (the )?least\b/, 8], [/\b(least|worst) (selling|sellers?|performing|popular|sold)\b/, 8], [/\bhaven'?t (sold|moved)\b/, 7], [/\bover ?stock(ed)?\b/, 4], [/\bslow\b/, 2]]],
  ["out_of_stock", [[/\bout of stock\b/, 6], [/\bsold out\b/, 6], [/\b(zero|no|empty) stock\b/, 5], [/\bstock ?outs?\b/, 6], [/\bran out\b/, 5], [/\bunavailable\b/, 2]]],
  ["low_stock", [[/\blow (on )?(stock|inventory)\b/, 5], [/\bstock (is |are |levels? )?(running )?low\b/, 5], [/\brunning (low|out)\b/, 4], [/\bbelow (the |their )?(minimum|min|reorder)\b/, 5], [/\b(minimum|min) (stock|level)s?\b/, 2], [/\blow\b/, 1], [/\bstock levels?\b/, 1]]],
  ["expiring", [[/\bexpir/, 5], [/\bbest before\b/, 5], [/\bshelf life\b/, 4], [/\b(go(ing)? bad|spoil(ing|ed)?|perish(able)?|stale|rotting)\b/, 4], [/\bwrite ?offs?\b/, 2]]],
  ["reorder", [[/\breorder/, 6], [/\breplenish/, 6], [/\brestock/, 5], [/\bwhat (should|do|must|to) (i|we)? ?(order|buy|purchase)\b/, 6], [/\bneeds? (to be )?(ordered|ordering)\b/, 5], [/\border (more|again)\b/, 4], [/\bpurchase orders?\b|\bdraft po\b/, 4], [/\bsuggested (order|quantit|qty)/, 5], [/\bbuy more\b/, 4], [/\b(forecast|demand)\b/, 2]]],
  ["inventory_value", [[/\b(inventory|stock) (value|valuation|worth)\b/, 8], [/\bvalue of (our |the |my |all )?(inventory|stock)\b/, 8], [/\b(inventory|stock) (is )?worth\b/, 8], [/\bhow much (is )?(our |the |my )?(inventory|stock)( worth)?\b/, 5], [/\bworth\b/, 2], [/\bvaluation\b/, 4], [/\bcapital (tied|locked)\b/, 5]]],
  ["top_products", [[/\b(top|best)\s*(selling|sellers?|products?|items?|performers?|performing)\b/, 5], [/\b(most|highest) (popular|sold|selling|sales|demand)\b/, 5], [/\bsells? (the )?most\b|\bselling (the )?most\b/, 5], [/\bpopular\b/, 3], [/\bwhat sells\b/, 4], [/\bfast(est)? (moving|movers|selling)\b/, 5], [/\btop \d+\b/, 2], [/\btop \d+ (products?|items?|sellers?)\b/, 4]]],
  ["expenses", [[/\bexpenses?\b/, 7], [/\b(spend|spending|spent|outgoings?|overheads?|operating costs?)\b/, 4], [/\b(rent|electricity|water bill|salar(y|ies)|wages|utilit(y|ies)|transport(ation)?)\b/, 4], [/\bcosts?\b/, 1]]],
  ["daily_summary", [[/\b(daily|day'?s?|todays|today's|end of day|eod|morning) (summary|report|brief(ing)?|recap|overview|update)\b/, 8], [/\bsummar(y|ise|ize)\b/, 6], [/\bhow (are|is|did|was) (we|business|things|it|the (shop|store|business|day))( doing| going| look(ing)?| today)?\b/, 6], [/\b(overview|recap|brief(ing)?|snapshot|highlights)\b/, 4], [/\bwhat'?s (happening|new|going on)\b/, 4], [/\bkey (numbers|metrics|kpis)\b/, 5], [/\bwhat should (i|we) (focus on|do today|look at|prioriti[sz]e)\b/, 6]]],
  ["greeting", [[/^(hi|hello|hey|hiya|yo|good (morning|afternoon|evening)|ayubowan|vanakkam|greetings|howdy)\b/, 3], [/^(thanks|thank you|cheers|great|ok|okay|nice)\b/, 3]]],
];

export interface IntentMatch {
  intent: AiIntent;
  score: number;
  period: PeriodToken | null;
  /** Scores of every intent that matched at least one pattern (for debugging/tests). */
  scores: Partial<Record<AiIntent, number>>;
}

/** Deterministically maps a free-text question to one of the supported intents. */
export function classifyIntent(question: string): IntentMatch {
  const nq = normalizeQuestion(question);
  const period = parsePeriod(nq);
  const words = nq ? nq.split(" ").length : 0;
  const scores: Partial<Record<AiIntent, number>> = {};

  for (const [intent, rules] of RULES) {
    let s = 0;
    for (const [re, w] of rules) if (re.test(nq)) s += w;
    // Greetings/thanks only win on short messages ("hi", "thanks!").
    if (intent === "greeting" && words > 5) s = Math.min(s, 1);
    if (s > 0) scores[intent] = s;
  }

  // Sales questions share one scorer; the period decides today / yesterday / custom range.
  let salesScore = 0;
  if (SALES_WORDS.test(nq)) salesScore += 3;
  if (/\bhow much (did|have|do) we (sell|sold|make|made|take|taken|earn|do)\b/.test(nq)) salesScore += 2;
  if (/\bhow (did|was|were) (we|sales|business)\b.*\b(do|doing|go|going)?/.test(nq) && period) salesScore += 2;
  if (period && salesScore > 0) salesScore += 1;
  const salesIntent: AiIntent = !period || period.kind === "today" ? "sales_today" : period.kind === "yesterday" ? "sales_yesterday" : "sales_period";
  if (salesScore > 0) scores[salesIntent] = salesScore;

  let best: AiIntent = "fallback";
  let bestScore = 0;
  for (const [intent, s] of Object.entries(scores) as [AiIntent, number][]) {
    if (s > bestScore) {
      best = intent;
      bestScore = s;
    }
  }

  // "How did we do this week?" is a sales question, not a daily summary.
  if (best === "daily_summary" && period && period.kind !== "today") best = salesIntent;
  // A bare period ("last 7 days", "yesterday?") means sales for that period.
  if (bestScore < 2 && period) {
    best = salesIntent;
    bestScore = 2;
  }
  if (bestScore < 2) best = "fallback";
  return { intent: best, score: bestScore, period, scores };
}

/* ========================================================================== *
 * Helpers
 * ========================================================================== */

type Draft = Omit<AiResponse, "intent">;
type Handler = (q: string, ctx: AiContext, period: ResolvedPeriod | null, lk: Lookups) => Draft;

interface Lookups {
  product: Map<string, Product>;
  supplierName: (id: string | null) => string;
  categoryOf: (productId: string) => { name: string; icon: string } | null;
}

function buildLookups(data: AppData): Lookups {
  const product = new Map(data.products.map((p) => [p.id, p]));
  const suppliers = new Map(data.suppliers.map((s) => [s.id, s.name]));
  const categories = new Map(data.categories.map((c) => [c.id, c]));
  return {
    product,
    supplierName: (id) => (id ? suppliers.get(id) ?? "Unknown supplier" : "No supplier assigned"),
    categoryOf: (pid) => {
      const c = categories.get(product.get(pid)?.categoryId ?? "");
      return c ? { name: c.name, icon: c.icon } : null;
    },
  };
}

const pct = (n: number) => `${n > 0 ? "+" : ""}${n}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;
const lower1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const listNames = (names: string[], max = 3) => {
  const shown = names.slice(0, max).map((n) => `**${n}**`);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
};
const changeTone = (c: number | null, invert = false): AiKpi["tone"] => (c === null || c === 0 ? "default" : (c > 0) !== invert ? "good" : "bad");
const shareBps = (part: number, total: number) => (total > 0 ? Math.round((part * 10000) / total) : 0);
const productHref = (p?: Product | null) => (p ? `/products?q=${encodeURIComponent(p.sku)}` : "/products");
const unitOf = (u: string) => u as ProductUnit;

function daysLeftLabel(days: number) {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function coverLabel(days: number) {
  if (!Number.isFinite(days) || days >= 999) return "—";
  return `${days.toFixed(days < 10 ? 1 : 0)} d`;
}

function periodPhrase(p: ResolvedPeriod) {
  if (p.kind === "today") return "today";
  if (p.kind === "yesterday") return "yesterday";
  if (p.kind === "all") return "since the first recorded sale";
  return `in the ${lower1(p.label)} (${format(p.range.from, "dd MMM")} – ${format(p.range.to, "dd MMM")})`;
}

/** Like-for-like comparison range: partial periods compare to the same point in the previous one. */
function comparisonRange(p: ResolvedPeriod, now: Date): { range: DateRange; label: string } {
  switch (p.kind) {
    case "today":
      return { range: { from: startOfDay(subDays(now, 1)), to: subDays(now, 1) }, label: "the same time yesterday" };
    case "yesterday":
      return { range: previousRange(p.range), label: "the day before" };
    case "thisWeek":
      return { range: { from: subDays(p.range.from, 7), to: subDays(now, 7) }, label: "the same point last week" };
    case "thisMonth":
      return { range: { from: startOfMonth(subMonths(now, 1)), to: subMonths(now, 1) }, label: "the same point last month" };
    case "lastWeek":
      return { range: previousRange(p.range), label: "the week before" };
    case "lastMonth":
      return { range: { from: startOfMonth(subMonths(p.range.from, 1)), to: subDays(p.range.from, 1) }, label: "the month before" };
    default: {
      const days = differenceInCalendarDays(p.range.to, p.range.from) + 1;
      return { range: previousRange(p.range), label: `the previous ${days} days` };
    }
  }
}

function changeSentence(change: number | null, label: string, prevValue: number) {
  if (change === null) return `There were no sales in ${label} to compare with.`;
  if (change === 0) return `That's flat vs ${label}.`;
  return `That's **${change > 0 ? "up" : "down"} ${Math.abs(change)}%** vs ${label} (${formatMoney(prevValue)}).`;
}

function toReorderLines(list: ReorderSuggestion[], lk: Lookups): AiReorderLine[] {
  return list.map((s) => ({
    productId: s.product.id,
    name: s.product.name,
    image: s.product.image,
    supplierId: s.supplier?.id ?? null,
    supplierName: s.supplier?.name ?? lk.supplierName(null),
    stock: s.stock,
    unit: s.product.unit,
    velocity: s.dailyVelocity,
    // Infinity is not JSON-safe (the chat history is persisted) → 999 means "no recent sales".
    daysOfCover: Number.isFinite(s.daysOfCover) ? s.daysOfCover : 999,
    suggestedQty: s.suggestedQty,
    priority: s.priority,
    estimatedCost: s.estimatedCost,
  }));
}

/** Largest supplier group (by estimated cost) → a "Create draft PO" action. */
function bestSupplierAction(lines: AiReorderLine[]): AiAction | null {
  const groups = new Map<string, AiReorderLine[]>();
  for (const l of lines) if (l.supplierId) groups.set(l.supplierId, [...(groups.get(l.supplierId) ?? []), l]);
  const top = [...groups.values()].sort((a, b) => sum(b.map((l) => l.estimatedCost)) - sum(a.map((l) => l.estimatedCost)))[0];
  if (!top) return null;
  return { label: `Draft PO · ${top[0]!.supplierName}`, href: draftPoHref(top[0]!.supplierId, top), variant: "default" };
}

/* ========================================================================== *
 * Intent handlers — every number comes from @/lib/analytics or @/lib/calculations.
 * ========================================================================== */

const salesHandler: Handler = (_q, ctx, period) => {
  const { data, now } = ctx;
  const p = period ?? resolvePeriod({ kind: "today" }, now, data);
  const cur = summarize(data.sales, data.returns, p.range);
  const cmp = comparisonRange(p, now);
  const prev = summarize(data.sales, data.returns, cmp.range);
  const change = percentChange(cur.netSales, prev.netSales);
  const txChange = percentChange(cur.transactions, prev.transactions);
  const singleDay = p.kind === "today" || p.kind === "yesterday";

  const blocks: AiBlock[] = [
    {
      type: "kpis",
      items: [
        { label: "Net sales", value: formatMoney(cur.netSales), change, tone: changeTone(change) },
        { label: "Transactions", value: formatNumber(cur.transactions), change: txChange, tone: changeTone(txChange) },
        { label: "Avg. basket", value: formatMoney(cur.avgBasket) },
        { label: "Gross profit", value: formatMoney(cur.grossProfit), tone: cur.grossProfit > 0 ? "good" : "default" },
      ],
    },
  ];

  let text: string;
  if (cur.transactions === 0) {
    text = `No sales have been recorded ${periodPhrase(p)} yet.`;
  } else {
    const lead = p.kind === "today" ? "So far today you've taken" : p.kind === "yesterday" ? "Yesterday you took" : `${periodPhrase(p).replace(/^./, (c) => c.toUpperCase())} you took`;
    text = `${lead} **${formatMoney(cur.netSales)}** in net sales from **${plural(cur.transactions, "transaction")}** (average basket ${formatMoney(cur.avgBasket)}). ${changeSentence(change, cmp.label, prev.netSales)}`;
    if (cur.refunds > 0) text += ` Refunds of ${formatMoney(cur.refunds)} are already deducted.`;
    text += ` Gross profit is ${formatMoney(cur.grossProfit)} (${formatPercent(cur.marginBps)} margin).`;
  }

  if (singleDay) {
    const top = topProducts(data.sales, p.range, 5);
    if (top.length)
      blocks.push({
        type: "table",
        title: `Top products ${p.kind === "today" ? "today" : "yesterday"}`,
        table: {
          columns: [{ key: "product", label: "Product" }, { key: "qty", label: "Sold", align: "right" }, { key: "revenue", label: "Revenue", align: "right" }],
          rows: top.map((t) => ({ product: t.name, qty: formatQty(t.qty, unitOf(t.unit)), revenue: formatMoney(t.revenue) })),
        },
      });
  } else if (cur.transactions > 0) {
    const series = dailySeries(data.sales, data.returns, p.range);
    blocks.push({ type: "chart", title: "Daily sales", money: true, valueLabel: "Sales", data: series.slice(-31).map((d) => ({ label: d.label, value: d.sales })) });
  }

  const ask = p.kind === "today" ? "today" : p.kind === "yesterday" ? "yesterday" : lower1(p.label);
  return {
    text,
    blocks,
    actions: [
      { label: "View sales history", href: "/sales", variant: "default" },
      { label: "Open sales report", href: "/reports?tab=sales", variant: "outline" },
    ],
    followUps: [
      `What are the top-selling products ${ask}?`,
      p.kind === "today" ? "Compare this week's sales with last week" : `How much gross profit did we make ${ask}?`,
      p.kind === "today" ? "Give me today's daily summary" : "Which payment methods did customers use?",
    ],
  };
};

const compareWeekHandler: Handler = (_q, ctx) => {
  const { data, now } = ctx;
  const days = weekComparison(data.sales, now);
  const thisStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeek = summarize(data.sales, data.returns, { from: thisStart, to: now });
  const lastSameRange = { from: subDays(thisStart, 7), to: subDays(now, 7) };
  const lastSame = summarize(data.sales, data.returns, lastSameRange);
  const lastFull = summarize(data.sales, data.returns, { from: subDays(thisStart, 7), to: endOfDay(subDays(thisStart, 1)) });
  const change = percentChange(thisWeek.netSales, lastSame.netSales);
  const txChange = percentChange(thisWeek.transactions, lastSame.transactions);
  const gpChange = percentChange(thisWeek.grossProfit, lastSame.grossProfit);
  const elapsed = days.filter((d) => d.thisWeek !== null);
  const bestDay = [...elapsed].sort((a, b) => (b.thisWeek ?? 0) - (a.thisWeek ?? 0))[0];
  const dayRange = elapsed.length > 1 ? `${elapsed[0]!.day}–${elapsed[elapsed.length - 1]!.day}` : elapsed[0]?.day ?? "Mon";

  let text = `This week so far (${dayRange}) you've sold **${formatMoney(thisWeek.netSales)}** from ${plural(thisWeek.transactions, "transaction")}. `;
  text +=
    change === null
      ? "There were no sales on the same days last week to compare with."
      : `That's **${change >= 0 ? "up" : "down"} ${Math.abs(change)}%** on the same days last week (${formatMoney(lastSame.netSales)}).`;
  text += ` Last week finished at ${formatMoney(lastFull.netSales)} in total.`;
  if (bestDay && (bestDay.thisWeek ?? 0) > 0) text += ` Your strongest day this week is **${bestDay.day}** (${formatMoney(bestDay.thisWeek ?? 0)}).`;

  return {
    text,
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "This week (to date)", value: formatMoney(thisWeek.netSales), change, tone: changeTone(change) },
          { label: "Same days last week", value: formatMoney(lastSame.netSales) },
          { label: "Transactions", value: formatNumber(thisWeek.transactions), change: txChange, tone: changeTone(txChange) },
          { label: "Gross profit", value: formatMoney(thisWeek.grossProfit), change: gpChange, tone: changeTone(gpChange) },
        ],
      },
      { type: "chart", title: "Sales by day: this week vs last week", money: true, valueLabel: "This week", compareLabel: "Last week", data: days.map((d) => ({ label: d.day, value: d.thisWeek ?? 0, compare: d.lastWeek })) },
    ],
    actions: [
      { label: "Open sales report", href: "/reports?tab=sales", variant: "default" },
      { label: "View sales history", href: "/sales", variant: "outline" },
    ],
    followUps: ["What are the top-selling products this week?", "Which categories bring the most revenue?", "How much gross profit did we make this week?"],
  };
};

const topProductsHandler: Handler = (q, ctx, period, lk) => {
  const { data, now } = ctx;
  const p = period ?? resolvePeriod({ kind: "last7" }, now, data);
  const nq = normalizeQuestion(q);
  const by: "revenue" | "qty" | "profit" = /\b(units?|quantity|qty|volume|most sold|how many)\b/.test(nq) ? "qty" : /\bprofit/.test(nq) ? "profit" : "revenue";
  const n = Math.min(15, Math.max(3, Number(nq.match(/\btop (\d{1,2})\b/)?.[1]) || 8));
  const top = topProducts(data.sales, p.range, n, by);
  if (!top.length)
    return { text: `I couldn't find any sales ${periodPhrase(p)}, so there are no top products to show yet.`, blocks: [], actions: [{ label: "View sales history", href: "/sales" }], followUps: ["What are the top-selling products in the last 30 days?", "How much did we sell today?"] };
  const total = summarize(data.sales, data.returns, p.range).revenue;
  const share = shareBps(sum(top.map((t) => t.revenue)), total);
  const lead = top[0]!;
  const metric = (t: (typeof top)[number]) => (by === "qty" ? formatQty(t.qty, unitOf(t.unit)) : formatMoney(by === "profit" ? t.profit : t.revenue));
  const text =
    `Your best seller ${periodPhrase(p)} ${by === "qty" ? "by units" : by === "profit" ? "by gross profit" : "by revenue"} is **${lead.name}** with ${metric(lead)}` +
    (by === "revenue" ? ` from ${formatQty(lead.qty, unitOf(lead.unit))} sold` : "") +
    `, followed by ${listNames(top.slice(1, 3).map((t) => t.name), 2)}. Together the top ${top.length} make up **${formatPercent(share)}** of revenue (excl. tax) in that period.`;
  const leadProduct = lk.product.get(lead.productId);
  return {
    text,
    blocks: [
      {
        type: "table",
        title: `Top ${top.length} products · ${p.label}`,
        table: {
          columns: [
            { key: "rank", label: "#" },
            { key: "product", label: "Product" },
            { key: "qty", label: "Sold", align: "right" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "profit", label: "Profit", align: "right" },
          ],
          rows: top.map((t, i) => ({ rank: i + 1, product: t.name, qty: formatQty(t.qty, unitOf(t.unit)), revenue: formatMoney(t.revenue), profit: formatMoney(t.profit) })),
        },
      },
      { type: "chart", title: by === "qty" ? "Units sold" : by === "profit" ? "Gross profit" : "Revenue (excl. tax)", money: by !== "qty", valueLabel: by === "qty" ? "Units" : by === "profit" ? "Profit" : "Revenue", data: top.slice(0, 6).map((t) => ({ label: t.name.length > 14 ? `${t.name.slice(0, 13)}…` : t.name, value: by === "qty" ? t.qty : by === "profit" ? t.profit : t.revenue })) },
    ],
    actions: [
      { label: `Open ${lead.name}`, href: productHref(leadProduct), variant: "default" },
      { label: "Product report", href: "/reports?tab=products", variant: "outline" },
    ],
    followUps: ["Which products have the highest profit margin?", "Which products are slow moving?", "What should I reorder?"],
  };
};

const lowStockHandler: Handler = (_q, ctx, _p, lk) => {
  const { data, now } = ctx;
  const active = data.products.filter((p) => p.status === "active");
  const low = active.filter((p) => productStockStatus(p) === "low_stock").sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock));
  const out = active.filter((p) => productStockStatus(p) === "out_of_stock");
  const sold = unitsSold(data.sales, 14, now);
  const cover = (p: Product) => {
    const v = dailyVelocity(sold.get(p.id) ?? 0, 14);
    return v > 0 ? Math.round((p.stock / v) * 10) / 10 : 999;
  };
  if (!low.length && !out.length)
    return { text: "All active products are above their minimum stock level. Nothing needs urgent restocking right now.", blocks: [], actions: [{ label: "View inventory", href: "/inventory" }], followUps: ["Which products will expire soon?", "What is our inventory worth?"] };
  const first = low[0];
  let text = `**${plural(low.length, "product")}** ${low.length === 1 ? "is" : "are"} at or below the minimum stock level`;
  text += out.length ? `, and **${formatNumber(out.length)} ${out.length === 1 ? "is" : "are"} completely out of stock**.` : ".";
  if (first) text += ` Most urgent: **${first.name}** with ${formatQty(first.stock, first.unit)} left (minimum ${formatQty(first.minStock, first.unit)}${cover(first) < 999 ? `, about ${coverLabel(cover(first)).replace(" d", " days")} of cover` : ""}).`;
  return {
    text,
    blocks: [
      {
        type: "table",
        title: `Low-stock products${low.length > 10 ? " (10 most urgent)" : ""}`,
        table: {
          columns: [
            { key: "product", label: "Product" },
            { key: "stock", label: "Stock", align: "right" },
            { key: "min", label: "Min", align: "right" },
            { key: "cover", label: "Cover", align: "right" },
            { key: "supplier", label: "Supplier" },
          ],
          rows: low.slice(0, 10).map((p) => ({ product: p.name, stock: formatQty(p.stock, p.unit), min: formatQty(p.minStock, p.unit), cover: coverLabel(cover(p)), supplier: lk.supplierName(p.supplierId) })),
        },
      },
    ],
    actions: [
      { label: "View low-stock items", href: "/inventory?status=low_stock", variant: "default" },
      ...(out.length ? [{ label: "View out-of-stock", href: "/inventory?status=out_of_stock", variant: "outline" as const }] : []),
    ],
    followUps: ["What should I reorder?", "What products are out of stock?", "Which products will expire soon?"],
  };
};

const outOfStockHandler: Handler = (_q, ctx, _p, lk) => {
  const { data, now } = ctx;
  const out = data.products.filter((p) => p.status === "active" && productStockStatus(p) === "out_of_stock");
  if (!out.length)
    return { text: "Good news — no active products are out of stock right now.", blocks: [], actions: [{ label: "View inventory", href: "/inventory" }], followUps: ["Which products are low on stock?", "What should I reorder?"] };
  const sold = unitsSold(data.sales, 14, now);
  const rows = out
    .map((p) => {
      const v = dailyVelocity(sold.get(p.id) ?? 0, 14);
      return { p, v, lost: multiply(p.sellingPrice, v) };
    })
    .sort((a, b) => b.lost - a.lost);
  const lostPerDay = sum(rows.map((r) => r.lost));
  const suggestions = toReorderLines(reorderSuggestions(data.products, data.suppliers, data.sales, now).filter((s) => s.stock <= 0), lk);
  const po = bestSupplierAction(suggestions);
  return {
    text:
      `**${plural(out.length, "product")}** ${out.length === 1 ? "is" : "are"} out of stock: ${listNames(rows.map((r) => r.p.name))}.` +
      (lostPerDay > 0 ? ` Based on the last 14 days they normally sell about **${formatMoney(lostPerDay)} per day** combined, so every day without stock is lost revenue.` : " None of them sold in the last 14 days, so the revenue impact is low."),
    blocks: [
      {
        type: "table",
        title: "Out-of-stock products",
        table: {
          columns: [
            { key: "product", label: "Product" },
            { key: "velocity", label: "Sold / day", align: "right" },
            { key: "lost", label: "Sales at risk / day", align: "right" },
            { key: "supplier", label: "Supplier" },
          ],
          rows: rows.slice(0, 12).map((r) => ({ product: r.p.name, velocity: formatQty(r.v, r.p.unit), lost: formatMoney(r.lost), supplier: lk.supplierName(r.p.supplierId) })),
        },
      },
    ],
    actions: [{ label: "View out-of-stock items", href: "/inventory?status=out_of_stock", variant: "default" }, ...(po ? [{ ...po, variant: "outline" as const }] : [])],
    followUps: ["What should I reorder?", "Which products are low on stock?", "What are the top-selling products?"],
  };
};

const expiringHandler: Handler = (q, ctx) => {
  const { data, now } = ctx;
  const nq = normalizeQuestion(q);
  const windowDays = /\b(today|tomorrow)\b/.test(nq) ? 1 : /\b(month|30 days)\b/.test(nq) ? 30 : /\b(two weeks|14 days|fortnight)\b/.test(nq) ? 14 : 7;
  const rows = expiryRows(data.batches, data.products, now);
  const expired = rows.filter((r) => r.daysLeft < 0);
  const upcoming = rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= windowDays);
  const critical = rows.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 3);
  const upcomingValue = sum(upcoming.map((r) => r.value));
  const expiredValue = sum(expired.map((r) => r.value));
  const first = upcoming[0];
  const windowLabel = windowDays === 1 ? "by tomorrow" : `within the next ${windowDays} days`;

  let text = upcoming.length
    ? `**${plural(upcoming.length, "batch", "batches")}** worth **${formatMoney(upcomingValue)}** at cost expire ${windowLabel}.`
    : `No batches expire ${windowLabel}.`;
  if (first) text += ` Most urgent: **${first.product.name}** (batch ${first.batch.batchNo}, ${formatQty(first.batch.quantity, first.product.unit)}) — ${lower1(daysLeftLabel(first.daysLeft))}.`;
  if (expired.length) text += ` ${plural(expired.length, "expired batch", "expired batches")} (${formatMoney(expiredValue)}) ${expired.length === 1 ? "is" : "are"} still on hand and should be written off so ${expired.length === 1 ? "it isn't" : "they aren't"} sold.`;

  const bullets: string[] = [];
  if (critical.length) bullets.push(`Mark down the ${plural(critical.length, "batch", "batches")} expiring within 3 days and move them to the front shelf.`);
  if (expired.length) bullets.push("Write off expired batches from the Expiry page — this records an 'expired' stock movement.");
  if (upcoming.length) bullets.push("Reduce the next order quantity for items that regularly reach expiry.");

  return {
    text,
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Expired on hand", value: formatNumber(expired.length), tone: expired.length ? "bad" : "good" },
          { label: "Expiring ≤ 3 days", value: formatNumber(critical.length), tone: critical.length ? "warn" : "good" },
          { label: `Expiring ≤ ${windowDays} days`, value: formatNumber(upcoming.length), tone: upcoming.length ? "warn" : "default" },
          { label: "Value at risk (cost)", value: formatMoney(upcomingValue + expiredValue), tone: upcomingValue + expiredValue > 0 ? "warn" : "default" },
        ],
      },
      ...(upcoming.length
        ? [
            {
              type: "table" as const,
              title: `Expiring ${windowLabel}`,
              table: {
                columns: [
                  { key: "product", label: "Product" },
                  { key: "batch", label: "Batch" },
                  { key: "qty", label: "Qty", align: "right" as const },
                  { key: "expires", label: "Expires" },
                  { key: "value", label: "Value", align: "right" as const },
                ],
                rows: upcoming.slice(0, 10).map((r) => ({ product: r.product.name, batch: r.batch.batchNo, qty: formatQty(r.batch.quantity, r.product.unit), expires: daysLeftLabel(r.daysLeft), value: formatMoney(r.value) })),
              },
            },
          ]
        : []),
      ...(bullets.length ? [{ type: "bullets" as const, items: bullets }] : []),
    ],
    actions: [
      { label: "Review expiring stock", href: "/inventory/expiry", variant: "default" },
      ...(expired.length ? [{ label: "Review expired stock", href: "/inventory/expiry?tab=expired", variant: "outline" as const }] : []),
    ],
    followUps: ["Which products are slow moving?", "What should I reorder?", "Give me today's daily summary"],
  };
};

const reorderHandler: Handler = (_q, ctx, _p, lk) => {
  const { data, now } = ctx;
  const lines = toReorderLines(reorderSuggestions(data.products, data.suppliers, data.sales, now), lk);
  if (!lines.length)
    return {
      text: "Stock levels look healthy — no product is at or below its reorder point based on the last 14 days of sales and supplier lead times.",
      blocks: [],
      actions: [{ label: "View inventory", href: "/inventory" }],
      followUps: ["Which products are slow moving?", "What is our inventory worth?"],
    };
  const total = sum(lines.map((l) => l.estimatedCost));
  const critical = lines.filter((l) => l.priority === "critical");
  const high = lines.filter((l) => l.priority === "high");
  const suppliers = new Set(lines.map((l) => l.supplierId ?? "none"));
  const po = bestSupplierAction(lines);
  let text = `I recommend reordering **${plural(lines.length, "product")}** from ${plural(suppliers.size, "supplier")}, estimated at **${formatMoney(total)}** at current purchase prices.`;
  if (critical.length) text += ` ${listNames(critical.map((l) => l.name))} ${critical.length === 1 ? "is" : "are"} already out of stock (critical).`;
  if (high.length) text += ` ${plural(high.length, "more item")} will run out before a new delivery could arrive (high priority).`;
  text += " Review the quantities below, then create a draft purchase order per supplier — nothing is ordered until you save it.";
  return {
    text,
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Products to reorder", value: formatNumber(lines.length) },
          { label: "Critical / high", value: `${critical.length} / ${high.length}`, tone: critical.length ? "bad" : high.length ? "warn" : "default" },
          { label: "Suppliers", value: formatNumber(suppliers.size) },
          { label: "Est. cost", value: formatMoney(total) },
        ],
      },
      { type: "reorder", lines },
      { type: "bullets", items: ["Velocity = units sold in the last 14 days ÷ 14.", "Suggested quantity covers the supplier lead time + 14 days of demand + the minimum stock level, minus stock on hand.", "Priority: critical = out of stock, high = runs out within the lead time, medium = at or below minimum."] },
    ],
    actions: [...(po ? [po] : []), { label: "View low-stock items", href: "/inventory?status=low_stock", variant: "outline" }],
    followUps: ["What products are out of stock?", "Which products are slow moving?", "What is our inventory worth?"],
  };
};

const grossProfitHandler: Handler = (_q, ctx, period) => {
  const { data, now } = ctx;
  const p = period ?? resolvePeriod({ kind: "thisMonth" }, now, data);
  const cur = summarize(data.sales, data.returns, p.range);
  const cmp = comparisonRange(p, now);
  const prev = summarize(data.sales, data.returns, cmp.range);
  const change = percentChange(cur.grossProfit, prev.grossProfit);
  const expenses = expenseTotal(data.expenses, p.range);
  const net = cur.grossProfit - expenses;
  let text = `${periodPhrase(p).replace(/^./, (c) => c.toUpperCase())} you made **${formatMoney(cur.grossProfit)} gross profit** on ${formatMoney(cur.revenue)} of revenue excl. tax — a **${formatPercent(cur.marginBps)} margin**. `;
  text += change === null ? "There's no comparable earlier period yet." : change === 0 ? `That's flat vs ${cmp.label}.` : `That's ${change > 0 ? "up" : "down"} ${Math.abs(change)}% vs ${cmp.label}.`;
  if (expenses > 0) text += ` After ${formatMoney(expenses)} of recorded expenses, the estimated net profit is **${formatMoney(net)}**.`;
  const blocks: AiBlock[] = [
    {
      type: "kpis",
      items: [
        { label: "Revenue (excl. tax)", value: formatMoney(cur.revenue) },
        { label: "Cost of goods", value: formatMoney(cur.cogs) },
        { label: "Gross profit", value: formatMoney(cur.grossProfit), change, tone: changeTone(change) },
        { label: "Gross margin", value: formatPercent(cur.marginBps), tone: cur.marginBps >= 2000 ? "good" : "warn" },
      ],
    },
  ];
  if (p.kind !== "today" && p.kind !== "yesterday" && cur.transactions > 0)
    blocks.push({ type: "chart", title: "Daily gross profit", money: true, valueLabel: "Profit", data: dailySeries(data.sales, data.returns, p.range).slice(-31).map((d) => ({ label: d.label, value: d.profit })) });
  return {
    text,
    blocks,
    actions: [
      { label: "Open profit report", href: "/reports?tab=profit", variant: "default" },
      { label: "View expenses", href: "/expenses", variant: "outline" },
    ],
    followUps: ["Which products have the highest profit margin?", "What are our highest revenue categories?", "What were our expenses this month?"],
  };
};

const topMarginHandler: Handler = (q, ctx, period, lk) => {
  const { data, now } = ctx;
  const p = period ?? resolvePeriod({ kind: "last30" }, now, data);
  const lowest = /\b(lowest|worst|low|poor)\b/.test(normalizeQuestion(q));
  const perf = productPerformance(data.sales, p.range)
    .filter((x) => x.revenue > 0 && x.qty > 0)
    .map((x) => ({ ...x, marginBps: shareBps(x.profit, x.revenue) }));
  if (!perf.length) return { text: `There are no sales ${periodPhrase(p)} to calculate margins from.`, blocks: [], actions: [{ label: "Open profit report", href: "/reports?tab=profit" }], followUps: ["How much gross profit did we make this month?"] };
  const sorted = [...perf].sort((a, b) => (lowest ? a.marginBps - b.marginBps : b.marginBps - a.marginBps));
  const top = sorted.slice(0, 8);
  const contributor = [...perf].sort((a, b) => b.profit - a.profit)[0]!;
  const lead = top[0]!;
  const opposite = sorted[sorted.length - 1]!;
  const leadProduct = lk.product.get(lead.productId);
  let text = `${lowest ? "Lowest" : "Highest"} realised margin ${periodPhrase(p)}: **${lead.name}** at **${formatPercent(lead.marginBps)}** (${formatMoney(lead.profit)} profit on ${formatQty(lead.qty, unitOf(lead.unit))}).`;
  text += ` In absolute terms **${contributor.name}** contributes the most gross profit (${formatMoney(contributor.profit)}).`;
  text += ` At the other end, ${opposite.name} earns ${formatPercent(opposite.marginBps)}.`;
  return {
    text,
    blocks: [
      {
        type: "table",
        title: `${lowest ? "Lowest" : "Highest"} margin products · ${p.label}`,
        table: {
          columns: [
            { key: "product", label: "Product" },
            { key: "margin", label: "Margin", align: "right" },
            { key: "list", label: "List margin", align: "right" },
            { key: "qty", label: "Sold", align: "right" },
            { key: "profit", label: "Profit", align: "right" },
          ],
          rows: top.map((x) => {
            const prod = lk.product.get(x.productId);
            return { product: x.name, margin: formatPercent(x.marginBps), list: prod ? formatPercent(shareBps(prod.sellingPrice - prod.purchasePrice, prod.sellingPrice)) : "—", qty: formatQty(x.qty, unitOf(x.unit)), profit: formatMoney(x.profit) };
          }),
        },
      },
      { type: "bullets", items: ["Margin = gross profit ÷ revenue excl. tax, using the cost and price recorded on each sale (after discounts and returns).", "List margin uses today's catalog selling and purchase prices."] },
    ],
    actions: [
      { label: "Open profit report", href: "/reports?tab=profit", variant: "default" },
      { label: `Open ${lead.name}`, href: productHref(leadProduct), variant: "outline" },
    ],
    followUps: ["What are our highest revenue categories?", "What are the top-selling products?", "How much gross profit did we make this month?"],
  };
};

const topCategoriesHandler: Handler = (_q, ctx, period) => {
  const { data, now } = ctx;
  const p = period ?? resolvePeriod({ kind: "last30" }, now, data);
  const cats = categoryPerformance(data.sales, data.products, data.categories, p.range).filter((c) => c.revenue > 0);
  if (!cats.length) return { text: `No category sales ${periodPhrase(p)} yet.`, blocks: [], actions: [{ label: "Open reports", href: "/reports" }], followUps: ["What are the top-selling products?"] };
  const total = sum(cats.map((c) => c.revenue));
  const [a, b] = cats;
  const text =
    `**${a!.name}** is your highest-revenue category ${periodPhrase(p)} with **${formatMoney(a!.revenue)}** (${formatPercent(shareBps(a!.revenue, total))} of revenue excl. tax)` +
    (b ? `, followed by ${b.name} at ${formatMoney(b.revenue)}.` : ".") +
    ` The most profitable is ${[...cats].sort((x, y) => y.profit - x.profit)[0]!.name}.`;
  return {
    text,
    blocks: [
      { type: "chart", title: "Revenue by category", money: true, valueLabel: "Revenue", data: cats.slice(0, 8).map((c) => ({ label: c.name, value: c.revenue })) },
      {
        type: "table",
        table: {
          columns: [
            { key: "category", label: "Category" },
            { key: "revenue", label: "Revenue", align: "right" },
            { key: "profit", label: "Profit", align: "right" },
            { key: "margin", label: "Margin", align: "right" },
            { key: "share", label: "Share", align: "right" },
          ],
          rows: cats.map((c) => ({ category: `${c.icon} ${c.name}`, revenue: formatMoney(c.revenue), profit: formatMoney(c.profit), margin: formatPercent(shareBps(c.profit, c.revenue)), share: formatPercent(shareBps(c.revenue, total)) })),
        },
      },
    ],
    actions: [
      { label: "Open category report", href: "/reports?tab=categories", variant: "default" },
      { label: "Browse products", href: "/products", variant: "outline" },
    ],
    followUps: ["Which products have the highest profit margin?", "What are the top-selling products?", "Which products are slow moving?"],
  };
};

const paymentHandler: Handler = (_q, ctx, period) => {
  const { data, now } = ctx;
  const p = period ?? resolvePeriod({ kind: "last7" }, now, data);
  const rows = paymentBreakdown(data.sales, p.range).sort((a, b) => b.amount - a.amount);
  const total = sum(rows.map((r) => r.amount));
  if (total === 0) return { text: `No payments were recorded ${periodPhrase(p)}.`, blocks: [], actions: [{ label: "View sales history", href: "/sales" }], followUps: ["How much did we sell today?"] };
  const lead = rows[0]!;
  const digital = sum(rows.filter((r) => r.method !== "cash").map((r) => r.amount));
  return {
    text: `${periodPhrase(p).replace(/^./, (c) => c.toUpperCase())}, **${lead.label}** was the most used method with **${formatMoney(lead.amount)}** (${formatPercent(shareBps(lead.amount, total))} of collected payments). Card and QR together account for ${formatPercent(shareBps(digital, total))} — useful when planning the cash float and bank deposits.`,
    blocks: [
      { type: "chart", title: "Payments by method", money: true, valueLabel: "Amount", data: rows.map((r) => ({ label: r.label, value: r.amount })) },
      {
        type: "table",
        table: {
          columns: [{ key: "method", label: "Method" }, { key: "count", label: "Payments", align: "right" }, { key: "amount", label: "Amount", align: "right" }, { key: "share", label: "Share", align: "right" }],
          rows: rows.map((r) => ({ method: r.label, count: formatNumber(r.count), amount: formatMoney(r.amount), share: formatPercent(shareBps(r.amount, total)) })),
        },
      },
    ],
    actions: [
      { label: "View sales history", href: "/sales", variant: "default" },
      { label: "Register & shifts", href: "/shifts", variant: "outline" },
    ],
    followUps: ["How much did we sell today?", "Compare this week's sales with last week", "Who are our best customers?"],
  };
};

const slowMovingHandler: Handler = (_q, ctx, _p, lk) => {
  const { data, now } = ctx;
  const list = slowMovers(data.products, data.sales, 21, now)
    .map((p) => ({ p, value: multiply(p.purchasePrice, p.stock) }))
    .sort((a, b) => b.value - a.value);
  if (!list.length)
    return { text: "Every active product with stock has sold at least once in the last 21 days — no slow movers right now.", blocks: [], actions: [{ label: "View inventory", href: "/inventory" }], followUps: ["What are the top-selling products?", "What is our inventory worth?"] };
  const tied = inventoryValue(list.map((x) => x.p));
  const first = list[0]!;
  return {
    text: `**${plural(list.length, "product")}** had no sales in the last 21 days while still holding stock, tying up **${formatMoney(tied)}** at cost. The largest is **${first.p.name}** (${formatQty(first.p.stock, first.p.unit)}, ${formatMoney(first.value)}).`,
    blocks: [
      {
        type: "table",
        title: "Slow-moving products (no sales in 21 days)",
        table: {
          columns: [{ key: "product", label: "Product" }, { key: "category", label: "Category" }, { key: "stock", label: "Stock", align: "right" }, { key: "value", label: "Value at cost", align: "right" }],
          rows: list.slice(0, 10).map((x) => ({ product: x.p.name, category: lk.categoryOf(x.p.id)?.name ?? "—", stock: formatQty(x.p.stock, x.p.unit), value: formatMoney(x.value) })),
        },
      },
      { type: "bullets", items: ["Feature these items near the checkout or bundle them with best sellers.", "Pause reordering until existing stock sells through.", "Consider a limited-time discount for items with an approaching expiry date."] },
    ],
    actions: [
      { label: `Open ${first.p.name}`, href: productHref(first.p), variant: "default" },
      { label: "View inventory", href: "/inventory", variant: "outline" },
    ],
    followUps: ["What is our inventory worth?", "Which products will expire soon?", "What are the top-selling products?"],
  };
};

const inventoryValueHandler: Handler = (_q, ctx, _p, lk) => {
  const { data } = ctx;
  const active = data.products.filter((p) => p.status === "active" && p.stock > 0);
  const cost = inventoryValue(active);
  const retail = inventoryRetailValue(active);
  const counts = stockCounts(data.products);
  const byCat = new Map<string, { name: string; cost: number; retail: number; items: number }>();
  for (const p of active) {
    const c = lk.categoryOf(p.id);
    const key = c ? `${c.icon} ${c.name}` : "Uncategorised";
    const cur = byCat.get(key) ?? { name: key, cost: 0, retail: 0, items: 0 };
    cur.cost += inventoryValue([p]);
    cur.retail += inventoryRetailValue([p]);
    cur.items += 1;
    byCat.set(key, cur);
  }
  const cats = [...byCat.values()].sort((a, b) => b.cost - a.cost);
  return {
    text: `Your stock on hand is worth **${formatMoney(cost)} at cost** and **${formatMoney(retail)} at selling price** — about **${formatMoney(retail - cost)}** of potential gross profit (before tax and discounts). ${cats[0] ? `${cats[0].name.replace(/^\S+\s/, "")} holds the most value (${formatPercent(shareBps(cats[0].cost, cost))}).` : ""}`,
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Value at cost", value: formatMoney(cost) },
          { label: "Retail value", value: formatMoney(retail) },
          { label: "Potential profit", value: formatMoney(retail - cost), tone: "good" },
          { label: "In stock / active", value: `${counts.inStock + counts.low} / ${counts.active}` },
        ],
      },
      {
        type: "table",
        title: "Value by category",
        table: {
          columns: [{ key: "category", label: "Category" }, { key: "items", label: "Products", align: "right" }, { key: "cost", label: "At cost", align: "right" }, { key: "retail", label: "At retail", align: "right" }],
          rows: cats.map((c) => ({ category: c.name, items: c.items, cost: formatMoney(c.cost), retail: formatMoney(c.retail) })),
        },
      },
    ],
    actions: [
      { label: "View inventory", href: "/inventory", variant: "default" },
      { label: "Inventory report", href: "/reports?tab=inventory", variant: "outline" },
    ],
    followUps: ["Which products are slow moving?", "Which products are low on stock?", "Which products will expire soon?"],
  };
};

const dailySummaryHandler: Handler = (_q, ctx) => {
  const s = dailySummary(ctx.data, ctx.now);
  return {
    text: s.headline,
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Today's sales", value: formatMoney(s.netSales), change: s.salesChange, tone: changeTone(s.salesChange) },
          { label: "Transactions", value: formatNumber(s.transactions) },
          { label: "Gross profit", value: formatMoney(s.grossProfit), tone: s.grossProfit > 0 ? "good" : "default" },
          { label: "Need restocking", value: formatNumber(s.lowStockCount + s.outOfStockCount), tone: s.outOfStockCount ? "bad" : s.lowStockCount ? "warn" : "good" },
        ],
      },
      ...(s.recommendations.length ? [{ type: "bullets" as const, items: s.recommendations.map((r) => `**${r.label}** — ${r.detail}`) }] : []),
    ],
    actions: s.recommendations.slice(0, 3).map((r, i) => ({ label: r.label, href: r.href, variant: i === 0 ? ("default" as const) : ("outline" as const) })),
    followUps: ["What should I reorder?", "Which products will expire soon?", "Compare this week's sales with last week"],
  };
};

const expensesHandler: Handler = (_q, ctx, period) => {
  const { data, now } = ctx;
  const p = period ?? resolvePeriod({ kind: "thisMonth" }, now, data);
  const total = expenseTotal(data.expenses, p.range);
  const cmp = comparisonRange(p, now);
  const prevTotal = expenseTotal(data.expenses, cmp.range);
  const change = percentChange(total, prevTotal);
  const byCat = [...expensesByCategory(data.expenses, p.range).entries()].sort((a, b) => b[1] - a[1]);
  const label = (k: string) => EXPENSE_CATEGORIES.find((c) => c.value === k)?.label ?? k;
  const gp = summarize(data.sales, data.returns, p.range).grossProfit;
  if (total === 0)
    return { text: `No expenses have been recorded ${periodPhrase(p)}.`, blocks: [], actions: [{ label: "Record an expense", href: "/expenses" }], followUps: ["How much gross profit did we make this month?"] };
  let text = `You've recorded **${formatMoney(total)}** in expenses ${periodPhrase(p)}. The largest category is **${label(byCat[0]![0])}** (${formatMoney(byCat[0]![1])}).`;
  if (change !== null && change !== 0) text += ` That's ${change > 0 ? "up" : "down"} ${Math.abs(change)}% vs ${cmp.label}.`;
  text += ` Against ${formatMoney(gp)} gross profit for the same period, the estimated net profit is **${formatMoney(gp - total)}**.`;
  return {
    text,
    blocks: [
      {
        type: "kpis",
        items: [
          { label: "Expenses", value: formatMoney(total), change, tone: changeTone(change, true) },
          { label: "Gross profit", value: formatMoney(gp) },
          { label: "Est. net profit", value: formatMoney(gp - total), tone: gp - total >= 0 ? "good" : "bad" },
        ],
      },
      {
        type: "table",
        title: `Expenses by category · ${p.label}`,
        table: {
          columns: [{ key: "category", label: "Category" }, { key: "amount", label: "Amount", align: "right" }, { key: "share", label: "Share", align: "right" }],
          rows: byCat.map(([k, v]) => ({ category: label(k), amount: formatMoney(v), share: formatPercent(shareBps(v, total)) })),
        },
      },
    ],
    actions: [
      { label: "View expenses", href: "/expenses", variant: "default" },
      { label: "Profit & loss report", href: "/reports?tab=profit", variant: "outline" },
    ],
    followUps: ["How much gross profit did we make this month?", "What are our highest revenue categories?", "Give me today's daily summary"],
  };
};

const topCustomersHandler: Handler = (_q, ctx, period) => {
  const { data, now } = ctx;
  const p = period ?? resolvePeriod({ kind: "last30" }, now, data);
  const list: Sale[] = salesInRange(data.sales, p.range);
  const byCustomer = new Map<string, { visits: number; spent: number }>();
  let walkIn = 0;
  for (const s of list) {
    const net = s.total - sum(s.items.map((i) => i.refundedAmount));
    if (!s.customerId) {
      walkIn += net;
      continue;
    }
    const cur = byCustomer.get(s.customerId) ?? { visits: 0, spent: 0 };
    cur.visits += 1;
    cur.spent += net;
    byCustomer.set(s.customerId, cur);
  }
  const customers = new Map(data.customers.map((c) => [c.id, c]));
  const ranked = [...byCustomer.entries()].map(([id, v]) => ({ c: customers.get(id), ...v })).filter((x) => x.c).sort((a, b) => b.spent - a.spent);
  if (!ranked.length) return { text: `No registered customers purchased ${periodPhrase(p)}.`, blocks: [], actions: [{ label: "View customers", href: "/customers" }], followUps: ["How much did we sell today?"] };
  const lead = ranked[0]!;
  const registered = sum(ranked.map((r) => r.spent));
  return {
    text: `Your top customer ${periodPhrase(p)} is **${lead.c!.name}** with **${formatMoney(lead.spent)}** over ${plural(lead.visits, "visit")}. Registered customers made up ${formatPercent(shareBps(registered, registered + walkIn))} of sales; the rest were walk-in customers — a chance to grow loyalty sign-ups at the counter.`,
    blocks: [
      {
        type: "table",
        title: `Top customers · ${p.label}`,
        table: {
          columns: [{ key: "customer", label: "Customer" }, { key: "visits", label: "Visits", align: "right" }, { key: "spent", label: "Spent", align: "right" }, { key: "avg", label: "Avg. basket", align: "right" }, { key: "points", label: "Points", align: "right" }],
          rows: ranked.slice(0, 8).map((r) => ({ customer: r.c!.name, visits: r.visits, spent: formatMoney(r.spent), avg: formatMoney(Math.round(r.spent / r.visits)), points: formatNumber(r.c!.loyaltyPoints) })),
        },
      },
    ],
    actions: [
      { label: `Open ${lead.c!.name}`, href: `/customers?id=${lead.c!.id}`, variant: "default" },
      { label: "All customers", href: "/customers", variant: "outline" },
    ],
    followUps: ["Which payment methods did customers use?", "What are the top-selling products?", "How much did we sell this week?"],
  };
};

const CAPABILITIES = [
  "**Sales** — today, yesterday, this week/month, last N days, week-over-week comparison, payment methods",
  "**Products** — top sellers, highest margins, slow movers, top categories",
  "**Inventory** — low stock, out of stock, expiring batches, inventory value",
  "**Purchasing** — smart reorder plan with one-click draft purchase orders",
  "**Profit & costs** — gross profit, expenses, estimated net profit, best customers",
  "**Summary** — a daily business briefing with recommended actions",
];

const greetingHandler: Handler = (q, ctx) => {
  const s = dailySummary(ctx.data, ctx.now);
  const thanks = /^(thanks|thank you|cheers|great|ok|okay|nice)/.test(normalizeQuestion(q));
  const name = ctx.userName ? ` ${ctx.userName}` : "";
  const text = thanks
    ? "You're welcome! Ask me anything else about sales, stock or profit."
    : `Hi${name}! I'm your FreshMart business assistant. Quick snapshot: you've sold **${formatMoney(s.netSales)}** from ${plural(s.transactions, "transaction")} today, and **${plural(s.lowStockCount + s.outOfStockCount, "product")}** need restocking. What would you like to look at?`;
  return { text, blocks: [], actions: [], followUps: ["Give me today's daily summary", "What should I reorder?", "What are the top-selling products?"] };
};

const helpHandler: Handler = () => ({
  text: "I'm a simulated demo assistant: I answer business questions by running deterministic calculations on your demo data (no AI service is called). Here's what I can help with:",
  blocks: [{ type: "bullets", items: CAPABILITIES }],
  actions: [],
  followUps: ["How much did we sell today?", "Which products will expire soon?", "Which products have the highest profit margin?"],
});

const fallbackHandler: Handler = (q) => ({
  text: `I couldn't match “${q.trim().slice(0, 120)}” to one of the questions this demo assistant supports. I'm not a general AI — I only answer predefined business questions computed from your demo data. Try one of these topics:`,
  blocks: [{ type: "bullets", items: CAPABILITIES }],
  actions: [],
  followUps: ["How much did we sell today?", "What should I reorder?", "What can you do?"],
});

const HANDLERS: Record<AiIntent, Handler> = {
  greeting: greetingHandler,
  help: helpHandler,
  sales_today: salesHandler,
  sales_yesterday: salesHandler,
  sales_period: salesHandler,
  sales_compare_week: compareWeekHandler,
  top_products: topProductsHandler,
  low_stock: lowStockHandler,
  out_of_stock: outOfStockHandler,
  expiring: expiringHandler,
  reorder: reorderHandler,
  gross_profit: grossProfitHandler,
  top_margin: topMarginHandler,
  top_categories: topCategoriesHandler,
  payment_breakdown: paymentHandler,
  slow_moving: slowMovingHandler,
  inventory_value: inventoryValueHandler,
  daily_summary: dailySummaryHandler,
  expenses: expensesHandler,
  top_customers: topCustomersHandler,
  fallback: fallbackHandler,
};

/** Synchronous core used by the provider (and handy for tests). */
export function answerQuestion(question: string, ctx: AiContext): AiResponse {
  const match = classifyIntent(question);
  const period = match.period ? resolvePeriod(match.period, ctx.now, ctx.data) : null;
  const lk = buildLookups(ctx.data);
  const draft = HANDLERS[match.intent](question, ctx, period, lk);
  // Keep suggested actions within the user's permissions.
  const actions = draft.actions.filter((a) => canAccessRoute(ctx.role, a.href.split("?")[0]!));
  return { intent: match.intent, ...draft, actions };
}

/** Stable pseudo-random "thinking" delay (600–1100 ms) derived from the question. */
function thinkingDelay(question: string) {
  let h = 0;
  for (let i = 0; i < question.length; i++) h = (h * 31 + question.charCodeAt(i)) >>> 0;
  return 600 + (h % 501);
}

/** Deterministic, offline assistant. See `provider.ts` for how to replace it with an LLM. */
export class MockAiProvider implements AiProvider {
  readonly id = "mock";
  readonly label = "Simulated demo assistant";

  async ask(question: string, ctx: AiContext): Promise<AiResponse> {
    await sleep(thinkingDelay(question));
    return answerQuestion(question, ctx);
  }
}
