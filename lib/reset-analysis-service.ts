import { getD1 } from "../db";
import { ensureDatabase } from "../db/storage";
import { applyResetAwareGuard, filterPostResetActivities } from "./reset-analysis";
import { getRuntimeEnv } from "./runtime-env";
import type {
  DashboardData,
  ResetAnalysisContext,
  ResetAnalysisResult,
  ResetLikelihood,
} from "./types";

export const ANALYSIS_PROMPT_VERSION = "reset-aware-v3";
export const ANALYSIS_MODEL = "deepseek-chat";

const SYSTEM_PROMPT = `You evaluate whether Tibo may trigger another discretionary Codex or ChatGPT Work usage-limit reset.

Non-negotiable reasoning rules:
1. The most recent confirmed global reset closes the previous evidence window. Never treat that completed reset as evidence for another reset.
2. Only posts and interactions strictly AFTER analysisWindowStart are supplied. Base all semantic claims on those items.
3. weeklyProgressPercent is a public seven-day cadence proxy anchored to the latest public global reset. It is not an account's actual resetsAt value.
4. Higher cadence pressure raises the baseline gradually; it is context, not proof.
5. A reset less than 24 hours ago normally lowers the baseline. A new explicit reset promise, product conflict, outage, celebration, or operational event can override that cooldown.
6. Replies and quotes matter. A confrontation involving another coding-product leader can be a trigger when the text connects it to reset behavior.
7. Rapid-repeat history makes a fast repeat plausible but is never standalone proof.

Return ONLY valid JSON in this exact format:
{"likelihood":"very_likely|likely|unlikely|none","reason":"...","keywords":["..."],"summary":"..."}`;

type AnalysisDraft = Omit<ResetAnalysisResult, "context" | "guardrail" | "snapshot" | "delta">;

type SnapshotRow = {
  id: string;
  generated_at: string;
  activity_ids_json: string;
  context_json: string;
  result_json: string;
  model: string;
  prompt_version: string;
};

const likelihoods = new Set<ResetLikelihood>(["very_likely", "likely", "unlikely", "none"]);
const inFlight = new Map<string, Promise<AnalysisDraft>>();

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildSnapshotId(dashboard: DashboardData) {
  const activities = filterPostResetActivities(dashboard.activities, dashboard.resetContext.analysisWindowStart);
  const latestReset = dashboard.resetHistory.find((event) => (
    event.kind === "global"
      && event.scope !== "targeted"
      && event.effectiveAt === dashboard.resetContext.lastResetAt
  ));
  const signature = JSON.stringify({
    promptVersion: ANALYSIS_PROMPT_VERSION,
    latestResetId: latestReset?.id || dashboard.resetContext.lastResetAt,
    cadencePressure: dashboard.resetContext.cadencePressure,
    activities: activities.map((activity) => ({
      id: activity.id,
      publishedAt: activity.publishedAt,
      type: activity.type,
      targetHandle: activity.targetHandle,
      text: activity.text,
    })),
  });
  return { id: await sha256(signature), activities, latestResetId: latestReset?.id || null };
}

function draftFromRow(row: SnapshotRow): AnalysisDraft {
  const parsed = parseJson<Partial<AnalysisDraft>>(row.result_json, {});
  return {
    likelihood: likelihoods.has(parsed.likelihood as ResetLikelihood)
      ? parsed.likelihood as ResetLikelihood
      : "unknown",
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [],
  };
}

function likelihoodFromRow(row: SnapshotRow | null) {
  if (!row) return null;
  const context = parseJson<ResetAnalysisContext | null>(row.context_json, null);
  if (!context) return draftFromRow(row).likelihood;
  return applyResetAwareGuard(draftFromRow(row), context).likelihood;
}

async function callDeepSeek(dashboard: DashboardData, activities: DashboardData["activities"]): Promise<AnalysisDraft> {
  if (!activities.length) return { likelihood: "none", keywords: [] };
  const runtime = getRuntimeEnv();
  if (!runtime.DEEPSEEK_API_KEY) throw new Error("DeepSeek analysis is not configured");

  const tweetTexts = activities.map((tweet, index) => (
    `[${index + 1}] ${tweet.publishedAt} (${tweet.type}${tweet.targetHandle ? ` → @${tweet.targetHandle}` : ""}) ${tweet.text}`
  )).join("\n\n");
  const baseUrl = (runtime.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Reset-aware context:\n${JSON.stringify(dashboard.resetContext, null, 2)}\n\nPost-reset Tibo activity only:\n\n${tweetTexts}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 700,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`DeepSeek API error ${response.status}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] || content) as Partial<AnalysisDraft>;
  return {
    likelihood: likelihoods.has(parsed.likelihood as ResetLikelihood)
      ? parsed.likelihood as ResetLikelihood
      : "unknown",
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((item): item is string => typeof item === "string").slice(0, 8)
      : [],
  };
}

async function previousSnapshot(currentId: string) {
  return getD1().prepare(`
    SELECT id, generated_at, activity_ids_json, context_json, result_json, model, prompt_version
    FROM analysis_snapshots WHERE id != ? ORDER BY generated_at DESC LIMIT 1
  `).bind(currentId).first<SnapshotRow>();
}

function withMetadata(
  draft: AnalysisDraft,
  context: ResetAnalysisContext,
  row: SnapshotRow,
  previous: SnapshotRow | null,
  cached: boolean,
  stale = false,
) {
  const currentIds = parseJson<string[]>(row.activity_ids_json, []);
  const previousIds = new Set(previous ? parseJson<string[]>(previous.activity_ids_json, []) : []);
  const result = applyResetAwareGuard(draft, context);
  const previousLikelihood = likelihoodFromRow(previous);
  return {
    ...result,
    snapshot: {
      id: row.id,
      generatedAt: row.generated_at,
      cached,
      stale,
      promptVersion: row.prompt_version,
      model: row.model,
    },
    delta: {
      previousLikelihood,
      likelihoodChanged: previousLikelihood !== null && previousLikelihood !== result.likelihood,
      newActivityCount: currentIds.filter((id) => !previousIds.has(id)).length,
      comparedAt: previous?.generated_at || null,
    },
  } satisfies ResetAnalysisResult;
}

export async function getOrCreateResetAnalysis(dashboard: DashboardData): Promise<ResetAnalysisResult> {
  await ensureDatabase();
  const db = getD1();
  const { id, activities, latestResetId } = await buildSnapshotId(dashboard);
  const existing = await db.prepare(`
    SELECT id, generated_at, activity_ids_json, context_json, result_json, model, prompt_version
    FROM analysis_snapshots WHERE id = ? LIMIT 1
  `).bind(id).first<SnapshotRow>();
  if (existing) {
    const previous = await previousSnapshot(id);
    return withMetadata(draftFromRow(existing), dashboard.resetContext, existing, previous, true);
  }

  const previous = await previousSnapshot(id);
  try {
    let pending = inFlight.get(id);
    if (!pending) {
      pending = callDeepSeek(dashboard, activities);
      inFlight.set(id, pending);
    }
    const draft = await pending;
    const generatedAt = new Date().toISOString();
    const activityIds = activities.map((activity) => activity.id);
    await db.prepare(`
      INSERT OR IGNORE INTO analysis_snapshots (
        id, generated_at, latest_reset_id, analysis_window_start, latest_activity_id,
        activity_ids_json, context_json, result_json, model, prompt_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      generatedAt,
      latestResetId,
      dashboard.resetContext.analysisWindowStart,
      activityIds[0] || null,
      JSON.stringify(activityIds),
      JSON.stringify(dashboard.resetContext),
      JSON.stringify(draft),
      ANALYSIS_MODEL,
      ANALYSIS_PROMPT_VERSION,
    ).run();
    const row: SnapshotRow = {
      id,
      generated_at: generatedAt,
      activity_ids_json: JSON.stringify(activityIds),
      context_json: JSON.stringify(dashboard.resetContext),
      result_json: JSON.stringify(draft),
      model: ANALYSIS_MODEL,
      prompt_version: ANALYSIS_PROMPT_VERSION,
    };
    return withMetadata(draft, dashboard.resetContext, row, previous, false);
  } catch (error) {
    if (!previous) throw error;
    return withMetadata(draftFromRow(previous), dashboard.resetContext, previous, null, true, true);
  } finally {
    inFlight.delete(id);
  }
}
