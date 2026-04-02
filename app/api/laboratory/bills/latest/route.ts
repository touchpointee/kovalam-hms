import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import "@/models/Patient";
import "@/models/User";
import "@/models/OPVisit";
import LabBill from "@/models/LabBill";
import { withRouteLog } from "@/lib/with-route-log";

export const dynamic = "force-dynamic";

export const GET = withRouteLog("laboratory.bills.latest.GET", async () => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["laboratory", "admin"]);
    if (forbidden) return forbidden;

    const latest = await LabBill.findOne({})
      .select("_id billedAt")
      .populate("patient", "name")
      .populate("visit", "receiptNo")
      .sort({ billedAt: -1 })
      .lean();

    if (!latest) {
      return NextResponse.json({
        latestLabBillId: null,
        createdAt: null,
        patientName: null,
        receiptNo: null,
      });
    }

    return NextResponse.json({
      latestLabBillId: String(latest._id),
      createdAt: latest.billedAt ?? null,
      patientName: (latest.patient as { name?: string } | undefined)?.name ?? null,
      receiptNo: (latest.visit as { receiptNo?: string } | undefined)?.receiptNo ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
