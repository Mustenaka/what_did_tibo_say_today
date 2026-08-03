import { Router } from 'express';
import { fetchTodayTweets } from '../services/nitter.js';
import { analyzeResetLikelihood } from '../services/deepseek.js';

const router = Router();

router.get('/tweets/today', async (req, res) => {
  try {
    const data = await fetchTodayTweets();
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch tweets:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tweets/analyze', async (req, res) => {
  try {
    const { tweets } = req.body;
    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
      return res.status(400).json({ error: 'No tweets provided' });
    }
    const analysis = await analyzeResetLikelihood(tweets);
    res.json(analysis);
  } catch (err) {
    console.error('Failed to analyze tweets:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
