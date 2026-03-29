import { NextResponse } from "next/server";
import { withRouteLog } from "@/lib/with-route-log";

/**
 * Lightweight liveness check — no DB hit. Use from other PCs to verify the server responds.
 * For database status use GET /api/db-warmup instead.
 */
export const GET = withRouteLog("system.health.GET", async () => {
  return NextResponse.json({ status: "ok" as const, ts: new Date().toISOString() });
});
