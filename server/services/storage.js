import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configuredDatabasePath = process.env.DATA_DB_PATH || 'data/tibo-activity.sqlite';
const defaultDatabasePath = configuredDatabasePath === ':memory:'
  ? ':memory:'
  : resolve(serverRoot, configuredDatabasePath);

const ACTIVITY_TYPES = ['original', 'reply', 'quote', 'repost'];

function utcDay(offset = 0, now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  return date.toISOString().slice(0, 10);
}

function activityFromRow(row) {
  return {
    id: row.id,
    text: row.text,
    publishedAt: row.published_at,
    day: row.day,
    link: row.link,
    type: row.type,
    targetHandle: row.target_handle,
    authorHandle: row.author_handle,
    source: row.source,
  };
}

export function createActivityStore(databasePath = defaultDatabasePath) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
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
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS fetch_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      item_count INTEGER NOT NULL,
      succeeded INTEGER NOT NULL DEFAULT 1,
      error TEXT
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_activities_published_at ON activities(published_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_activities_day_type ON activities(day, type)');
  db.exec('PRAGMA optimize');

  const upsertActivity = db.prepare(`
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
  `);
  const insertFetchRun = db.prepare(`
    INSERT INTO fetch_runs (source, fetched_at, item_count, succeeded, error)
    VALUES (?, ?, ?, ?, ?)
  `);

  function saveFetch({ activities, source, fetchedAt }) {
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const activity of activities) {
        if (!ACTIVITY_TYPES.includes(activity.type)) continue;
        upsertActivity.run(
          activity.id,
          activity.text,
          activity.publishedAt,
          activity.day,
          activity.link || '',
          activity.type,
          activity.targetHandle,
          activity.authorHandle,
          activity.source || source,
          activity.rawTitle || '',
          fetchedAt,
        );
      }
      insertFetchRun.run(source, fetchedAt, activities.length, 1, null);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function saveFetchFailure(error, fetchedAt = new Date().toISOString()) {
    insertFetchRun.run('unavailable', fetchedAt, 0, 0, String(error?.message || error));
  }

  function getRecent(days = 7, now = new Date()) {
    const safeDays = Math.min(30, Math.max(1, Number.parseInt(days, 10) || 7));
    const start = utcDay(-(safeDays - 1), now);
    const end = utcDay(1, now);
    const rows = db.prepare(`
      SELECT * FROM activities
      WHERE published_at >= ? AND published_at < ?
      ORDER BY published_at DESC
    `).all(`${start}T00:00:00.000Z`, `${end}T00:00:00.000Z`);

    const activities = rows.map(activityFromRow);
    const dailyMap = new Map();
    for (let offset = -(safeDays - 1); offset <= 0; offset += 1) {
      const date = utcDay(offset, now);
      dailyMap.set(date, {
        date,
        total: 0,
        original: 0,
        reply: 0,
        quote: 0,
        repost: 0,
      });
    }

    const stats = {
      total: 0,
      originals: 0,
      interactions: 0,
      replies: 0,
      quotes: 0,
      reposts: 0,
    };

    for (const activity of activities) {
      const day = dailyMap.get(activity.day);
      if (day) {
        day.total += 1;
        day[activity.type] += 1;
      }
      stats.total += 1;
      if (activity.type === 'original') stats.originals += 1;
      else stats.interactions += 1;
      if (activity.type === 'reply') stats.replies += 1;
      if (activity.type === 'quote') stats.quotes += 1;
      if (activity.type === 'repost') stats.reposts += 1;
    }

    const latestAttempt = db.prepare(`
      SELECT source, fetched_at, succeeded, error
      FROM fetch_runs ORDER BY id DESC LIMIT 1
    `).get();
    const latestSuccess = db.prepare(`
      SELECT source, fetched_at
      FROM fetch_runs WHERE succeeded = 1 ORDER BY id DESC LIMIT 1
    `).get();
    const coverage = db.prepare(`
      SELECT MIN(day) AS oldest_day, MAX(day) AS newest_day, COUNT(*) AS stored_count
      FROM activities
    `).get();

    return {
      range: { days: safeDays, start, end: utcDay(0, now) },
      stats,
      daily: [...dailyMap.values()],
      activities,
      source: latestSuccess?.source || null,
      fetchedAt: latestSuccess?.fetched_at || null,
      coverage: {
        oldestDay: coverage?.oldest_day || null,
        newestDay: coverage?.newest_day || null,
        storedCount: coverage?.stored_count || 0,
        complete: Boolean(coverage?.oldest_day && coverage.oldest_day <= start),
      },
      lastRefreshSucceeded: latestAttempt ? Boolean(latestAttempt.succeeded) : null,
      refreshError: latestAttempt?.error || null,
    };
  }

  return {
    saveFetch,
    saveFetchFailure,
    getRecent,
    close: () => db.close(),
  };
}

let defaultStore;

export function getActivityStore() {
  defaultStore ||= createActivityStore();
  return defaultStore;
}
