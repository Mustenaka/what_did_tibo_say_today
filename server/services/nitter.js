import RssParser from 'rss-parser';

const DEFAULT_NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacyredirect.com',
  'https://nitter.tiekoetter.com',
];

const parser = new RssParser({
  timeout: 10000,
  headers: {
    Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
    'User-Agent': 'TiboSignalDesk/1.0 (+RSS activity monitor)',
  },
});

function configuredInstances() {
  const configured = process.env.NITTER_INSTANCES
    ?.split(',')
    .map((instance) => instance.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return configured?.length ? configured : DEFAULT_NITTER_INSTANCES;
}

function cleanHandle(value = '') {
  return value.trim().replace(/^@/, '') || null;
}

function cleanText(value = '') {
  return value.replace(/^Pinned:\s*/i, '').trim();
}

function extractStatusId(item, fallback) {
  const guid = typeof item.guid === 'string' ? item.guid.trim() : String(item.guid || '');
  if (/^\d+$/.test(guid)) return guid;

  const statusMatch = `${item.link || ''} ${guid}`.match(/\/status\/(\d+)/);
  return statusMatch?.[1] || guid || fallback;
}

function normalizeTweetLink(link = '', id = '') {
  const statusMatch = link.match(/\/([^/]+)\/status\/(\d+)/);
  if (statusMatch) return `https://x.com/${statusMatch[1]}/status/${statusMatch[2]}`;
  if (/^\d+$/.test(id)) return `https://x.com/thsottiaux/status/${id}`;
  return link;
}

function isUsableTimelineFeed(feed) {
  if (/whitelist|rate limit|not found|error/i.test(feed.title || '')) return false;
  return (feed.items || []).some((item) => {
    const guid = String(item.guid || '');
    return /^\d+$/.test(guid) || /\/status\/\d+/.test(`${item.link || ''} ${guid}`);
  });
}

function extractQuoteTarget(html = '') {
  if (!/<blockquote[\s>]/i.test(html)) return null;
  const match = html.match(/\(@([A-Za-z0-9_]+)\)/);
  return cleanHandle(match?.[1]);
}

export function parseActivityItem(item, source, index = 0) {
  const rawTitle = cleanText(item.title || '');
  const publishedAt = new Date(item.isoDate || item.pubDate || '');
  if (Number.isNaN(publishedAt.getTime())) return null;

  let type = 'original';
  let text = rawTitle;
  let targetHandle = null;
  const authorHandle = cleanHandle(item.creator || item['dc:creator'] || 'thsottiaux');

  const repostMatch = rawTitle.match(/^RT by @([^:]+):\s*/i);
  const replyMatch = rawTitle.match(/^R to @([^:]+):\s*/i);

  if (repostMatch) {
    type = 'repost';
    targetHandle = authorHandle;
    text = rawTitle.slice(repostMatch[0].length).trim();
  } else if (replyMatch) {
    type = 'reply';
    targetHandle = cleanHandle(replyMatch[1]);
    text = rawTitle.slice(replyMatch[0].length).trim();
  } else {
    const quoteTarget = extractQuoteTarget(item.content || item.description || '');
    if (quoteTarget) {
      type = 'quote';
      targetHandle = quoteTarget;
    }
  }

  const id = extractStatusId(item, `${publishedAt.toISOString()}-${index}`);

  return {
    id,
    text,
    publishedAt: publishedAt.toISOString(),
    day: publishedAt.toISOString().slice(0, 10),
    link: normalizeTweetLink(item.link || '', id),
    type,
    targetHandle,
    authorHandle,
    source,
    rawTitle,
  };
}

export async function fetchRecentActivities() {
  let lastError = null;

  for (const instance of configuredInstances()) {
    try {
      // The standard profile feed omits replies. The with_replies feed lets us
      // count Tibo's public interactions as well as standalone posts.
      const url = `${instance}/thsottiaux/with_replies/rss`;
      const feed = await parser.parseURL(url);
      if (!isUsableTimelineFeed(feed)) {
        throw new Error(`${instance} returned an unusable timeline feed`);
      }
      const activities = (feed.items || [])
        .map((item, index) => parseActivityItem(item, instance, index))
        .filter(Boolean);

      return {
        activities,
        source: instance,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('All configured Nitter instances failed');
}
