import { NextResponse } from "next/server";

/**
 * Lightweight liveness check — no DB hit. Use from other PCs to verify the server responds.
 * For database status use GET /api/db-warmup instead.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" as const, ts: new Date().toISOString() });
}
