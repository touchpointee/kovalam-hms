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
import LabTest from "@/models/LabTest";
import Patient from "@/models/Patient";
import { syncLabBillForVisitItems } from "@/lib/sync-lab-bill";
import { withRouteLog } from "@/lib/with-route-log";
import { resolvePaymentMethodId } from "@/lib/payment-method";
import { sendPushNotificationToLaboratory } from "@/lib/push";
import { clampBillOffer, clampLineOffer, grandTotalAfterBillOffer, lineNetAfterOffer } from "@/lib/bill-offers";

type LabBillResponse = {
  _id: unknown;
  patient?: unknown;
  visit?: unknown;
  items?: unknown[];
};

const postBodySchema = z.object({
  visitId: z.string().min(1).optional(),
  patientId: z.string().min(1).optional(),
  billId: z.string().min(1).optional(),
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
}).refine((data) => Boolean(data.visitId || data.patientId), {
  message: "visitId or patientId required",
});

async function ensureLabBillVisitIndex() {
  const indexes = await LabBill.collection.indexes();
  const visitIndex = indexes.find((index) => index.name === "visit_1");
  const hasCorrectPartialIndex =
    Boolean(visitIndex?.unique) &&
    JSON.stringify(visitIndex?.partialFilterExpression ?? {}) ===
      JSON.stringify({ visit: { $type: "objectId" } });

  if (visitIndex && !hasCorrectPartialIndex) {
    await LabBill.collection.dropIndex("visit_1");
  }

  if (!hasCorrectPartialIndex) {
    await LabBill.collection.createIndex(
      { visit: 1 },
      {
        name: "visit_1",
        unique: true,
        partialFilterExpression: { visit: { $type: "objectId" } },
      }
    );
  }

  await LabBill.updateMany(
    { $or: [{ visit: null }, { visit: { $exists: false } }] },
    { $unset: { visit: "" } }
  );
}

export const GET = withRouteLog("laboratory.bills.GET", async (req: NextRequest) => {
  try {
    await dbConnect();
    await ensureLabBillVisitIndex();
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
    const patientId = req.nextUrl.searchParams.get("patientId");
    const labOnly = req.nextUrl.searchParams.get("labOnly") === "true";
    if (patientId) {
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
      }
      filter.patient = patientId;
    }
    if (labOnly) {
      filter.$or = [{ visit: { $exists: false } }, { visit: null }];
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
    await ensureLabBillVisitIndex();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["frontdesk", "admin", "laboratory"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const { visitId, patientId: rawPatientId, billId, items, billOffer, paymentMethodId } = parsed.data;
    let patientId = "";
    let visitRef: string | null = null;
    if (visitId) {
      if (!mongoose.Types.ObjectId.isValid(visitId)) {
        return NextResponse.json({ message: "Invalid visit id" }, { status: 400 });
      }
      const visit = (await OPVisit.findById(visitId).lean()) as { patient?: unknown } | null;
      if (!visit?.patient) {
        return NextResponse.json({ message: "Visit not found" }, { status: 404 });
      }
      patientId = String(visit.patient);
      visitRef = visitId;
    } else if (rawPatientId) {
      if (!mongoose.Types.ObjectId.isValid(rawPatientId)) {
        return NextResponse.json({ message: "Invalid patient id" }, { status: 400 });
      }
      const patient = (await Patient.findById(rawPatientId).select("_id").lean()) as { _id?: unknown } | null;
      if (!patient?._id) {
        return NextResponse.json({ message: "Patient not found" }, { status: 404 });
      }
      patientId = String(patient._id);
      visitRef = null;
    }

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

    let hadExistingBill = false;
    let labBill: LabBillResponse | null = null;
    if (visitRef) {
      hadExistingBill = Boolean(await LabBill.exists({ visit: visitRef }));

      await syncLabBillForVisitItems({
        patientId,
        visitId: visitRef,
        items,
        sessionUserId: userId,
        generatedByName,
        billOffer,
        ...(paymentMethodRef ? { paymentMethod: paymentMethodRef } : {}),
      });

      const uniqLabIds = items.length === 0 ? [] : Array.from(new Set(items.map((i) => i.labTestId)));
      await Prescription.updateOne(
        { patient: patientId, visit: visitRef },
        { $set: { labTests: uniqLabIds, updatedAt: new Date() } }
      );

      labBill = await LabBill.findOne({ visit: visitRef })
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
    } else {
      const labOnlyBaseFilter = {
        patient: patientId,
        $or: [{ visit: { $exists: false } }, { visit: null }],
      };
      let targetBillFilter: Record<string, unknown> | null = null;
      if (billId) {
        if (!mongoose.Types.ObjectId.isValid(billId)) {
          return NextResponse.json({ message: "Invalid bill id" }, { status: 400 });
        }
        targetBillFilter = { ...labOnlyBaseFilter, _id: billId };
        hadExistingBill = Boolean(await LabBill.exists(targetBillFilter));
        if (!hadExistingBill) {
          return NextResponse.json({ message: "Lab bill not found" }, { status: 404 });
        }
      }

      if (items.length === 0) {
        if (targetBillFilter) {
          await LabBill.deleteOne(targetBillFilter);
        }
        labBill = null;
      } else {
        const ids = Array.from(new Set(items.map((i) => i.labTestId)));
        const tests = (await LabTest.find({ _id: { $in: ids } }).lean()) as Array<{
          _id: mongoose.Types.ObjectId;
          name?: string;
          price?: number;
        }>;
        const testById = new Map(tests.map((t) => [String(t._id), t]));
        const billItems = items.map((row) => {
          const t = testById.get(row.labTestId);
          const unit = Number(t?.price) || 0;
          const qty = Math.max(1, Number(row.quantity) || 1);
          const gross = unit * qty;
          const lineOffer = clampLineOffer(gross, Number(row.lineOffer) || 0);
          return {
            labTest: t?._id ?? row.labTestId,
            labTestName: t?.name ?? "Lab Test",
            quantity: qty,
            unitPrice: unit,
            lineOffer,
            totalPrice: lineNetAfterOffer(gross, lineOffer),
          };
        });
        const linesNetSum = billItems.reduce((s, r) => s + Number(r.totalPrice || 0), 0);
        const grandTotal = grandTotalAfterBillOffer(linesNetSum, billOffer ?? 0);
        const updateDoc: Record<string, unknown> = {
          patient: patientId,
          items: billItems,
          billOffer: clampBillOffer(linesNetSum, billOffer ?? 0),
          grandTotal,
          generatedByName,
          billedBy: userId,
          billedAt: new Date(),
          updatedAt: new Date(),
          ...(paymentMethodRef ? { paymentMethod: paymentMethodRef } : {}),
        };
        if (targetBillFilter) {
          labBill = await LabBill.findOneAndUpdate(
            targetBillFilter,
            { $set: updateDoc, $unset: { visit: "" } },
            { new: true }
          )
            .populate("patient", "name regNo age gender phone address")
            .populate("billedBy", "name")
            .populate("paymentMethod", "name code")
            .populate("items.labTest", "name price")
            .lean();
        } else {
          const created = await LabBill.create({
            ...updateDoc,
            billedAt: new Date(),
          });
          labBill = await LabBill.findById(created._id)
            .populate("patient", "name regNo age gender phone address")
            .populate("billedBy", "name")
            .populate("paymentMethod", "name code")
            .populate("items.labTest", "name price")
            .lean();
        }
      }
    }

    if (!hadExistingBill && labBill) {
      const labBillId = String(labBill._id);
      const patientName = (labBill.patient as { name?: string } | undefined)?.name ?? "Patient";
      const receiptNo =
        ((labBill.visit as { receiptNo?: string } | undefined)?.receiptNo ?? "").trim();
      await sendPushNotificationToLaboratory({
        title: "New Lab Bill Created",
        body: receiptNo ? `${patientName} - Receipt ${receiptNo}` : patientName,
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
