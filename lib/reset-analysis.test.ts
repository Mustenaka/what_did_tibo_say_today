import assert from "node:assert/strict";
import test from "node:test";
import { applyResetAwareGuard, buildResetAnalysisContext, filterPostResetActivities } from "./reset-analysis.ts";
import type { Activity, ResetAnalysisContext, ResetEvent } from "./types";

function activity(id: string, publishedAt: string, text: string): Activity {
  return {
    id,
    text,
    publishedAt,
    day: publishedAt.slice(0, 10),
    link: `https://x.com/thsottiaux/status/${id}`,
    type: "original",
    targetHandle: null,
    authorHandle: "thsottiaux",
    source: "test",
    rawTitle: "",
  };
}

function reset(id: string, announcedAt: string): ResetEvent {
  return {
    id,
    announcedAt,
    effectiveAt: announcedAt,
    completedAt: announcedAt,
    day: announcedAt.slice(0, 10),
    kind: "global",
    status: "completed",
    scope: "paid_codex_chatgpt_work",
    confidence: "verified",
    extractionVersion: "test-v1",
    evidenceText: "Usage limits have been reset.",
    evidenceUrl: `https://x.com/thsottiaux/status/${id}`,
    source: "test",
  };
}

test("the completed reset closes the old evidence window", () => {
  const latest = reset("reset", "2026-08-08T20:29:22.000Z");
  const activities = [
    activity("before", "2026-08-08T19:00:00.000Z", "There will be signs"),
    activity("reset", "2026-08-08T20:29:22.000Z", "I have reset usage limits"),
    activity("after", "2026-08-08T20:34:50.000Z", "I'll do another performative reset on Monday"),
  ];

  const filtered = filterPostResetActivities(activities, latest.announcedAt);
  const context = buildResetAnalysisContext(activities, [latest], new Date("2026-08-09T08:00:00.000Z"));

  assert.deepEqual(filtered.map((item) => item.id), ["after"]);
  assert.equal(context.postResetActivityCount, 1);
  assert.equal(context.explicitPostResetSignal, true);
  assert.equal(context.explicitPostResetSignalKind, "scheduled");
  assert.equal(context.explicitPostResetSignalActivityId, "after");
  assert.equal(context.explicitPostResetSignalActiveUntil, "2026-08-11T12:00:00.000Z");
});

test("the evidence window follows effective time when it differs from the announcement", () => {
  const latest = {
    ...reset("reset", "2026-08-08T21:00:00.000Z"),
    effectiveAt: "2026-08-08T20:00:00.000Z",
  };
  const activities = [
    activity("between", "2026-08-08T20:30:00.000Z", "A post after the effective reset"),
  ];
  const context = buildResetAnalysisContext(activities, [latest], new Date("2026-08-09T08:00:00.000Z"));

  assert.equal(context.analysisWindowStart, latest.effectiveAt);
  assert.equal(context.postResetActivityCount, 1);
});

test("the weekly proxy increases as the next weekly window approaches", () => {
  const latest = reset("reset", "2026-08-08T20:00:00.000Z");
  const early = buildResetAnalysisContext([], [latest], new Date("2026-08-09T08:00:00.000Z"));
  const late = buildResetAnalysisContext([], [latest], new Date("2026-08-15T12:00:00.000Z"));

  assert.equal(early.cadencePressure, "low");
  assert.ok((early.weeklyProgressPercent || 0) < 10);
  assert.equal(late.cadencePressure, "high");
  assert.ok((late.weeklyProgressPercent || 0) > 90);
});

test("rapid-repeat history is retained as a separate factor", () => {
  const events = [
    reset("latest", "2026-08-08T20:00:00.000Z"),
    reset("same-day", "2026-08-08T03:00:00.000Z"),
    reset("older", "2026-08-01T03:00:00.000Z"),
  ];
  const context = buildResetAnalysisContext([], events, new Date("2026-08-09T00:00:00.000Z"));

  assert.equal(context.rapidRepeatCount30d, 1);
  assert.equal(context.shortestIntervalHours, 17);
  assert.equal(context.latestIntervalHours, 17);
});

test("a recent reset caps high predictions unless a new explicit signal exists", () => {
  const base: ResetAnalysisContext = {
    analysisWindowStart: "2026-08-08T20:00:00.000Z",
    lastResetAt: "2026-08-08T20:00:00.000Z",
    postResetActivityCount: 3,
    hoursSinceReset: 12,
    weeklyWindowHours: 168,
    weeklyProgressPercent: 7,
    estimatedNextWeeklyResetAt: "2026-08-15T20:00:00.000Z",
    cadencePressure: "low",
    rapidRepeatCount30d: 2,
    shortestIntervalHours: 11.9,
    latestIntervalHours: 72,
    explicitPostResetSignal: false,
    explicitPostResetSignalKind: null,
    explicitPostResetSignalActivityId: null,
    explicitPostResetSignalText: null,
    explicitPostResetSignalAt: null,
    explicitPostResetSignalActiveUntil: null,
    cadenceSource: "public_reset_weekly_proxy",
  };

  const cooled = applyResetAwareGuard({ likelihood: "very_likely", reason: "General activity is high." }, base);
  const overridden = applyResetAwareGuard({ likelihood: "very_likely", reason: "A new reset was promised." }, {
    ...base,
    explicitPostResetSignal: true,
  });

  assert.equal(cooled.likelihood, "unlikely");
  assert.equal(cooled.guardrail, "recent_reset_cooldown");
  assert.equal(overridden.likelihood, "very_likely");
  assert.equal(overridden.guardrail, null);
});

test("a scheduled reset commitment deterministically overrides an unlikely model draft", () => {
  const latest = reset("reset", "2026-08-08T20:29:22.000Z");
  const activities = [
    activity("promise", "2026-08-08T20:34:50.000Z", "I'll do another performative reset on Monday"),
  ];
  const context = buildResetAnalysisContext(activities, [latest], new Date("2026-08-10T08:00:00.000Z"));
  const result = applyResetAwareGuard({ likelihood: "unlikely", reason: "The weekly cycle is early." }, context);

  assert.equal(result.likelihood, "very_likely");
  assert.equal(result.guardrail, "explicit_reset_commitment");
  assert.match(result.reason || "", /explicitly committed/i);
});

test("an expired scheduled commitment no longer overrides the model", () => {
  const latest = reset("reset", "2026-08-08T20:29:22.000Z");
  const activities = [
    activity("promise", "2026-08-08T20:34:50.000Z", "I'll do another performative reset on Monday"),
  ];
  const context = buildResetAnalysisContext(activities, [latest], new Date("2026-08-11T13:00:00.000Z"));
  const result = applyResetAwareGuard({ likelihood: "unlikely", reason: "The promise window passed." }, context);

  assert.equal(context.explicitPostResetSignal, false);
  assert.equal(result.likelihood, "unlikely");
  assert.equal(result.guardrail, null);
});

test("a direct promise without a date creates a likely floor", () => {
  const latest = reset("reset", "2026-08-08T20:29:22.000Z");
  const activities = [activity("promise", "2026-08-09T01:00:00.000Z", "I'll reset usage limits again")];
  const context = buildResetAnalysisContext(activities, [latest], new Date("2026-08-09T08:00:00.000Z"));
  const result = applyResetAwareGuard({ likelihood: "unlikely" }, context);

  assert.equal(context.explicitPostResetSignalKind, "promise");
  assert.equal(result.likelihood, "likely");
  assert.equal(result.guardrail, "explicit_reset_promise");
});

test("an exploratory reset question is not promoted as a commitment", () => {
  const latest = reset("reset", "2026-08-08T20:29:22.000Z");
  const activities = [activity("question", "2026-08-09T01:00:00.000Z", "Should we reset Codex again?")];
  const context = buildResetAnalysisContext(activities, [latest], new Date("2026-08-09T08:00:00.000Z"));
  const result = applyResetAwareGuard({ likelihood: "unlikely" }, context);

  assert.equal(context.explicitPostResetSignalKind, "considering");
  assert.equal(result.likelihood, "unlikely");
  assert.equal(result.guardrail, null);
});
