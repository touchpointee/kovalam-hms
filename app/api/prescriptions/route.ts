import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Prescription from "@/models/Prescription";
import OPVisit from "@/models/OPVisit";
import "@/models/Medicine";
import "@/models/Procedure";
import { syncLabBillForVisitItems } from "@/lib/sync-lab-bill";
import { withRouteLog } from "@/lib/with-route-log";

const medicineItemSchema = z.object({
  medicine: z.string().optional(),
  medicineName: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  instructions: z.string().optional(),
  lineFee: z.number().min(0).optional(),
});

const postSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1),
  medicines: z.array(medicineItemSchema).optional(),
  procedures: z.array(z.string()).optional(),
  labTests: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const GET = withRouteLog("prescriptions.GET", async (req: NextRequest) => {
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
      .populate("labTests")
      .lean();
    return NextResponse.json(prescription);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

export const POST = withRouteLog("prescriptions.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["doctor", "frontdesk", "admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const userId = (session!.user as { id?: string }).id;
    const userRole = (session!.user as { role?: string }).role;
    const prescribedByRole = userRole === "frontdesk" ? "frontdesk" : "doctor";
    const medicines = (parsed.data.medicines ?? []).map((m) => ({
      medicine: m.medicine || undefined,
      medicineName: m.medicineName,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      instructions: m.instructions,
      ...(m.lineFee !== undefined && Number.isFinite(m.lineFee) ? { lineFee: m.lineFee } : {}),
    }));

    const visit = await OPVisit.findById(parsed.data.visitId).lean() as { patient?: string; status?: string } | null;
    if (!visit) {
      return NextResponse.json({ message: "Visit not found" }, { status: 404 });
    }
    if (String(visit.patient) !== parsed.data.patientId) {
      return NextResponse.json({ message: "Visit does not belong to patient" }, { status: 400 });
    }
    if (visit.status === "served" && userRole !== "frontdesk" && userRole !== "admin") {
      return NextResponse.json({ message: "Visit already served. Prescription is locked." }, { status: 409 });
    }

    const prescription = await Prescription.findOneAndUpdate(
      { patient: parsed.data.patientId, visit: parsed.data.visitId },
      {
        $set: {
          patient: parsed.data.patientId,
          visit: parsed.data.visitId,
          doctor: userId,
          prescribedByRole,
          medicines,
          procedures: parsed.data.procedures ?? [],
          labTests: parsed.data.labTests ?? [],
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
      .populate("labTests")
      .lean();

    const uniqueLabIds = Array.from(new Set((parsed.data.labTests ?? []).filter(Boolean)));
    await syncLabBillForVisitItems({
      patientId: parsed.data.patientId,
      visitId: parsed.data.visitId,
      items: uniqueLabIds.map((id) => ({ labTestId: id, quantity: 1 })),
      sessionUserId: userId,
    });

    return NextResponse.json(prescription);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
