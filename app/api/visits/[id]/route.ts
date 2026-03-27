import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAuth, requireRole } from "@/lib/api-auth";
import OPVisit from "@/models/OPVisit";
import ProcedureBill from "@/models/ProcedureBill";
import MedicineBill from "@/models/MedicineBill";
import mongoose from "mongoose";

const adminVisitPatchSchema = z.object({
  visitDate: z.union([z.string(), z.coerce.date()]).optional(),
  status: z.enum(["waiting", "served"]).optional(),
  opCharge: z.number().min(0).optional(),
  paid: z.boolean().optional(),
  receiptNo: z.string().min(1).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const visit = await OPVisit.findById(id)
      .populate("patient")
      .populate("collectedBy", "name")
      .lean();
    if (!visit) return NextResponse.json({ message: "Visit not found" }, { status: 404 });

    const [procedureBills, medicineBills] = await Promise.all([
      ProcedureBill.find({ visit: id }).populate("billedBy", "name").populate("items.procedure").lean(),
      MedicineBill.find({ visit: id }).populate("prescription billedBy", "name").lean(),
    ]);

    return NextResponse.json({
      ...visit,
      procedureBills,
      medicineBills,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = adminVisitPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.visitDate !== undefined) {
      update.visitDate =
        parsed.data.visitDate instanceof Date
          ? parsed.data.visitDate
          : new Date(parsed.data.visitDate as string);
    }
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.opCharge !== undefined) update.opCharge = parsed.data.opCharge;
    if (parsed.data.paid !== undefined) update.paid = parsed.data.paid;
    if (parsed.data.receiptNo !== undefined) {
      const taken = await OPVisit.findOne({
        receiptNo: parsed.data.receiptNo,
        _id: { $ne: id },
      }).lean();
      if (taken) {
        return NextResponse.json({ message: "Receipt number already in use" }, { status: 400 });
      }
      update.receiptNo = parsed.data.receiptNo;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ message: "No fields to update" }, { status: 400 });
    }

    const updated = await OPVisit.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate("patient", "name regNo age gender phone")
      .populate("collectedBy", "name")
      .lean();

    if (!updated) {
      return NextResponse.json({ message: "Visit not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
