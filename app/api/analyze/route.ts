import { getRecentDashboard } from "../../../db/storage";
import { getOrCreateResetAnalysis } from "../../../lib/reset-analysis-service";

export const runtime = "edge";

export async function GET() {
  try {
    const dashboard = await getRecentDashboard(7);
    const result = await getOrCreateResetAnalysis(dashboard);
    return Response.json(result, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (error) {
    return Response.json({
      error: "Analysis unavailable",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 502 });
  }
}

export async function POST() {
  return Response.json({ error: "Client-supplied analysis input is not accepted" }, { status: 405 });
}
