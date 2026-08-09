import { fetchFxTwitterActivities } from './fxtwitter.js';
import { fetchRecentActivities as fetchNitterActivities } from './nitter.js';

const SOURCE_FETCHERS = {
  fxtwitter: fetchFxTwitterActivities,
  nitter: fetchNitterActivities,
};

function configuredSources() {
  const configured = (process.env.ACTIVITY_SOURCES || 'fxtwitter,nitter')
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter(Boolean);

  return configured.length ? configured : ['fxtwitter', 'nitter'];
}

export async function fetchRecentActivities(options = {}) {
  const errors = [];

  for (const source of configuredSources()) {
    const fetchSource = SOURCE_FETCHERS[source];
    if (!fetchSource) {
      errors.push(`${source}: unsupported source`);
      continue;
    }

    try {
      return await fetchSource(options);
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
    }
  }

  throw new Error(`All activity sources failed (${errors.join(' | ')})`);
}
