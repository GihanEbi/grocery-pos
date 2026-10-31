import type { Role } from "@/types";
import type { AppData } from "@/types/data";
import type { AiResponse } from "./types";

/**
 * Everything an assistant provider may read to answer a question.
 * It is a read-only snapshot: providers must never mutate store data.
 */
export interface AiContext {
  /** Snapshot of the persisted demo dataset at the moment the question was asked. */
  data: AppData;
  /** "Now" for every relative date ("today", "this week"). Injected for deterministic tests. */
  now: Date;
  /** Role of the signed-in user — used to keep suggested actions within their permissions. */
  role: Role;
  /** First name of the signed-in user, for greetings. */
  userName?: string;
}

/**
 * The contract between the chat UI and whatever produces answers.
 *
 * Today the app ships `MockAiProvider` (see `engine.ts`): a deterministic intent
 * classifier + handlers that compute answers with `@/lib/analytics` — no network,
 * no AI service.
 *
 * SWAPPING IN A REAL LLM LATER
 * ----------------------------
 * 1. Create e.g. `LlmAiProvider implements AiProvider` whose `ask()` POSTs the
 *    question (plus a compact, permission-filtered summary of `ctx` — never the raw
 *    dataset) to your backend route (`/api/assistant`). Keep API keys on the server.
 * 2. On the server, expose the deterministic functions in `@/lib/analytics`
 *    (salesSummary, reorderSuggestions, expiryRows, …) as *tools* the model can call,
 *    so numbers still come from the same audited calculations instead of the model.
 * 3. Ask the model to reply in the `AiResponse` shape (text + blocks + actions +
 *    followUps) — e.g. via structured output / JSON schema — and validate it with zod.
 *    Only allow `actions[].href` values that match known app routes.
 * 4. Change `getAiProvider()` below to return the new provider (optionally behind a
 *    feature flag, falling back to `MockAiProvider` when offline).
 *
 * The UI (`src/components/ai/*`) only depends on `AiResponse`, so nothing else changes.
 * Actions stay navigational: an AI must never silently create or modify records.
 */
export interface AiProvider {
  readonly id: string;
  readonly label: string;
  ask(question: string, ctx: AiContext): Promise<AiResponse>;
}

let current: AiProvider | null = null;

/** Lazily resolves the active provider (the mock engine in this prototype). */
export async function getAiProvider(): Promise<AiProvider> {
  if (!current) {
    const { MockAiProvider } = await import("./engine");
    current = new MockAiProvider();
  }
  return current;
}

/** Override the provider (tests, or a future LLM-backed implementation). */
export function setAiProvider(provider: AiProvider) {
  current = provider;
}
