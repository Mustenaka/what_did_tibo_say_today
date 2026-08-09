import { getRuntimeEnv } from "../../../lib/runtime-env";
import { applyResetAwareGuard, filterPostResetActivities, hasExplicitPostResetSignal } from "../../../lib/reset-analysis";
import type { Activity, ResetAnalysisContext, ResetAnalysisResult, ResetLikelihood } from "../../../lib/types";

export const runtime = "edge";

const SYSTEM_PROMPT = `You evaluate whether Tibo may trigger another discretionary Codex or ChatGPT Work usage-limit reset.

Non-negotiable reasoning rules:
1. The most recent confirmed global reset closes the previous evidence window. Never treat that completed reset as evidence for another reset.
2. Only posts and interactions strictly AFTER analysisWindowStart are supplied. Base all semantic claims on those items.
3. Codex has a shared five-hour usage window and additional weekly limits may apply. This public site cannot read an account's actual resetsAt value, so weeklyProgressPercent is only a seven-day proxy anchored to the latest public global reset.
4. Higher weeklyProgressPercent raises the baseline gradually; it is context, not proof.
5. A reset less than 24 hours ago normally lowers the baseline. However, rapid repeats have happened: if a new explicit reset promise, product conflict, outage, celebration, or operational event appears after the reset, a second reset can still be likely.
6. Replies and quotes matter. A confrontation or intervention involving another coding-product leader can be a trigger when the text connects it to reset behavior.
7. rapidRepeatCount30d and shortestIntervalHours describe historical precedent. Use them to decide whether a fast repeat is plausible, never as standalone proof.

Focus on concepts such as reset, another reset, "there will be signs", celebrate, ship, outages, reliability, competition, conflict, and pressing the button.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{"likelihood":"very_likely|likely|unlikely|none","reason":"...","keywords":["..."],"summary":"..."}`;

const likelihoods = new Set<ResetLikelihood>(["very_likely", "likely", "unlikely", "none"]);

function validContext(value: unknown): value is ResetAnalysisContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<ResetAnalysisContext>;
  return context.cadenceSource === "public_reset_weekly_proxy"
    && typeof context.postResetActivityCount === "number"
    && typeof context.weeklyWindowHours === "number";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tweets?: Activity[]; context?: ResetAnalysisContext };
    if (!validContext(body.context)) {
      return Response.json({ error: "Reset analysis context is required" }, { status: 400 });
    }

    const supplied = Array.isArray(body.tweets)
      ? body.tweets.filter((item) => item?.type !== "repost" && typeof item?.text === "string").slice(0, 100)
      : [];
    const tweets = filterPostResetActivities(supplied, body.context.analysisWindowStart);
    const context: ResetAnalysisContext = {
      ...body.context,
      postResetActivityCount: tweets.length,
      explicitPostResetSignal: hasExplicitPostResetSignal(tweets),
    };
    if (!tweets.length) {
      return Response.json(applyResetAwareGuard({ likelihood: "none" }, context), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const runtime = getRuntimeEnv();
    if (!runtime.DEEPSEEK_API_KEY) {
      return Response.json({ error: "DeepSeek analysis is not configured" }, { status: 503 });
    }

    const tweetTexts = tweets
      .map((tweet, index) => `[${index + 1}] ${tweet.publishedAt} (${tweet.type || "post"}${tweet.targetHandle ? ` → @${tweet.targetHandle}` : ""}) ${tweet.text}`)
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
          {
            role: "user",
            content: `Reset-aware context:\n${JSON.stringify(context, null, 2)}\n\nPost-reset Tibo activity only:\n\n${tweetTexts}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 700,
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
    const parsed = JSON.parse(jsonMatch?.[0] || content) as Partial<ResetAnalysisResult>;
    const draft = {
      likelihood: likelihoods.has(parsed.likelihood as ResetLikelihood) ? parsed.likelihood as ResetLikelihood : "unknown" as const,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
    };
    return Response.json(applyResetAwareGuard(draft, context), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: "Analysis unavailable",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 502 });
  }
}
