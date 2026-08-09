const API_BASE = '/api';

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

export function useApi() {
  async function fetchRecentActivities() {
    const response = await fetch(`${API_BASE}/activities/recent`);
    return parseResponse(response);
  }

  async function analyzeTweets(tweets) {
    const response = await fetch(`${API_BASE}/tweets/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweets }),
    });
    return parseResponse(response);
  }

  return { fetchRecentActivities, analyzeTweets };
}
