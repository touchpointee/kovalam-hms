import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { log } from "@/lib/logger";
import { withRouteLog } from "@/lib/with-route-log";

const clientLogSchema = z.object({
  message: z.string().min(1).max(1000),
  source: z.string().max(500).optional(),
  lineno: z.number().int().optional(),
  colno: z.number().int().optional(),
  stack: z.string().max(4000).optional(),
  href: z.string().max(1000).optional(),
});

const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 30;
const buckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimitKey(req: NextRequest, userId?: string): string {
  return userId ? `user:${userId}` : `ip:${getClientIp(req)}`;
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= LIMIT_PER_WINDOW) return false;
  bucket.count += 1;
  buckets.set(key, bucket);
  return true;
}

export const POST = withRouteLog("logs.client.POST", async (req: NextRequest) => {
  const { session, error } = await requireAuth();
  if (error) return error;

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const allowed = checkRateLimit(rateLimitKey(req, userId));
  if (!allowed) {
    return NextResponse.json({ message: "Too many log events" }, { status: 429 });
  }

  const body = await req.json();
  const parsed = clientLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Validation failed" }, { status: 400 });
  }

  await log.error({
    category: "client",
    message: parsed.data.message,
    route: "client.error",
    userId,
    userEmail: (session?.user as { email?: string } | undefined)?.email,
    userRole: (session?.user as { role?: string } | undefined)?.role,
    ip: getClientIp(req),
    meta: {
      source: parsed.data.source,
      lineno: parsed.data.lineno,
      colno: parsed.data.colno,
      stack: parsed.data.stack,
      href: parsed.data.href,
    },
  });

  return NextResponse.json({ ok: true });
});
