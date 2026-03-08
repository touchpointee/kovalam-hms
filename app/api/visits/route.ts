import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import OPVisit from "@/models/OPVisit";
import OPChargeSetting from "@/models/OPChargeSetting";
import { generateReceiptNo } from "@/lib/counters";
import { startOfDay, endOfDay, parseISO } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const patientId = searchParams.get("patientId");

    const filter: Record<string, unknown> = {};
    if (patientId) (filter as Record<string, unknown>).patient = patientId;
    if (dateParam === "today" || dateParam) {
      let start: Date;
      let end: Date;
      if (!dateParam || dateParam === "today") {
        const now = new Date();
        start = startOfDay(now);
        end = endOfDay(now);
      } else {
        const d = parseISO(dateParam);
        start = startOfDay(d);
        end = endOfDay(d);
      }
      (filter as Record<string, unknown>).visitDate = { $gte: start, $lte: end };
    }

    const visits = await OPVisit.find(filter)
      .populate("patient", "name regNo age gender phone")
      .populate("collectedBy", "name")
      .sort({ visitDate: -1 })
      .lean();

    return NextResponse.json(visits);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

const postSchema = z.object({
  patientId: z.string().min(1),
  paid: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const setting = await OPChargeSetting.findOne().sort({ updatedAt: -1 }).lean() as { amount?: number } | null;
    const opCharge = setting?.amount ?? 0;
    const receiptNo = await generateReceiptNo();
    const userId = (session!.user as { id?: string }).id;

    const visit = await OPVisit.create({
      patient: parsed.data.patientId,
      opCharge,
      paid: parsed.data.paid ?? false,
      receiptNo,
      collectedBy: userId,
    });
    const populated = await OPVisit.findById(visit._id)
      .populate("patient", "name regNo age gender phone")
      .populate("collectedBy", "name")
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
