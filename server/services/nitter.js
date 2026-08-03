import RssParser from 'rss-parser';

const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
];

const parser = new RssParser({
  timeout: 10000,
});

function getTodayDateStr() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export async function fetchTodayTweets() {
  let lastError = null;

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/thsottiaux/rss`;
      const feed = await parser.parseURL(url);
      const todayStr = getTodayDateStr();
      const todayTweets = (feed.items || [])
        .filter((item) => {
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date(item.isoDate || '');
          return pubDate.toISOString().slice(0, 10) === todayStr;
        })
        .map((item, i) => ({
          id: item.guid || `${todayStr}-${i}`,
          text: (item.contentSnippet || item.content || item.title || '').trim(),
          time: item.pubDate || item.isoDate || '',
          link: item.link || '',
        }));

      return {
        date: todayStr,
        count: todayTweets.length,
        tweets: todayTweets,
        source: instance,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Nitter instances failed');
}
