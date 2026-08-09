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
  effectiveAt: text("effective_at"),
  completedAt: text("completed_at"),
  day: text("day").notNull(),
  kind: text("kind", { enum: ["global", "banked"] }).notNull(),
  status: text("status", { enum: ["completed", "rolling_out"] }).notNull(),
  scope: text("scope", { enum: ["paid_codex_chatgpt_work", "all_codex", "targeted"] }).notNull(),
  evidenceText: text("evidence_text").notNull(),
  evidenceUrl: text("evidence_url").notNull(),
  source: text("source").notNull(),
  confidence: text("confidence", { enum: ["verified", "inferred"] }).notNull().default("verified"),
  extractionVersion: text("extraction_version").notNull().default("legacy-v1"),
  discoveredAt: text("discovered_at").notNull(),
  activityId: text("activity_id"),
}, (table) => [index("idx_reset_events_announced_at").on(table.announcedAt)]);

export const analysisSnapshots = sqliteTable("analysis_snapshots", {
  id: text("id").primaryKey(),
  generatedAt: text("generated_at").notNull(),
  latestResetId: text("latest_reset_id"),
  analysisWindowStart: text("analysis_window_start"),
  latestActivityId: text("latest_activity_id"),
  activityIdsJson: text("activity_ids_json").notNull(),
  contextJson: text("context_json").notNull(),
  resultJson: text("result_json").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  outcomeResetId: text("outcome_reset_id"),
  evaluatedAt: text("evaluated_at"),
}, (table) => [
  index("idx_analysis_snapshots_generated_at").on(table.generatedAt),
  index("idx_analysis_snapshots_outcome_reset_id").on(table.outcomeResetId),
]);
