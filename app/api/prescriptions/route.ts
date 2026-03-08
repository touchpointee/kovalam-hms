import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Prescription from "@/models/Prescription";

const medicineItemSchema = z.object({
  medicine: z.string().optional(),
  medicineName: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  instructions: z.string().optional(),
});

const postSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1),
  medicines: z.array(medicineItemSchema).optional(),
  procedures: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const visitId = searchParams.get("visitId");
    if (!patientId || !visitId) {
      return NextResponse.json({ message: "patientId and visitId required" }, { status: 400 });
    }
    const prescription = await Prescription.findOne({ patient: patientId, visit: visitId })
      .populate("patient", "name regNo age gender")
      .populate("visit", "visitDate receiptNo")
      .populate("doctor", "name")
      .populate("medicines.medicine")
      .populate("procedures")
      .lean();
    return NextResponse.json(prescription);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["doctor"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const userId = (session!.user as { id?: string }).id;
    const medicines = (parsed.data.medicines ?? []).map((m) => ({
      medicine: m.medicine || undefined,
      medicineName: m.medicineName,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      instructions: m.instructions,
    }));

    const prescription = await Prescription.findOneAndUpdate(
      { patient: parsed.data.patientId, visit: parsed.data.visitId },
      {
        $set: {
          patient: parsed.data.patientId,
          visit: parsed.data.visitId,
          doctor: userId,
          medicines,
          procedures: parsed.data.procedures ?? [],
          notes: parsed.data.notes ?? "",
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    )
      .populate("patient", "name regNo age gender")
      .populate("visit", "visitDate receiptNo")
      .populate("doctor", "name")
      .populate("medicines.medicine")
      .populate("procedures")
      .lean();

    return NextResponse.json(prescription);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
