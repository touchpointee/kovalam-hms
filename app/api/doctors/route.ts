import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import User from "@/models/User";
import { withRouteLog } from "@/lib/with-route-log";

export const GET = withRouteLog("doctors.GET", async () => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "frontdesk", "pharmacy", "laboratory", "doctor"]);
    if (forbidden) return forbidden;

    const doctors = await User.find({ role: "doctor", isActive: { $ne: false } })
      .select("name email")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json(doctors);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
