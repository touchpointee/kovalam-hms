import type { NextRequest } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import SystemLog, { type SystemLogCategory, type SystemLogLevel } from "@/models/SystemLog";

type SessionLike = {
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
} | null;

type LogInput = {
  level: SystemLogLevel;
  category: SystemLogCategory;
  message: string;
  route?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ip?: string;
  meta?: Record<string, unknown>;
};

function getIp(req: NextRequest): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }
  return { errorMessage: String(error) };
}

export async function writeLog(input: LogInput) {
  try {
    await dbConnect();
    await SystemLog.create(input);
  } catch (err) {
    console.error("Failed to persist log:", err);
  }
}

export const log = {
  info: (input: Omit<LogInput, "level">) => writeLog({ ...input, level: "info" }),
  warn: (input: Omit<LogInput, "level">) => writeLog({ ...input, level: "warn" }),
  error: (input: Omit<LogInput, "level">) => writeLog({ ...input, level: "error" }),
  debug: (input: Omit<LogInput, "level">) => writeLog({ ...input, level: "debug" }),
};

export async function logApiOutcome(params: {
  req: NextRequest;
  session?: SessionLike;
  route: string;
  statusCode: number;
  durationMs: number;
  error?: unknown;
}) {
  const { req, session, route, statusCode, durationMs, error } = params;
  const level: SystemLogLevel = error || statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
  const message = `${req.method} ${new URL(req.url).pathname} -> ${statusCode}`;

  await writeLog({
    level,
    category: "api",
    message,
    route,
    method: req.method,
    path: new URL(req.url).pathname,
    statusCode,
    durationMs,
    userId: session?.user?.id,
    userEmail: session?.user?.email,
    userRole: session?.user?.role,
    ip: getIp(req),
    meta: error ? normalizeError(error) : undefined,
  });
}
