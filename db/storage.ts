import { getD1 } from ".";
import { fetchRecentActivities } from "../lib/activity-source";
import { getRuntimeEnv } from "../lib/runtime-env";
import type { Activity, DashboardData, DailyRollup, SourceResult } from "../lib/types";

const ACTIVITY_TYPES = new Set(["original", "reply", "quote", "repost"]);
let schemaReady: Promise<void> | null = null;
let refreshInFlight: Promise<void> | null = null;

function utcDay(offset = 0, now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  return date.toISOString().slice(0, 10);
}

export function ensureDatabase() {
  schemaReady ||= (async () => {
    const db = getD1();
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          published_at TEXT NOT NULL,
          day TEXT NOT NULL,
          link TEXT NOT NULL DEFAULT '',
          type TEXT NOT NULL CHECK (type IN ('original', 'reply', 'quote', 'repost')),
          target_handle TEXT,
          author_handle TEXT,
          source TEXT NOT NULL,
          raw_title TEXT NOT NULL DEFAULT '',
          fetched_at TEXT NOT NULL
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS fetch_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          item_count INTEGER NOT NULL,
          succeeded INTEGER NOT NULL DEFAULT 1,
          error TEXT
        )
      `),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_activities_published_at ON activities(published_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_activities_day_type ON activities(day, type)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_fetch_runs_status_time ON fetch_runs(succeeded, fetched_at)"),
    ]);
  })();
  return schemaReady;
}

async function saveFetch(result: SourceResult) {
  await ensureDatabase();
  const db = getD1();
  const statements = result.activities
    .filter((activity) => ACTIVITY_TYPES.has(activity.type))
    .map((activity) => db.prepare(`
      INSERT INTO activities (
        id, text, published_at, day, link, type, target_handle, author_handle,
        source, raw_title, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        published_at = excluded.published_at,
        day = excluded.day,
        link = excluded.link,
        type = excluded.type,
        target_handle = excluded.target_handle,
        author_handle = excluded.author_handle,
        source = excluded.source,
        raw_title = excluded.raw_title,
        fetched_at = excluded.fetched_at
    `).bind(
      activity.id,
      activity.text,
      activity.publishedAt,
      activity.day,
      activity.link || "",
      activity.type,
      activity.targetHandle,
      activity.authorHandle,
      activity.source || result.source,
      activity.rawTitle || "",
      result.fetchedAt,
    ));

  for (let index = 0; index < statements.length; index += 75) {
    await db.batch(statements.slice(index, index + 75));
  }
  await db.batch([
    db.prepare(`
      INSERT INTO fetch_runs (source, fetched_at, item_count, succeeded, error)
      VALUES (?, ?, ?, 1, NULL)
    `).bind(result.source, result.fetchedAt, result.activities.length),
    db.prepare("DELETE FROM activities WHERE published_at < ?")
      .bind(`${utcDay(-30)}T00:00:00.000Z`),
  ]);
}

async function saveFetchFailure(error: unknown) {
  await ensureDatabase();
  const message = error instanceof Error ? error.message : String(error);
  await getD1().prepare(`
    INSERT INTO fetch_runs (source, fetched_at, item_count, succeeded, error)
    VALUES ('unavailable', ?, 0, 0, ?)
  `).bind(new Date().toISOString(), message.slice(0, 1000)).run();
}

async function hasFreshSuccess() {
  await ensureDatabase();
  const row = await getD1().prepare(`
    SELECT fetched_at AS fetchedAt
    FROM fetch_runs WHERE succeeded = 1
    ORDER BY id DESC LIMIT 1
  `).first<{ fetchedAt: string }>();
  if (!row?.fetchedAt) return false;
  const configured = Number.parseInt(getRuntimeEnv().REFRESH_TTL_SECONDS || "600", 10);
  const ttlMs = Math.min(3600, Math.max(60, configured || 600)) * 1000;
  return Date.now() - new Date(row.fetchedAt).getTime() < ttlMs;
}

export async function refreshIfNeeded(days = 7, force = false) {
  if (!force && await hasFreshSuccess()) return;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const result = await fetchRecentActivities(days);
        await saveFetch(result);
      } catch (error) {
        await saveFetchFailure(error);
        throw error;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  await refreshInFlight;
}

function activityFromRow(row: Record<string, unknown>): Activity {
  return {
    id: String(row.id),
    text: String(row.text || ""),
    publishedAt: String(row.published_at),
    day: String(row.day),
    link: String(row.link || ""),
    type: String(row.type) as Activity["type"],
    targetHandle: row.target_handle ? String(row.target_handle) : null,
    authorHandle: String(row.author_handle || "thsottiaux"),
    source: String(row.source || ""),
    rawTitle: String(row.raw_title || ""),
  };
}

export async function getRecentDashboard(days = 7, now = new Date()): Promise<DashboardData> {
  await ensureDatabase();
  const safeDays = Math.min(30, Math.max(1, Number.parseInt(String(days), 10) || 7));
  const start = utcDay(-(safeDays - 1), now);
  const end = utcDay(0, now);
  const db = getD1();
  const rows = await db.prepare(`
    SELECT * FROM activities
    WHERE published_at >= ? AND published_at < ?
    ORDER BY published_at DESC
  `).bind(`${start}T00:00:00.000Z`, `${utcDay(1, now)}T00:00:00.000Z`).all<Record<string, unknown>>();
  const activities = (rows.results || []).map(activityFromRow);

  const daily = new Map<string, DailyRollup>();
  for (let offset = -(safeDays - 1); offset <= 0; offset += 1) {
    const date = utcDay(offset, now);
    daily.set(date, { date, total: 0, original: 0, reply: 0, quote: 0, repost: 0 });
  }
  const stats = { total: 0, originals: 0, interactions: 0, replies: 0, quotes: 0, reposts: 0 };
  for (const activity of activities) {
    const item = daily.get(activity.day);
    if (item) {
      item.total += 1;
      item[activity.type] += 1;
    }
    stats.total += 1;
    if (activity.type === "original") stats.originals += 1;
    else stats.interactions += 1;
    if (activity.type === "reply") stats.replies += 1;
    if (activity.type === "quote") stats.quotes += 1;
    if (activity.type === "repost") stats.reposts += 1;
  }

  const [latestAttempt, latestSuccess, coverage] = await Promise.all([
    db.prepare("SELECT source, fetched_at AS fetchedAt, succeeded, error FROM fetch_runs ORDER BY id DESC LIMIT 1")
      .first<{ source: string; fetchedAt: string; succeeded: number; error: string | null }>(),
    db.prepare("SELECT source, fetched_at AS fetchedAt FROM fetch_runs WHERE succeeded = 1 ORDER BY id DESC LIMIT 1")
      .first<{ source: string; fetchedAt: string }>(),
    db.prepare(`
      SELECT MIN(day) AS oldestDay, MAX(day) AS newestDay, COUNT(*) AS storedCount
      FROM activities
    `).first<{ oldestDay: string | null; newestDay: string | null; storedCount: number }>(),
  ]);

  return {
    range: { days: safeDays, start, end },
    stats,
    daily: [...daily.values()],
    activities,
    source: latestSuccess?.source || null,
    fetchedAt: latestSuccess?.fetchedAt || null,
    coverage: {
      oldestDay: coverage?.oldestDay || null,
      newestDay: coverage?.newestDay || null,
      storedCount: Number(coverage?.storedCount || 0),
      complete: Boolean(coverage?.oldestDay && coverage.oldestDay <= start),
    },
    lastRefreshSucceeded: latestAttempt ? Boolean(latestAttempt.succeeded) : null,
    refreshError: latestAttempt?.error || null,
  };
}
