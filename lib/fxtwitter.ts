import type { Activity, SourceResult } from "./types";
import { getRuntimeEnv } from "./runtime-env";

const DEFAULT_BASE_URL = "https://api.fxtwitter.com";
const DEFAULT_HANDLE = "thsottiaux";
const DEFAULT_MAX_PAGES = 8;

function normalizeHandle(value = "") {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function startOfUtcWindow(days: number, now = new Date()) {
  const safeDays = Math.min(30, Math.max(1, Number.parseInt(String(days), 10) || 7));
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - (safeDays - 1),
  ));
}

function statusDate(status: Record<string, unknown>) {
  const timestamp = status.created_timestamp;
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp * 1000);
  }
  return new Date(String(status.created_at || ""));
}

function ownReplyText(status: Record<string, unknown>) {
  const text = String(status.text || "").trim();
  return text.replace(/^(?:@[A-Za-z0-9_]+\s*)+/, "").trim() || text;
}

export function parseFxTwitterStatus(
  status: Record<string, any>,
  handle = DEFAULT_HANDLE,
  source = DEFAULT_BASE_URL,
): Activity | null {
  if (!status || status.type !== "status") return null;

  const expectedHandle = normalizeHandle(handle);
  const authorHandle = normalizeHandle(status.author?.screen_name || "");
  const reposterHandle = normalizeHandle(status.reposted_by?.screen_name || "");
  const isRepost = reposterHandle === expectedHandle;

  if (authorHandle !== expectedHandle && !isRepost) return null;

  const publishedAt = statusDate(status);
  if (Number.isNaN(publishedAt.getTime()) || !status.id) return null;

  let type: Activity["type"] = "original";
  let targetHandle: string | null = null;
  let text = String(status.text || "").trim();

  if (isRepost) {
    type = "repost";
    targetHandle = authorHandle || null;
  } else if (status.replying_to) {
    type = "reply";
    targetHandle = normalizeHandle(status.replying_to.screen_name || "") || null;
    text = ownReplyText(status);
  } else if (status.quote) {
    type = "quote";
    targetHandle = normalizeHandle(status.quote.author?.screen_name || "") || null;
  }

  return {
    id: String(status.id),
    text,
    publishedAt: publishedAt.toISOString(),
    day: publishedAt.toISOString().slice(0, 10),
    link: status.url || `https://x.com/${authorHandle || expectedHandle}/status/${status.id}`,
    type,
    targetHandle,
    authorHandle: authorHandle || expectedHandle,
    source,
    rawTitle: String(status.text || "").trim(),
  };
}

export async function fetchFxTwitterActivities({
  days = 7,
  now = new Date(),
  maxPages = DEFAULT_MAX_PAGES,
}: { days?: number; now?: Date; maxPages?: number } = {}): Promise<SourceResult> {
  const runtime = getRuntimeEnv();
  const baseUrl = (runtime.FXTWITTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const handle = normalizeHandle(runtime.X_HANDLE || DEFAULT_HANDLE);
  const cutoff = startOfUtcWindow(days, now);
  const activities = new Map<string, Activity>();
  let cursor = "";
  let pages = 0;

  while (pages < maxPages) {
    const url = new URL(`${baseUrl}/2/profile/${encodeURIComponent(handle)}/statuses`);
    url.searchParams.set("count", "100");
    url.searchParams.set("with_replies", "1");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TiboSignalDesk/2.0 (+public activity monitor)",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`FxTwitter API error ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
    }

    const payload = await response.json() as Record<string, any>;
    if (payload.code && payload.code !== 200) {
      throw new Error(`FxTwitter API returned code ${payload.code}`);
    }

    const statuses = (Array.isArray(payload.results) ? payload.results : [])
      .filter((item: Record<string, unknown>) => item?.type === "status");

    for (const status of statuses) {
      const activity = parseFxTwitterStatus(status, handle, baseUrl);
      if (activity && new Date(activity.publishedAt) >= cutoff) {
        activities.set(activity.id, activity);
      }
    }

    pages += 1;
    const pageTimes = statuses
      .map(statusDate)
      .filter((date: Date) => !Number.isNaN(date.getTime()))
      .map((date: Date) => date.getTime());
    const reachedCutoff = pageTimes.length > 0 && Math.min(...pageTimes) < cutoff.getTime();
    cursor = payload.cursor?.bottom || "";
    if (reachedCutoff || !cursor || statuses.length === 0) break;
  }

  if (activities.size === 0) {
    throw new Error("FxTwitter returned no Tibo activity in the requested window");
  }

  return {
    activities: [...activities.values()].sort(
      (left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime(),
    ),
    source: baseUrl,
    provider: "fxtwitter",
    pages,
    fetchedAt: new Date().toISOString(),
  };
}
