import { Router } from 'express';
import { analyzeResetLikelihood } from '../services/deepseek.js';
import { fetchRecentActivities } from '../services/activity-source.js';
import { getActivityStore } from '../services/storage.js';

const router = Router();

async function recentActivities(req, res) {
  const days = 7;
  const store = getActivityStore();
  let refreshError = null;

  try {
    const fetched = await fetchRecentActivities({ days });
    store.saveFetch(fetched);
  } catch (error) {
    refreshError = error;
    store.saveFetchFailure(error);
    console.error('Failed to refresh activities:', error.message);
  }

  const data = store.getRecent(days);
  if (refreshError && data.activities.length === 0) {
    return res.status(503).json({
      error: 'No stored activity is available and all RSS sources failed',
      detail: refreshError.message,
    });
  }

  return res.json(data);
}

router.get('/activities/recent', recentActivities);

// Compatibility alias for older clients. The response now uses the 7-day model.
router.get('/tweets/today', recentActivities);

router.post('/tweets/analyze', async (req, res) => {
  try {
    const { tweets } = req.body;
    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
      return res.status(400).json({ error: 'No tweets provided' });
    }
    const analysis = await analyzeResetLikelihood(tweets.slice(0, 100));
    return res.json(analysis);
  } catch (err) {
    console.error('Failed to analyze tweets:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
