import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { logApiOutcome } from "@/lib/logger";

type RouteHandler = (
  req: NextRequest,
  context: any
) => Promise<Response> | Response;

export function withRouteLog(routeId: string, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context: any) => {
    const startedAt = Date.now();
    const session = await getServerSession(authOptions);
    try {
      const response = await handler(req, context);
      await logApiOutcome({
        req,
        route: routeId,
        session: session as { user?: { id?: string; email?: string; role?: string } } | null,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      await logApiOutcome({
        req,
        route: routeId,
        session: session as { user?: { id?: string; email?: string; role?: string } } | null,
        statusCode: 500,
        durationMs: Date.now() - startedAt,
        error,
      });
      return NextResponse.json(
        { message: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
