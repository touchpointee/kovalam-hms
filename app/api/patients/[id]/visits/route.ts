import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { generateReceiptNo } from "@/lib/counters";
import OPVisit from "@/models/OPVisit";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";

const createVisitSchema = z.object({
  visitDate: z.union([z.string(), z.coerce.date()]),
  status: z.enum(["waiting", "served"]).default("served"),
  /** Consultation / OP fee for this visit (frontdesk visit data modal). */
  opCharge: z.number().min(0).optional(),
});

export const POST = withRouteLog("patients.id.visits.POST", async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid patient ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = createVisitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const visitDate =
      parsed.data.visitDate instanceof Date
        ? parsed.data.visitDate
        : new Date(parsed.data.visitDate as string);
    if (Number.isNaN(visitDate.getTime())) {
      return NextResponse.json({ message: "Invalid visit date" }, { status: 400 });
    }
    if (visitDate.getTime() > Date.now()) {
      return NextResponse.json({ message: "Visit date cannot be in the future" }, { status: 400 });
    }

    const receiptNo = await generateReceiptNo();
    const userId = (session!.user as { id?: string }).id;

    const opCharge =
      parsed.data.opCharge !== undefined && Number.isFinite(parsed.data.opCharge)
        ? parsed.data.opCharge
        : 0;

    const created = await OPVisit.create({
      patient: id,
      visitDate,
      status: parsed.data.status,
      paid: true,
      receiptNo,
      opCharge,
      collectedBy: userId,
    });

    const visit = await OPVisit.findById(created._id)
      .populate("patient", "name regNo age gender phone")
      .populate("collectedBy", "name")
      .lean();

    return NextResponse.json(visit);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
