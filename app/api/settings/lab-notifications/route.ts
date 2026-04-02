import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import LabNotificationSetting from "@/models/LabNotificationSetting";
import { withRouteLog } from "@/lib/with-route-log";

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  soundUrl: "",
};

export const GET = withRouteLog("settings.labNotifications.GET", async () => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const latest = await LabNotificationSetting.findOne()
      .sort({ updatedAt: -1 })
      .populate("updatedBy", "name")
      .lean();

    return NextResponse.json(latest ?? DEFAULT_SETTINGS);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

const postSchema = z.object({
  soundEnabled: z.boolean(),
  soundUrl: z.string().optional(),
});

export const POST = withRouteLog("settings.labNotifications.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      soundEnabled: Boolean(body.soundEnabled),
      soundUrl: String(body.soundUrl ?? ""),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const userId = (session!.user as { id?: string }).id;
    const doc = await LabNotificationSetting.create({
      soundEnabled: parsed.data.soundEnabled,
      soundUrl: (parsed.data.soundUrl ?? "").trim(),
      updatedBy: userId,
    });

    const populated = await LabNotificationSetting.findById(doc._id)
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
