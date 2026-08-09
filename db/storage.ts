import { getD1 } from ".";
import { fetchRecentActivities } from "../lib/activity-source";
import { getRuntimeEnv } from "../lib/runtime-env";
import { CURATED_RESET_EVENTS, resetEventFromActivity } from "../lib/reset-history";
import { buildResetAnalysisContext } from "../lib/reset-analysis";
import type { Activity, DashboardData, DailyRollup, ResetEvent, SourceResult } from "../lib/types";

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
      db.prepare(`
        CREATE TABLE IF NOT EXISTS reset_events (
          id TEXT PRIMARY KEY,
          announced_at TEXT NOT NULL,
          effective_at TEXT,
          completed_at TEXT,
          day TEXT NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('global', 'banked')),
          status TEXT NOT NULL CHECK (status IN ('completed', 'rolling_out')),
          scope TEXT NOT NULL CHECK (scope IN ('paid_codex_chatgpt_work', 'all_codex', 'targeted')),
          evidence_text TEXT NOT NULL,
          evidence_url TEXT NOT NULL,
          source TEXT NOT NULL,
          confidence TEXT NOT NULL DEFAULT 'verified' CHECK (confidence IN ('verified', 'inferred')),
          extraction_version TEXT NOT NULL DEFAULT 'legacy-v1',
          discovered_at TEXT NOT NULL,
          activity_id TEXT
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS analysis_snapshots (
          id TEXT PRIMARY KEY,
          generated_at TEXT NOT NULL,
          latest_reset_id TEXT,
          analysis_window_start TEXT,
          latest_activity_id TEXT,
          activity_ids_json TEXT NOT NULL,
          context_json TEXT NOT NULL,
          result_json TEXT NOT NULL,
          model TEXT NOT NULL,
          prompt_version TEXT NOT NULL,
          outcome_reset_id TEXT,
          evaluated_at TEXT
        )
      `),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_activities_published_at ON activities(published_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_activities_day_type ON activities(day, type)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_fetch_runs_status_time ON fetch_runs(succeeded, fetched_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_reset_events_announced_at ON reset_events(announced_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_analysis_snapshots_generated_at ON analysis_snapshots(generated_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_analysis_snapshots_outcome_reset_id ON analysis_snapshots(outcome_reset_id)"),
    ]);
    const resetColumnRows = await db.prepare("PRAGMA table_info(reset_events)")
      .all<{ name: string }>();
    const resetColumns = new Set((resetColumnRows.results || []).map((column) => column.name));
    const resetAlterations = [
      !resetColumns.has("effective_at") ? db.prepare("ALTER TABLE reset_events ADD COLUMN effective_at TEXT") : null,
      !resetColumns.has("completed_at") ? db.prepare("ALTER TABLE reset_events ADD COLUMN completed_at TEXT") : null,
      !resetColumns.has("confidence") ? db.prepare("ALTER TABLE reset_events ADD COLUMN confidence TEXT NOT NULL DEFAULT 'verified'") : null,
      !resetColumns.has("extraction_version") ? db.prepare("ALTER TABLE reset_events ADD COLUMN extraction_version TEXT NOT NULL DEFAULT 'legacy-v1'") : null,
    ].filter((statement): statement is NonNullable<typeof statement> => statement !== null);
    if (resetAlterations.length) await db.batch(resetAlterations);
    await db.batch(CURATED_RESET_EVENTS.map((reset) => db.prepare(`
      INSERT OR IGNORE INTO reset_events (
        id, announced_at, effective_at, completed_at, day, kind, status, scope,
        evidence_text, evidence_url, source, confidence, extraction_version,
        discovered_at, activity_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      reset.id,
      reset.announcedAt,
      reset.effectiveAt,
      reset.completedAt,
      reset.day,
      reset.kind,
      reset.status,
      reset.scope,
      reset.evidenceText,
      reset.evidenceUrl,
      reset.source,
      reset.confidence,
      reset.extractionVersion,
      reset.discoveredAt,
      reset.activityId,
    )));
    await db.batch([
      db.prepare("UPDATE reset_events SET effective_at = announced_at WHERE effective_at IS NULL"),
      db.prepare("UPDATE reset_events SET completed_at = announced_at WHERE completed_at IS NULL AND status = 'completed'"),
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
  const discoveredResets = result.activities
    .map((activity) => resetEventFromActivity(activity, result.fetchedAt))
    .filter((reset): reset is NonNullable<typeof reset> => Boolean(reset));
  const resetStatements = discoveredResets.map((reset) => db.prepare(`
      INSERT INTO reset_events (
        id, announced_at, effective_at, completed_at, day, kind, status, scope,
        evidence_text, evidence_url, source, confidence, extraction_version,
        discovered_at, activity_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        announced_at = excluded.announced_at,
        effective_at = excluded.effective_at,
        completed_at = excluded.completed_at,
        day = excluded.day,
        kind = excluded.kind,
        status = excluded.status,
        scope = excluded.scope,
        evidence_text = excluded.evidence_text,
        evidence_url = excluded.evidence_url,
        source = excluded.source,
        confidence = excluded.confidence,
        extraction_version = excluded.extraction_version,
        discovered_at = excluded.discovered_at,
        activity_id = excluded.activity_id
    `).bind(
      reset.id,
      reset.announcedAt,
      reset.effectiveAt,
      reset.completedAt,
      reset.day,
      reset.kind,
      reset.status,
      reset.scope,
      reset.evidenceText,
      reset.evidenceUrl,
      reset.source,
      reset.confidence,
      reset.extractionVersion,
      reset.discoveredAt,
      reset.activityId,
    ));
  if (resetStatements.length) await db.batch(resetStatements);
  for (const reset of discoveredResets.filter((item) => item.kind === "global" && item.scope !== "targeted")) {
    const lookback = new Date(new Date(reset.effectiveAt).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.prepare(`
      UPDATE analysis_snapshots
      SET outcome_reset_id = ?, evaluated_at = ?
      WHERE outcome_reset_id IS NULL AND generated_at >= ? AND generated_at < ?
    `).bind(reset.id, result.fetchedAt, lookback, reset.effectiveAt).run();
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

function resetEventFromRow(row: Record<string, unknown>): ResetEvent {
  return {
    id: String(row.id),
    announcedAt: String(row.announced_at),
    effectiveAt: String(row.effective_at || row.announced_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    day: String(row.day),
    kind: String(row.kind) as ResetEvent["kind"],
    status: String(row.status) as ResetEvent["status"],
    scope: String(row.scope) as ResetEvent["scope"],
    confidence: String(row.confidence || "verified") as ResetEvent["confidence"],
    extractionVersion: String(row.extraction_version || "legacy-v1"),
    evidenceText: String(row.evidence_text || ""),
    evidenceUrl: String(row.evidence_url || ""),
    source: String(row.source || "tibo_x"),
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

  const [latestAttempt, latestSuccess, coverage, resetRows] = await Promise.all([
    db.prepare("SELECT source, fetched_at AS fetchedAt, succeeded, error FROM fetch_runs ORDER BY id DESC LIMIT 1")
      .first<{ source: string; fetchedAt: string; succeeded: number; error: string | null }>(),
    db.prepare("SELECT source, fetched_at AS fetchedAt FROM fetch_runs WHERE succeeded = 1 ORDER BY id DESC LIMIT 1")
      .first<{ source: string; fetchedAt: string }>(),
    db.prepare(`
      SELECT MIN(day) AS oldestDay, MAX(day) AS newestDay, COUNT(*) AS storedCount
      FROM activities
    `).first<{ oldestDay: string | null; newestDay: string | null; storedCount: number }>(),
    db.prepare(`
      SELECT id, announced_at, effective_at, completed_at, day, kind, status, scope,
             evidence_text, evidence_url, source, confidence, extraction_version
      FROM reset_events
      ORDER BY announced_at DESC
      LIMIT 30
    `).all<Record<string, unknown>>(),
  ]);
  const allResetEvents = (resetRows.results || []).map(resetEventFromRow);

  return {
    range: { days: safeDays, start, end },
    stats,
    daily: [...daily.values()],
    activities,
    resetHistory: allResetEvents.slice(0, 8),
    resetContext: buildResetAnalysisContext(activities, allResetEvents, now),
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
