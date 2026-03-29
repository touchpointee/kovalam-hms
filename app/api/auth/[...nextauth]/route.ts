import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { withRouteLog } from "@/lib/with-route-log";

const handler = NextAuth(authOptions);

export const GET = withRouteLog("auth.nextauth.GET", async (req, context) =>
  handler(req, context)
);
export const POST = withRouteLog("auth.nextauth.POST", async (req, context) =>
  handler(req, context)
);
