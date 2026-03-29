import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Patient from "@/models/Patient";
import OPVisit from "@/models/OPVisit";
import Prescription from "@/models/Prescription";
import ProcedureBill from "@/models/ProcedureBill";
import MedicineBill from "@/models/MedicineBill";
import "@/models/Medicine";
import "@/models/Procedure";
import "@/models/LabTest";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";

export const GET = withRouteLog("patients.id.GET", async (
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
    const patient = await Patient.findById(id).lean();
    if (!patient) return NextResponse.json({ message: "Patient not found" }, { status: 404 });

    const [visits, prescriptions, procedureBills, medicineBills] = await Promise.all([
      OPVisit.find({ patient: id }).sort({ visitDate: -1 }).lean(),
      Prescription.find({ patient: id })
        .populate("visit doctor")
        .populate("medicines.medicine")
        .populate("procedures")
        .populate("labTests")
        .sort({ createdAt: -1 })
        .lean(),
      ProcedureBill.find({ patient: id }).populate("visit billedBy").populate("items.procedure").sort({ billedAt: -1 }).lean(),
      MedicineBill.find({ patient: id }).populate("visit prescription billedBy").sort({ billedAt: -1 }).lean(),
    ]);

    return NextResponse.json({
      ...patient,
      visits,
      prescriptions,
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
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  regNo: z.string().min(1).optional(),
  age: z.number().min(0).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  phone: z.string().min(1).optional(),
  address: z.string().optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"]).optional(),
});

export const PUT = withRouteLog("patients.id.PUT", async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "doctor", "pharmacy", "frontdesk"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = updateSchema.safeParse({
      ...body,
      age: body.age !== undefined ? (typeof body.age === "string" ? parseInt(body.age, 10) : body.age) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const role = (session!.user as { role?: string }).role;
    const payload = { ...parsed.data };
    if (payload.regNo !== undefined && role !== "admin") {
      delete (payload as { regNo?: string }).regNo;
    }
    if (payload.regNo) {
      const dup = await Patient.findOne({ regNo: payload.regNo, _id: { $ne: id } }).lean();
      if (dup) {
        return NextResponse.json({ message: "Registration number already in use" }, { status: 400 });
      }
    }
    const patient = await Patient.findByIdAndUpdate(id, { $set: payload }, { new: true }).lean();
    if (!patient) return NextResponse.json({ message: "Patient not found" }, { status: 404 });
    return NextResponse.json(patient);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
