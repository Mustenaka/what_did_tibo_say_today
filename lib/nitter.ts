import type { Activity, SourceResult } from "./types";
import { getRuntimeEnv } from "./runtime-env";

const DEFAULT_INSTANCES = [
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://nitter.privacyredirect.com",
];

function decodeXml(value = "") {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(item: string, name: string) {
  return decodeXml(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
}

function configuredInstances() {
  const value = getRuntimeEnv().NITTER_INSTANCES;
  const configured = value?.split(",").map((item) => item.trim().replace(/\/$/, "")).filter(Boolean);
  return configured?.length ? configured : DEFAULT_INSTANCES;
}

function parseItem(item: string, source: string, index: number): Activity | null {
  const rawTitle = tag(item, "title").replace(/^Pinned:\s*/i, "").trim();
  const link = tag(item, "link");
  const guid = tag(item, "guid");
  const publishedAt = new Date(tag(item, "pubDate"));
  if (Number.isNaN(publishedAt.getTime())) return null;

  const id = `${link} ${guid}`.match(/\/status\/(\d+)/)?.[1]
    || (/^\d+$/.test(guid) ? guid : `${publishedAt.toISOString()}-${index}`);
  let type: Activity["type"] = "original";
  let text = rawTitle;
  let targetHandle: string | null = null;

  const repost = rawTitle.match(/^RT by @([^:]+):\s*/i);
  const reply = rawTitle.match(/^R to @([^:]+):\s*/i);
  if (repost) {
    type = "repost";
    targetHandle = repost[1].replace(/^@/, "");
    text = rawTitle.slice(repost[0].length).trim();
  } else if (reply) {
    type = "reply";
    targetHandle = reply[1].replace(/^@/, "");
    text = rawTitle.slice(reply[0].length).trim();
  } else if (/<blockquote[\s>]/i.test(item)) {
    type = "quote";
    targetHandle = item.match(/\(@([A-Za-z0-9_]+)\)/)?.[1] || null;
  }

  const statusMatch = link.match(/\/([^/]+)\/status\/(\d+)/);
  return {
    id,
    text,
    publishedAt: publishedAt.toISOString(),
    day: publishedAt.toISOString().slice(0, 10),
    link: statusMatch ? `https://x.com/${statusMatch[1]}/status/${statusMatch[2]}` : link,
    type,
    targetHandle,
    authorHandle: "thsottiaux",
    source,
    rawTitle,
  };
}

export async function fetchNitterActivities(): Promise<SourceResult> {
  let lastError: unknown;
  for (const instance of configuredInstances()) {
    try {
      const response = await fetch(`${instance}/thsottiaux/with_replies/rss`, {
        headers: {
          Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
          "User-Agent": "TiboSignalDesk/2.0 (+RSS activity monitor)",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`${instance} returned ${response.status}`);
      const xml = await response.text();
      if (/whitelist|rate limit|not found|challenge/i.test(xml.slice(0, 1000))) {
        throw new Error(`${instance} returned an unusable feed`);
      }
      const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)]
        .map((match, index) => parseItem(match[0], instance, index))
        .filter((item): item is Activity => Boolean(item));
      if (!items.some((item) => /^\d+$/.test(item.id))) {
        throw new Error(`${instance} returned no status items`);
      }
      return {
        activities: items,
        source: instance,
        provider: "nitter",
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All configured Nitter instances failed");
}
