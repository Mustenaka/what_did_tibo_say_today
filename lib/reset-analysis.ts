import type {
  Activity,
  ResetAnalysisContext,
  ResetAnalysisResult,
  ResetEvent,
  ResetLikelihood,
} from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const WEEKLY_PROXY_HOURS = 7 * 24;

const explicitResetPattern = /\b(another\s+(?:performative\s+)?reset|reset\s+again|will\s+reset|reset\s+will|should\s+we\s+reset|reset\s+(?:is\s+)?coming|press(?:ed|ing)?\s+(?:the\s+)?(?:reset\s+)?button|reset(?:ting)?\s+(?:the\s+)?(?:codex|chatgpt work|usage|rate)\s*limits?)\b/i;

function asTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

export function hasExplicitPostResetSignal(activities: Activity[]) {
  return activities.some((activity) => explicitResetPattern.test(activity.text));
}

export function filterPostResetActivities(activities: Activity[], windowStart: string | null) {
  const start = asTime(windowStart);
  return activities.filter((activity) => {
    if (activity.type === "repost") return false;
    if (start === null) return true;
    const published = asTime(activity.publishedAt);
    return published !== null && published > start;
  });
}

export function buildResetAnalysisContext(
  activities: Activity[],
  resetEvents: ResetEvent[],
  now = new Date(),
): ResetAnalysisContext {
  const nowMs = now.getTime();
  const globalEvents = resetEvents
    .filter((event) => event.kind === "global" && event.scope !== "targeted")
    .map((event) => ({ event, time: asTime(event.effectiveAt || event.announcedAt) }))
    .filter((item): item is { event: ResetEvent; time: number } => item.time !== null && item.time <= nowMs)
    .sort((a, b) => b.time - a.time);

  const latest = globalEvents[0] || null;
  const lastResetAt = latest?.event.effectiveAt || latest?.event.announcedAt || null;
  const postResetActivities = filterPostResetActivities(activities, lastResetAt);
  const hoursSinceReset = latest ? Math.max(0, (nowMs - latest.time) / HOUR_MS) : null;
  const weeklyProgressPercent = hoursSinceReset === null
    ? null
    : Math.min(100, Math.round((hoursSinceReset / WEEKLY_PROXY_HOURS) * 100));
  const estimatedNextWeeklyResetAt = latest
    ? new Date(latest.time + WEEKLY_PROXY_HOURS * HOUR_MS).toISOString()
    : null;

  let cadencePressure: ResetAnalysisContext["cadencePressure"] = "unknown";
  if (hoursSinceReset !== null) {
    cadencePressure = hoursSinceReset >= WEEKLY_PROXY_HOURS
      ? "due"
      : hoursSinceReset >= 144
        ? "high"
        : hoursSinceReset >= 96
          ? "rising"
          : "low";
  }

  const thirtyDaysAgo = nowMs - 30 * DAY_MS;
  const recentChronological = globalEvents
    .filter((item) => item.time >= thirtyDaysAgo)
    .sort((a, b) => a.time - b.time);
  const intervals = recentChronological.slice(1).map((item, index) => (
    (item.time - recentChronological[index].time) / HOUR_MS
  )).filter((interval) => interval > 0);
  const latestIntervalHours = globalEvents.length > 1
    ? roundHours((globalEvents[0].time - globalEvents[1].time) / HOUR_MS)
    : null;

  return {
    analysisWindowStart: lastResetAt,
    lastResetAt,
    postResetActivityCount: postResetActivities.length,
    hoursSinceReset: hoursSinceReset === null ? null : roundHours(hoursSinceReset),
    weeklyWindowHours: WEEKLY_PROXY_HOURS,
    weeklyProgressPercent,
    estimatedNextWeeklyResetAt,
    cadencePressure,
    rapidRepeatCount30d: intervals.filter((interval) => interval <= 24).length,
    shortestIntervalHours: intervals.length ? roundHours(Math.min(...intervals)) : null,
    latestIntervalHours,
    explicitPostResetSignal: hasExplicitPostResetSignal(postResetActivities),
    cadenceSource: "public_reset_weekly_proxy",
  };
}

const rank: Record<ResetLikelihood, number> = {
  none: 0,
  unknown: 0,
  unlikely: 1,
  likely: 2,
  very_likely: 3,
};

export function applyResetAwareGuard(
  draft: Omit<ResetAnalysisResult, "context" | "guardrail">,
  context: ResetAnalysisContext,
): ResetAnalysisResult {
  if (context.postResetActivityCount === 0) {
    return {
      likelihood: "none",
      reason: "The latest global reset closes the previous evidence window, and no newer Tibo activity is available yet.",
      summary: "Waiting for post-reset signals.",
      keywords: [],
      context,
      guardrail: "no_post_reset_activity",
    };
  }

  if (
    context.hoursSinceReset !== null
    && context.hoursSinceReset < 24
    && !context.explicitPostResetSignal
    && rank[draft.likelihood] > rank.unlikely
  ) {
    return {
      ...draft,
      likelihood: "unlikely",
      reason: `${draft.reason || "No explicit new reset signal was found."} A global reset occurred less than 24 hours ago, so the recent-reset cooldown applies.`,
      context,
      guardrail: "recent_reset_cooldown",
    };
  }

  if (
    (context.weeklyProgressPercent ?? 0) < 35
    && !context.explicitPostResetSignal
    && draft.likelihood === "very_likely"
  ) {
    return {
      ...draft,
      likelihood: "likely",
      reason: `${draft.reason || "Some new signals are present."} The weekly-window proxy is still early, so the result is capped below “very likely.”`,
      context,
      guardrail: "early_cycle_cap",
    };
  }

  return { ...draft, context, guardrail: null };
}
