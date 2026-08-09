const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

const SYSTEM_PROMPT = `You are an analysis tool that evaluates public posts and interactions from Tibo, the OpenAI Chief Reset Officer.

Focus on keywords and concepts: reset, "there will be signs", celebrate, ship, again.

Based on the tweets, determine the likelihood that a codex/GPT work reset is imminent.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{"likelihood":"very_likely|likely|unlikely|none","reason":"...","keywords":["..."],"summary":"..."}`;

export async function analyzeResetLikelihood(tweets) {
  const tweetTexts = tweets
    .map((tweet, index) => `[${index + 1}] (${tweet.type || 'post'}) ${tweet.text}`)
    .join('\n\n');

  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Analyze these posts and interactions from Tibo over the past 7 days for any signs of an upcoming reset:\n\n${tweetTexts}` },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch {
    return {
      likelihood: 'unknown',
      reason: 'Failed to parse AI response',
      keywords: [],
      summary: content,
    };
  }
}
