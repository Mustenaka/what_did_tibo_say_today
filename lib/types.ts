export type ActivityType = "original" | "reply" | "quote" | "repost";

export interface Activity {
  id: string;
  text: string;
  publishedAt: string;
  day: string;
  link: string;
  type: ActivityType;
  targetHandle: string | null;
  authorHandle: string;
  source: string;
  rawTitle: string;
}

export interface SourceResult {
  activities: Activity[];
  source: string;
  provider: string;
  fetchedAt: string;
  pages?: number;
}

export interface DailyRollup {
  date: string;
  total: number;
  original: number;
  reply: number;
  quote: number;
  repost: number;
}

export type ResetEventStatus = "completed" | "rolling_out";
export type ResetEventKind = "global" | "banked";
export type ResetEventScope = "paid_codex_chatgpt_work" | "all_codex" | "targeted";
export type ResetEventConfidence = "verified" | "inferred";

export interface ResetEvent {
  id: string;
  announcedAt: string;
  effectiveAt: string;
  completedAt: string | null;
  day: string;
  kind: ResetEventKind;
  status: ResetEventStatus;
  scope: ResetEventScope;
  confidence: ResetEventConfidence;
  extractionVersion: string;
  evidenceText: string;
  evidenceUrl: string;
  source: string;
}

export type ResetCadencePressure = "low" | "rising" | "high" | "due" | "unknown";
export type ResetLikelihood = "very_likely" | "likely" | "unlikely" | "none" | "unknown";
export type ExplicitResetSignalKind = "scheduled" | "promise" | "considering";

export interface ResetAnalysisContext {
  analysisWindowStart: string | null;
  lastResetAt: string | null;
  postResetActivityCount: number;
  hoursSinceReset: number | null;
  weeklyWindowHours: number;
  weeklyProgressPercent: number | null;
  estimatedNextWeeklyResetAt: string | null;
  cadencePressure: ResetCadencePressure;
  rapidRepeatCount30d: number;
  shortestIntervalHours: number | null;
  latestIntervalHours: number | null;
  explicitPostResetSignal: boolean;
  explicitPostResetSignalKind: ExplicitResetSignalKind | null;
  explicitPostResetSignalActivityId: string | null;
  explicitPostResetSignalText: string | null;
  explicitPostResetSignalAt: string | null;
  explicitPostResetSignalActiveUntil: string | null;
  cadenceSource: "public_reset_weekly_proxy";
}

export interface ResetAnalysisResult {
  likelihood: ResetLikelihood;
  reason?: string;
  summary?: string;
  keywords?: string[];
  context: ResetAnalysisContext;
  guardrail?: "no_post_reset_activity" | "recent_reset_cooldown" | "early_cycle_cap" | "explicit_reset_commitment" | "explicit_reset_promise" | null;
  snapshot?: {
    id: string;
    generatedAt: string;
    cached: boolean;
    stale?: boolean;
    promptVersion: string;
    model: string;
  };
  delta?: {
    previousLikelihood: ResetLikelihood | null;
    likelihoodChanged: boolean;
    newActivityCount: number;
    comparedAt: string | null;
  };
}

export interface DashboardData {
  range: { days: number; start: string; end: string };
  stats: {
    total: number;
    originals: number;
    interactions: number;
    replies: number;
    quotes: number;
    reposts: number;
  };
  daily: DailyRollup[];
  activities: Activity[];
  resetHistory: ResetEvent[];
  resetContext: ResetAnalysisContext;
  source: string | null;
  fetchedAt: string | null;
  coverage: {
    oldestDay: string | null;
    newestDay: string | null;
    storedCount: number;
    complete: boolean;
  };
  lastRefreshSucceeded: boolean | null;
  refreshError: string | null;
  stale?: boolean;
}
