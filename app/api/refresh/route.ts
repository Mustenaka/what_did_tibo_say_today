import { getRecentDashboard, refreshIfNeeded } from "../../../db/storage";
import { isAuthorizedRefresh } from "../../../lib/refresh-auth";
import { getOrCreateResetAnalysis } from "../../../lib/reset-analysis-service";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!isAuthorizedRefresh(request)) {
    return Response.json({ error: "Refresh authorization failed" }, { status: 401 });
  }
  try {
    await refreshIfNeeded(7, true);
    const dashboard = await getRecentDashboard(7);
    const analysis = await getOrCreateResetAnalysis(dashboard);
    return Response.json({
      fetchedAt: dashboard.fetchedAt,
      activityCount: dashboard.stats.total,
      analysisGeneratedAt: analysis.snapshot?.generatedAt || null,
      likelihood: analysis.likelihood,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: "Scheduled refresh failed",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 502 });
  }
}

export async function GET() {
  return Response.json({ error: "Use an authenticated POST request" }, { status: 405 });
}
