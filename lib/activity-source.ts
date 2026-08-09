import { fetchFxTwitterActivities } from "./fxtwitter";
import { fetchNitterActivities } from "./nitter";
import { getRuntimeEnv } from "./runtime-env";
import type { SourceResult } from "./types";

const fetchers = {
  fxtwitter: fetchFxTwitterActivities,
  nitter: fetchNitterActivities,
};

export async function fetchRecentActivities(days = 7): Promise<SourceResult> {
  const configured = (getRuntimeEnv().ACTIVITY_SOURCES || "fxtwitter,nitter")
    .split(",")
    .map((source) => source.trim().toLowerCase())
    .filter(Boolean);
  const errors: string[] = [];

  for (const source of configured.length ? configured : ["fxtwitter", "nitter"]) {
    const fetchSource = fetchers[source as keyof typeof fetchers];
    if (!fetchSource) {
      errors.push(`${source}: unsupported source`);
      continue;
    }
    try {
      return source === "fxtwitter"
        ? await fetchFxTwitterActivities({ days })
        : await fetchNitterActivities();
    } catch (error) {
      errors.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`All activity sources failed (${errors.join(" | ")})`);
}
