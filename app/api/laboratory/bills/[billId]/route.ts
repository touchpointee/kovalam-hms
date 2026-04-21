import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import LabBill from "@/models/LabBill";
import Prescription from "@/models/Prescription";
import { syncLabBillForVisitItems } from "@/lib/sync-lab-bill";
import { withRouteLog } from "@/lib/with-route-log";

export const DELETE = withRouteLog("laboratory.bills.billId.DELETE", async (
  _req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["frontdesk", "admin", "laboratory"]);
    if (forbidden) return forbidden;

    const { billId } = await params;
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return NextResponse.json({ message: "Invalid bill id" }, { status: 400 });
    }

    const bill = await LabBill.findById(billId).select("_id patient visit").lean() as {
      _id: mongoose.Types.ObjectId;
      patient?: mongoose.Types.ObjectId;
      visit?: mongoose.Types.ObjectId | null;
    } | null;
    if (!bill) {
      return NextResponse.json({ message: "Lab bill not found" }, { status: 404 });
    }

    const patientId = bill.patient ? String(bill.patient) : "";
    const visitId = bill.visit ? String(bill.visit) : "";
    const sessionUserId = (session!.user as { id?: string }).id;

    if (visitId && patientId) {
      if (sessionUserId) {
        await syncLabBillForVisitItems({
          patientId,
          visitId,
          items: [],
          sessionUserId,
        });
      } else {
        await LabBill.deleteOne({ _id: bill._id });
      }

      await Prescription.updateOne(
        { patient: patientId, visit: visitId },
        { $set: { labTests: [], updatedAt: new Date() } }
      );
    } else {
      await LabBill.deleteOne({ _id: bill._id });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
