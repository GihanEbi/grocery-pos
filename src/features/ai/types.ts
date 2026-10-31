import type { Cents } from "@/types";
import type { ReorderPriority } from "@/lib/calculations/forecasting";

/**
 * Structured AI responses. A real LLM-backed provider would return the same
 * shape (text + optional blocks + actions), so the chat UI never changes.
 */
export type AiIntent =
  | "greeting"
  | "help"
  | "sales_today"
  | "sales_yesterday"
  | "sales_period"
  | "sales_compare_week"
  | "top_products"
  | "low_stock"
  | "out_of_stock"
  | "expiring"
  | "reorder"
  | "gross_profit"
  | "top_margin"
  | "top_categories"
  | "payment_breakdown"
  | "slow_moving"
  | "inventory_value"
  | "daily_summary"
  | "expenses"
  | "top_customers"
  | "fallback";

export interface AiKpi {
  label: string;
  value: string;
  change?: number | null;
  tone?: "default" | "good" | "bad" | "warn";
}

export interface AiTable {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number>[];
}

export interface AiReorderLine {
  productId: string;
  name: string;
  image: string;
  supplierId: string | null;
  supplierName: string;
  stock: number;
  unit: string;
  velocity: number;
  daysOfCover: number;
  suggestedQty: number;
  priority: ReorderPriority;
  estimatedCost: Cents;
}

export type AiBlock =
  | { type: "kpis"; items: AiKpi[] }
  | { type: "table"; title?: string; table: AiTable }
  | { type: "reorder"; lines: AiReorderLine[] }
  | { type: "bullets"; items: string[] }
  | { type: "chart"; title?: string; data: { label: string; value: number; compare?: number }[]; money?: boolean; compareLabel?: string; valueLabel?: string };

export interface AiAction {
  label: string;
  href: string;
  variant?: "default" | "outline";
}

export interface AiResponse {
  intent: AiIntent;
  text: string;
  blocks: AiBlock[];
  actions: AiAction[];
  followUps: string[];
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  response?: AiResponse;
}

// ---------------------------------------------------------------------------
// Insights & daily summary (computed deterministically in `insights.ts`).
// ---------------------------------------------------------------------------

export type AiInsightSeverity = "critical" | "warning" | "info" | "positive";

export interface AiInsight {
  id: string;
  kind: "low_stock" | "expiry" | "top_performer" | "slow_movers" | "sales_change" | "reorder";
  severity: AiInsightSeverity;
  title: string;
  message: string;
  /** Short headline number for the card, e.g. "Rs 12,400.00" or "+12.5%". */
  metric?: string;
  href: string;
  actionLabel: string;
}

export interface AiRecommendation {
  label: string;
  detail: string;
  href: string;
  severity: AiInsightSeverity;
}

export interface AiDailySummaryData {
  date: string;
  netSales: Cents;
  transactions: number;
  avgBasket: Cents;
  grossProfit: Cents;
  marginBps: number;
  /** % change of net sales vs the same time yesterday (null when not comparable). */
  salesChange: number | null;
  lowStockCount: number;
  outOfStockCount: number;
  /** Batches expiring within 3 days (not yet expired). */
  expiringCount: number;
  expiredCount: number;
  reorderCount: number;
  topProduct: { name: string; revenue: Cents } | null;
  headline: string;
  recommendations: AiRecommendation[];
}
