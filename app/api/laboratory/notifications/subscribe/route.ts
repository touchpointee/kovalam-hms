import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import PushSubscription from "@/models/PushSubscription";
import { withRouteLog } from "@/lib/with-route-log";

export const POST = withRouteLog("laboratory.notifications.subscribe.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["laboratory"]);
    if (forbidden) return forbidden;

    const { subscription } = await req.json();
    const endpoint = String(subscription?.endpoint ?? "");
    if (!endpoint) {
      return NextResponse.json({ message: "Subscription endpoint is required" }, { status: 400 });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        endpoint,
        subscription,
        role: "laboratory",
        user: (session!.user as { id?: string }).id,
        updatedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
