import { getRuntimeEnv } from "../../../lib/runtime-env";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are an analysis tool that evaluates public posts and interactions from Tibo, the OpenAI Chief Reset Officer.

Focus on keywords and concepts: reset, "there will be signs", celebrate, ship, again.

Based on the posts, determine the likelihood that a Codex or ChatGPT Work usage-limit reset is imminent.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{"likelihood":"very_likely|likely|unlikely|none","reason":"...","keywords":["..."],"summary":"..."}`;

export async function POST(request: Request) {
  const runtime = getRuntimeEnv();
  if (!runtime.DEEPSEEK_API_KEY) {
    return Response.json({ error: "DeepSeek analysis is not configured" }, { status: 503 });
  }

  try {
    const body = await request.json() as { tweets?: Array<{ type?: string; text?: string }> };
    const tweets = Array.isArray(body.tweets)
      ? body.tweets.filter((item) => item?.type !== "repost" && typeof item?.text === "string").slice(0, 100)
      : [];
    if (!tweets.length) {
      return Response.json({ error: "No analyzable activity supplied" }, { status: 400 });
    }

    const tweetTexts = tweets
      .map((tweet, index) => `[${index + 1}] (${tweet.type || "post"}) ${tweet.text}`)
      .join("\n\n");
    const baseUrl = (runtime.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runtime.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Analyze these posts and interactions from Tibo over the past 7 days for reset signals:\n\n${tweetTexts}` },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${detail.slice(0, 300)}`);
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const analysis = JSON.parse(jsonMatch?.[0] || content);
    return Response.json(analysis, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: "Analysis unavailable",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 502 });
  }
}
