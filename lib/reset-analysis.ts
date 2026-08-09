import type {
  Activity,
  ExplicitResetSignalKind,
  ResetAnalysisContext,
  ResetAnalysisResult,
  ResetEvent,
  ResetLikelihood,
} from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
export const WEEKLY_PROXY_HOURS = 7 * 24;

const scheduledTimePattern = /\b(?:on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|today|tonight|tomorrow|this\s+weekend|next\s+week|in\s+\d+\s+(?:hours?|days?))\b/i;
const directPromisePattern = /\b(?:i(?:['’]ll|\s+will|\s+am\s+going\s+to)|we(?:['’]ll|\s+will|\s+are\s+going\s+to))\b[\s\S]{0,100}\b(?:another\s+)?(?:performative\s+)?reset\b|\b(?:reset\s+(?:is\s+)?coming|will\s+(?:fully\s+)?reset|reset\s+will|pressing\s+(?:the\s+)?(?:reset\s+)?button)\b/i;
const consideringResetPattern = /\b(?:should\s+we\s+reset|thinking\s+(?:about|of)\s+(?:another\s+)?reset|feeling\s+like\s+(?:a\s+)?(?:limit\s+)?reset|might\s+reset|maybe\s+(?:another\s+)?reset)\b/i;

type ExplicitResetSignal = {
  kind: ExplicitResetSignalKind;
  activity: Activity;
  activeUntil: string;
};

function asTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

function signalKind(text: string): ExplicitResetSignalKind | null {
  if (directPromisePattern.test(text)) {
    return scheduledTimePattern.test(text) ? "scheduled" : "promise";
  }
  return consideringResetPattern.test(text) ? "considering" : null;
}

function endOfUtcDayWithGrace(date: Date) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    12,
  ));
}

function signalActiveUntil(text: string, publishedAt: string, kind: ExplicitResetSignalKind) {
  const published = new Date(publishedAt);
  const publishedMs = published.getTime();
  if (!Number.isFinite(publishedMs)) return null;

  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const weekday = text.match(/\bon\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1].toLowerCase();
  if (weekday) {
    const targetDay = weekdayNames.indexOf(weekday);
    const daysAhead = (targetDay - published.getUTCDay() + 7) % 7;
    const target = new Date(publishedMs + daysAhead * DAY_MS);
    return endOfUtcDayWithGrace(target).toISOString();
  }

  if (/\b(?:today|tonight)\b/i.test(text)) return endOfUtcDayWithGrace(published).toISOString();
  if (/\btomorrow\b/i.test(text)) return endOfUtcDayWithGrace(new Date(publishedMs + DAY_MS)).toISOString();
  if (/\bthis\s+weekend\b/i.test(text)) {
    const daysToSunday = (7 - published.getUTCDay()) % 7;
    return endOfUtcDayWithGrace(new Date(publishedMs + daysToSunday * DAY_MS)).toISOString();
  }
  if (/\bnext\s+week\b/i.test(text)) return new Date(publishedMs + 10 * DAY_MS).toISOString();

  const relative = text.match(/\bin\s+(\d+)\s+(hours?|days?)\b/i);
  if (relative) {
    const amount = Number.parseInt(relative[1], 10);
    const unitMs = relative[2].toLowerCase().startsWith("day") ? DAY_MS : HOUR_MS;
    return new Date(publishedMs + amount * unitMs + 12 * HOUR_MS).toISOString();
  }

  const ttl = kind === "scheduled" ? 96 : kind === "promise" ? 72 : 36;
  return new Date(publishedMs + ttl * HOUR_MS).toISOString();
}

export function findExplicitPostResetSignal(activities: Activity[], now = new Date()): ExplicitResetSignal | null {
  const strength: Record<ExplicitResetSignalKind, number> = { considering: 1, promise: 2, scheduled: 3 };
  return activities
    .map((activity) => {
      const kind = signalKind(activity.text);
      const activeUntil = kind ? signalActiveUntil(activity.text, activity.publishedAt, kind) : null;
      return kind && activeUntil ? { kind, activity, activeUntil } : null;
    })
    .filter((signal): signal is ExplicitResetSignal => (
      signal !== null && new Date(signal.activeUntil).getTime() >= now.getTime()
    ))
    .sort((left, right) => (
      strength[right.kind] - strength[left.kind]
      || new Date(right.activity.publishedAt).getTime() - new Date(left.activity.publishedAt).getTime()
    ))[0] || null;
}

export function hasExplicitPostResetSignal(activities: Activity[], now = new Date()) {
  return Boolean(findExplicitPostResetSignal(activities, now));
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
  const explicitSignal = findExplicitPostResetSignal(postResetActivities, now);
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
    explicitPostResetSignal: Boolean(explicitSignal),
    explicitPostResetSignalKind: explicitSignal?.kind || null,
    explicitPostResetSignalActivityId: explicitSignal?.activity.id || null,
    explicitPostResetSignalText: explicitSignal?.activity.text || null,
    explicitPostResetSignalAt: explicitSignal?.activity.publishedAt || null,
    explicitPostResetSignalActiveUntil: explicitSignal?.activeUntil || null,
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

  if (context.explicitPostResetSignal && context.explicitPostResetSignalKind === "scheduled") {
    return {
      ...draft,
      likelihood: "very_likely",
      reason: "Tibo explicitly committed to another reset on a named near-term schedule, so this direct promise overrides the recent-reset cooldown and cadence baseline.",
      summary: "A time-bound reset commitment is active.",
      keywords: [...new Set(["explicit reset commitment", "scheduled reset", ...(draft.keywords || [])])].slice(0, 8),
      context,
      guardrail: "explicit_reset_commitment",
    };
  }

  if (
    context.explicitPostResetSignal
    && context.explicitPostResetSignalKind === "promise"
    && rank[draft.likelihood] < rank.likely
  ) {
    return {
      ...draft,
      likelihood: "likely",
      reason: "Tibo made a direct new reset promise. It has no named execution time, so it creates a strong likelihood floor without being treated as a scheduled reset.",
      summary: "A direct reset promise is active.",
      keywords: [...new Set(["explicit reset promise", ...(draft.keywords || [])])].slice(0, 8),
      context,
      guardrail: "explicit_reset_promise",
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
