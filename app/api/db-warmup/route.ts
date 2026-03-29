import { dbConnect } from "@/lib/mongoose";
import { NextResponse } from "next/server";
import { withRouteLog } from "@/lib/with-route-log";

export const GET = withRouteLog("system.dbWarmup.GET", async () => {
  try {
    await dbConnect();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
});
