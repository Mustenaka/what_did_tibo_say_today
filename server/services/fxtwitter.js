const DEFAULT_BASE_URL = 'https://api.fxtwitter.com';
const DEFAULT_HANDLE = 'thsottiaux';
const DEFAULT_MAX_PAGES = 8;

function normalizeHandle(value = '') {
  return value.trim().replace(/^@/, '').toLowerCase();
}

function startOfUtcWindow(days, now = new Date()) {
  const safeDays = Math.min(30, Math.max(1, Number.parseInt(days, 10) || 7));
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - (safeDays - 1),
  ));
}

function statusDate(status) {
  if (Number.isFinite(status.created_timestamp)) {
    return new Date(status.created_timestamp * 1000);
  }
  return new Date(status.created_at || '');
}

function ownReplyText(status) {
  const text = String(status.text || '').trim();
  const withoutLeadingMentions = text.replace(/^(?:@[A-Za-z0-9_]+\s*)+/, '').trim();
  return withoutLeadingMentions || text;
}

export function parseFxTwitterStatus(status, handle = DEFAULT_HANDLE, source = DEFAULT_BASE_URL) {
  if (!status || status.type !== 'status') return null;

  const expectedHandle = normalizeHandle(handle);
  const authorHandle = normalizeHandle(status.author?.screen_name || '');
  const reposterHandle = normalizeHandle(status.reposted_by?.screen_name || '');
  const isRepost = reposterHandle === expectedHandle;

  if (authorHandle !== expectedHandle && !isRepost) return null;

  const publishedAt = statusDate(status);
  if (Number.isNaN(publishedAt.getTime()) || !status.id) return null;

  let type = 'original';
  let targetHandle = null;
  let text = String(status.text || '').trim();

  if (isRepost) {
    type = 'repost';
    targetHandle = authorHandle || null;
  } else if (status.replying_to) {
    type = 'reply';
    targetHandle = normalizeHandle(status.replying_to.screen_name || '') || null;
    text = ownReplyText(status);
  } else if (status.quote) {
    type = 'quote';
    targetHandle = normalizeHandle(status.quote.author?.screen_name || '') || null;
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
    rawTitle: String(status.text || '').trim(),
  };
}

export async function fetchFxTwitterActivities({
  days = 7,
  now = new Date(),
  fetchImpl = fetch,
  maxPages = DEFAULT_MAX_PAGES,
} = {}) {
  const baseUrl = (process.env.FXTWITTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const handle = normalizeHandle(process.env.X_HANDLE || DEFAULT_HANDLE);
  const cutoff = startOfUtcWindow(days, now);
  const activities = new Map();
  let cursor = '';
  let pages = 0;

  while (pages < maxPages) {
    const url = new URL(`${baseUrl}/2/profile/${encodeURIComponent(handle)}/statuses`);
    url.searchParams.set('count', '100');
    url.searchParams.set('with_replies', '1');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TiboSignalDesk/1.0 (+public activity monitor)',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`FxTwitter API error ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`);
    }

    const payload = await response.json();
    if (payload.code && payload.code !== 200) {
      throw new Error(`FxTwitter API returned code ${payload.code}`);
    }

    const statuses = (payload.results || []).filter((item) => item?.type === 'status');
    for (const status of statuses) {
      const activity = parseFxTwitterStatus(status, handle, baseUrl);
      if (activity && new Date(activity.publishedAt) >= cutoff) {
        activities.set(activity.id, activity);
      }
    }

    pages += 1;
    const pageTimes = statuses
      .map(statusDate)
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => date.getTime());
    const reachedCutoff = pageTimes.length > 0 && Math.min(...pageTimes) < cutoff.getTime();
    cursor = payload.cursor?.bottom || '';

    if (reachedCutoff || !cursor || statuses.length === 0) break;
  }

  if (activities.size === 0) {
    throw new Error('FxTwitter returned no Tibo activity in the requested window');
  }

  return {
    activities: [...activities.values()].sort(
      (left, right) => new Date(right.publishedAt) - new Date(left.publishedAt),
    ),
    source: baseUrl,
    provider: 'fxtwitter',
    pages,
    fetchedAt: new Date().toISOString(),
  };
}
