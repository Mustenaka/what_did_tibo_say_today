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
