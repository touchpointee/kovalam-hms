import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import SystemLog from "@/models/SystemLog";
import { withRouteLog } from "@/lib/with-route-log";

function toDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? fallback : dt;
}

export const GET = withRouteLog("admin.logs.GET", async (req: NextRequest) => {
  await dbConnect();
  const { session, error } = await requireAuth();
  if (error) return error;
  const forbidden = requireRole(session, ["admin"]);
  if (forbidden) return forbidden;

  const searchParams = req.nextUrl.searchParams;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  const level = searchParams.get("level");
  const category = searchParams.get("category");
  const q = (searchParams.get("q") ?? "").trim();
  const from = toDate(searchParams.get("from"), new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const to = toDate(searchParams.get("to"), new Date());

  const filter: Record<string, unknown> = {
    createdAt: { $gte: from, $lte: to },
  };
  if (level && level !== "all") filter.level = level;
  if (category && category !== "all") filter.category = category;
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ message: re }, { path: re }, { route: re }, { userEmail: re }];
  }

  const [logs, total] = await Promise.all([
    SystemLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SystemLog.countDocuments(filter),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});
