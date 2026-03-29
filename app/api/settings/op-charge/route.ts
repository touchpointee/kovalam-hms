import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import OPChargeSetting from "@/models/OPChargeSetting";
import { withRouteLog } from "@/lib/with-route-log";

export const GET = withRouteLog("settings.opCharge.GET", async () => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const latest = await OPChargeSetting.findOne().sort({ updatedAt: -1 }).lean();
    return NextResponse.json(latest ?? { amount: 0 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

const postSchema = z.object({ amount: z.number().min(0) });

export const POST = withRouteLog("settings.opCharge.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({ ...body, amount: Number(body.amount) });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const userId = (session!.user as { id?: string }).id;
    const doc = await OPChargeSetting.create({
      amount: parsed.data.amount,
      updatedBy: userId,
    });
    const populated = await OPChargeSetting.findById(doc._id)
      .populate("updatedBy", "name")
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
