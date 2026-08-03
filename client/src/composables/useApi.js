const API_BASE = '/api';

export function useApi() {
  async function fetchTodayTweets() {
    const res = await fetch(`${API_BASE}/tweets/today`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function analyzeTweets(tweets) {
    const res = await fetch(`${API_BASE}/tweets/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweets }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  return { fetchTodayTweets, analyzeTweets };
}
