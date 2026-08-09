import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  publishedAt: text("published_at").notNull(),
  day: text("day").notNull(),
  link: text("link").notNull().default(""),
  type: text("type", { enum: ["original", "reply", "quote", "repost"] }).notNull(),
  targetHandle: text("target_handle"),
  authorHandle: text("author_handle"),
  source: text("source").notNull(),
  rawTitle: text("raw_title").notNull().default(""),
  fetchedAt: text("fetched_at").notNull(),
}, (table) => [
  index("idx_activities_published_at").on(table.publishedAt),
  index("idx_activities_day_type").on(table.day, table.type),
]);

export const fetchRuns = sqliteTable("fetch_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  itemCount: integer("item_count").notNull(),
  succeeded: integer("succeeded", { mode: "boolean" }).notNull().default(true),
  error: text("error"),
}, (table) => [index("idx_fetch_runs_status_time").on(table.succeeded, table.fetchedAt)]);

export const resetEvents = sqliteTable("reset_events", {
  id: text("id").primaryKey(),
  announcedAt: text("announced_at").notNull(),
  day: text("day").notNull(),
  kind: text("kind", { enum: ["global", "banked"] }).notNull(),
  status: text("status", { enum: ["completed", "rolling_out"] }).notNull(),
  scope: text("scope", { enum: ["paid_codex_chatgpt_work", "all_codex", "targeted"] }).notNull(),
  evidenceText: text("evidence_text").notNull(),
  evidenceUrl: text("evidence_url").notNull(),
  source: text("source").notNull(),
  discoveredAt: text("discovered_at").notNull(),
  activityId: text("activity_id"),
}, (table) => [index("idx_reset_events_announced_at").on(table.announcedAt)]);
