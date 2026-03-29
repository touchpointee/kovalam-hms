import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAuth, requireRole } from "@/lib/api-auth";
import OPVisit from "@/models/OPVisit";
import ProcedureBill from "@/models/ProcedureBill";
import MedicineBill from "@/models/MedicineBill";
import LabBill from "@/models/LabBill";
import Prescription from "@/models/Prescription";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";
import { resolvePaymentMethodId } from "@/lib/payment-method";
import { resolveVisitDoctorId } from "@/lib/visit-doctor";

const adminVisitPatchSchema = z.object({
  visitDate: z.union([z.string(), z.coerce.date()]).optional(),
  status: z.enum(["waiting", "served"]).optional(),
  opCharge: z.number().min(0).optional(),
  paid: z.boolean().optional(),
  receiptNo: z.string().min(1).optional(),
  /** Set to null to clear consulting doctor. */
  doctorId: z.union([z.string(), z.null()]).optional(),
  /** Set to null to clear payment method on the visit. */
  paymentMethodId: z.union([z.string().min(1), z.null()]).optional(),
});

export const GET = withRouteLog("visits.id.GET", async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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
      .populate("doctor", "name")
      .populate("paymentMethod", "name code")
      .lean();
    if (!visit) return NextResponse.json({ message: "Visit not found" }, { status: 404 });

    const [procedureBills, medicineBills, labBill] = await Promise.all([
      ProcedureBill.find({ visit: id }).populate("billedBy", "name").populate("items.procedure").lean(),
      MedicineBill.find({ visit: id }).populate("prescription billedBy", "name").lean(),
      LabBill.findOne({ visit: id })
        .populate("patient", "name regNo age gender phone address")
        .populate({
          path: "visit",
          select: "visitDate receiptNo",
          populate: { path: "doctor", select: "name" },
        })
        .populate("billedBy", "name")
        .populate("paymentMethod", "name code")
        .populate("items.labTest", "name price")
        .lean(),
    ]);

    return NextResponse.json({
      ...visit,
      procedureBills,
      medicineBills,
      labBill,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

export const PATCH = withRouteLog("visits.id.PATCH", async (
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
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = adminVisitPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
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
    if (parsed.data.doctorId !== undefined) {
      if (parsed.data.doctorId === null) {
        unset.doctor = 1;
      } else {
        try {
          const docId = await resolveVisitDoctorId(parsed.data.doctorId);
          if (docId) update.doctor = docId;
        } catch (err) {
          return NextResponse.json(
            { message: err instanceof Error ? err.message : "Invalid doctor" },
            { status: 400 }
          );
        }
      }
    }
    if (parsed.data.paymentMethodId !== undefined) {
      if (parsed.data.paymentMethodId === null) {
        unset.paymentMethod = 1;
      } else {
        try {
          const pm = await resolvePaymentMethodId(parsed.data.paymentMethodId, { required: true });
          update.paymentMethod = pm;
        } catch (err) {
          return NextResponse.json(
            { message: err instanceof Error ? err.message : "Invalid payment method" },
            { status: 400 }
          );
        }
      }
    }

    if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) {
      return NextResponse.json({ message: "No fields to update" }, { status: 400 });
    }

    const mongoUpdate: { $set?: Record<string, unknown>; $unset?: Record<string, 1> } = {};
    if (Object.keys(update).length > 0) mongoUpdate.$set = update;
    if (Object.keys(unset).length > 0) mongoUpdate.$unset = unset;

    const updated = await OPVisit.findByIdAndUpdate(id, mongoUpdate, { new: true })
      .populate("patient", "name regNo age gender phone address")
      .populate("collectedBy", "name")
      .populate("doctor", "name")
      .populate("paymentMethod", "name code")
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
});

export const DELETE = withRouteLog("visits.id.DELETE", async (
  _req: NextRequest,
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
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const visit = await OPVisit.findById(id).lean();
    if (!visit) {
      return NextResponse.json({ message: "Visit not found" }, { status: 404 });
    }

    await Promise.all([
      Prescription.deleteMany({ visit: id }),
      ProcedureBill.deleteMany({ visit: id }),
      MedicineBill.deleteMany({ visit: id }),
      LabBill.deleteMany({ visit: id }),
    ]);
    await OPVisit.findByIdAndDelete(id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
