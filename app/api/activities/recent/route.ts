import { getRecentDashboard, refreshIfNeeded } from "../../../../db/storage";
import { isAuthorizedRefresh } from "../../../../lib/refresh-auth";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = Math.min(30, Math.max(1, Number.parseInt(url.searchParams.get("days") || "7", 10) || 7));
  const forceRequested = url.searchParams.get("refresh") === "1";
  if (forceRequested && !isAuthorizedRefresh(request)) {
    return Response.json({ error: "Forced refresh is not available to visitors" }, { status: 403 });
  }
  const force = forceRequested;
  let refreshError: unknown = null;

  try {
    await refreshIfNeeded(days, force);
  } catch (error) {
    refreshError = error;
  }

  try {
    const dashboard = await getRecentDashboard(days);
    if (!dashboard.stats.total && refreshError) {
      throw refreshError;
    }
    return Response.json({
      ...dashboard,
      stale: Boolean(refreshError),
      refreshError: refreshError instanceof Error ? refreshError.message : dashboard.refreshError,
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return Response.json({
      error: "Unable to load Tibo activity",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 503 });
  }
}
