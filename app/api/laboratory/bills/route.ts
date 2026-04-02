import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { parseISO, startOfDay, endOfDay, isValid } from "date-fns";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import "@/models/Patient";
import "@/models/User";
import "@/models/PaymentMethod";
import LabBill from "@/models/LabBill";
import OPVisit from "@/models/OPVisit";
import Prescription from "@/models/Prescription";
import "@/models/LabTest";
import { syncLabBillForVisitItems } from "@/lib/sync-lab-bill";
import { withRouteLog } from "@/lib/with-route-log";
import { resolvePaymentMethodId } from "@/lib/payment-method";
import { sendPushNotificationToLaboratory } from "@/lib/push";

const postBodySchema = z.object({
  visitId: z.string().min(1),
  items: z.array(
    z.object({
      labTestId: z.string().min(1),
      quantity: z.coerce.number().int().min(1),
      lineOffer: z.coerce.number().min(0).optional(),
    })
  ),
  billOffer: z.coerce.number().min(0).optional(),
  paymentMethodId: z.string().optional(),
  generatedByName: z.string().optional(),
});

export const GET = withRouteLog("laboratory.bills.GET", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["laboratory", "admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));
    const skip = (page - 1) * limit;

    const fromStr = req.nextUrl.searchParams.get("from");
    const toStr = req.nextUrl.searchParams.get("to");
    let filter: Record<string, unknown> = {};
    if (fromStr && toStr) {
      const from = startOfDay(parseISO(fromStr));
      const to = endOfDay(parseISO(toStr));
      if (!isValid(from) || !isValid(to)) {
        return NextResponse.json({ message: "Invalid from or to date" }, { status: 400 });
      }
      filter = { billedAt: { $gte: from, $lte: to } };
    }

    const [rows, total] = await Promise.all([
      LabBill.find(filter)
        .populate("patient", "name regNo age gender phone address")
        .populate({
          path: "visit",
          select: "visitDate receiptNo",
          populate: { path: "doctor", select: "name" },
        })
        .populate("items.labTest", "name price")
        .populate("billedBy", "name")
        .populate("paymentMethod", "name code")
        .sort({ billedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LabBill.countDocuments(filter),
    ]);

    return NextResponse.json({
      items: rows,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

export const POST = withRouteLog("laboratory.bills.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["frontdesk", "admin", "laboratory"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const { visitId, items, billOffer, paymentMethodId } = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(visitId)) {
      return NextResponse.json({ message: "Invalid visit id" }, { status: 400 });
    }

    const visit = (await OPVisit.findById(visitId).lean()) as { patient?: unknown } | null;
    if (!visit?.patient) {
      return NextResponse.json({ message: "Visit not found" }, { status: 404 });
    }
    const patientId = String(visit.patient);

    const userId = (session!.user as { id?: string }).id;
    const generatedByName = parsed.data.generatedByName?.trim() || session!.user.name?.trim() || "";

    let paymentMethodRef;
    const willHaveLines = items.length > 0;
    if (willHaveLines) {
      try {
        paymentMethodRef = await resolvePaymentMethodId(paymentMethodId, { required: true });
      } catch (err) {
        return NextResponse.json(
          { message: err instanceof Error ? err.message : "Invalid payment method" },
          { status: 400 }
        );
      }
    }

    const hadExistingBill = await LabBill.exists({ visit: visitId });

    await syncLabBillForVisitItems({
      patientId,
      visitId,
      items,
      sessionUserId: userId,
      generatedByName,
      billOffer,
      ...(paymentMethodRef ? { paymentMethod: paymentMethodRef } : {}),
    });

    const uniqLabIds = items.length === 0 ? [] : Array.from(new Set(items.map((i) => i.labTestId)));
    await Prescription.updateOne(
      { patient: patientId, visit: visitId },
      { $set: { labTests: uniqLabIds, updatedAt: new Date() } }
    );

    const labBill = await LabBill.findOne({ visit: visitId })
      .populate("patient", "name regNo age gender phone address")
      .populate({
        path: "visit",
        select: "visitDate receiptNo",
        populate: { path: "doctor", select: "name" },
      })
      .populate("billedBy", "name")
      .populate("paymentMethod", "name code")
      .populate("items.labTest", "name price")
      .lean();

    if (!hadExistingBill && labBill) {
      const labBillId = String(labBill._id);
      const patientName = (labBill.patient as { name?: string } | undefined)?.name ?? "Patient";
      const receiptNo =
        ((labBill.visit as { receiptNo?: string } | undefined)?.receiptNo ?? "").trim();
      await sendPushNotificationToLaboratory({
        title: "New Lab Bill Created",
        body: receiptNo ? `${patientName} · Receipt ${receiptNo}` : patientName,
        icon: "/hospital-logo.png",
        url: "/laboratory/dashboard",
        tag: `lab-bill-${labBillId}`,
        labBillId,
      });
    }

    return NextResponse.json(labBill);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
