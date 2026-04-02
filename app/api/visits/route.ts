import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import OPVisit from "@/models/OPVisit";
import OPChargeSetting from "@/models/OPChargeSetting";
import { generateReceiptNo } from "@/lib/counters";
import { startOfDay, endOfDay, parseISO, subDays, parse, isValid } from "date-fns";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";
import { resolveVisitDoctorId } from "@/lib/visit-doctor";
import { resolvePaymentMethodId } from "@/lib/payment-method";

export const GET = withRouteLog("visits.GET", async (req: NextRequest) => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const patientId = searchParams.get("patientId");
    const statusParam = searchParams.get("status");
    const includeProcedureBills = searchParams.get("includeProcedureBills") === "true";
    const includeLabBills = searchParams.get("includeLabBills") === "true";
    const outstandingOp = searchParams.get("outstandingOp");

    if (outstandingOp === "true" && patientId) {
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return NextResponse.json({ message: "Invalid patient ID" }, { status: 400 });
      }
      const rows = await OPVisit.find({
        patient: patientId,
        paid: { $ne: true },
      })
        .select("opCharge receiptNo visitDate status")
        .sort({ visitDate: -1 })
        .lean();
      const total = rows.reduce((s, v) => s + (Number(v.opCharge) || 0), 0);
      return NextResponse.json({
        total,
        visits: rows.map((v) => ({
          _id: String(v._id),
          receiptNo: v.receiptNo,
          opCharge: Number(v.opCharge) || 0,
          visitDate: v.visitDate,
          status: v.status ?? "waiting",
        })),
      });
    }

    const filter: Record<string, unknown> = {};
    if (patientId) (filter as Record<string, unknown>).patient = patientId;
    if (statusParam === "waiting" || statusParam === "served") {
      (filter as Record<string, unknown>).status = statusParam;
    }
    if (dateParam === "today" || dateParam) {
      let start: Date;
      let end: Date;
      if (!dateParam || dateParam === "today") {
        const now = new Date();
        start = startOfDay(now);
        end = endOfDay(now);
      } else {
        const d = parseISO(dateParam);
        start = startOfDay(d);
        end = endOfDay(d);
      }
      (filter as Record<string, unknown>).visitDate = { $gte: start, $lte: end };
    }

    const visits = await OPVisit.find(filter)
      .populate("patient", "name regNo age gender phone address")
      .populate("collectedBy", "name")
      .populate("doctor", "name")
      .sort({ visitDate: -1 })
      .lean();

    if (visits.length === 0) {
      return NextResponse.json(visits);
    }

    if (!includeProcedureBills && !includeLabBills) {
      return NextResponse.json(visits);
    }

    const visitIds = visits.map((visit) => visit._id);

    const procedureBillsByVisit = new Map<string, Array<{ _id: string; grandTotal?: number; billedAt?: Date }>>();
    if (includeProcedureBills) {
      const procedureBills = await import("@/models/ProcedureBill").then(({ default: ProcedureBill }) =>
        ProcedureBill.find({ visit: { $in: visitIds } }).select("_id visit grandTotal billedAt").lean()
      );
      for (const bill of procedureBills as Array<{
        _id: { toString(): string };
        visit?: { toString(): string };
        grandTotal?: number;
        billedAt?: Date;
      }>) {
        const visitKey = bill.visit?.toString();
        if (!visitKey) continue;
        const existing = procedureBillsByVisit.get(visitKey) ?? [];
        existing.push({
          _id: bill._id.toString(),
          grandTotal: bill.grandTotal,
          billedAt: bill.billedAt,
        });
        procedureBillsByVisit.set(visitKey, existing);
      }
    }

    const labBillByVisit = new Map<string, { _id: string; grandTotal?: number }>();
    if (includeLabBills) {
      const LabBill = (await import("@/models/LabBill")).default;
      const labBills = await LabBill.find({ visit: { $in: visitIds } })
        .select("_id visit grandTotal")
        .lean();
      for (const bill of labBills as Array<{
        _id: { toString(): string };
        visit?: { toString(): string };
        grandTotal?: number;
      }>) {
        const visitKey = bill.visit?.toString();
        if (!visitKey) continue;
        labBillByVisit.set(visitKey, {
          _id: bill._id.toString(),
          grandTotal: bill.grandTotal,
        });
      }
    }

    return NextResponse.json(
      visits.map((visit) => {
        const id = String(visit._id);
        return {
          ...visit,
          ...(includeProcedureBills ? { procedureBills: procedureBillsByVisit.get(id) ?? [] } : {}),
          ...(includeLabBills ? { labBill: labBillByVisit.get(id) ?? null } : {}),
        };
      })
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

const postSchema = z.object({
  patientId: z.string().min(1),
  paid: z.boolean().optional(),
  /** Mark these existing unpaid OP visits as paid (same patient; payment collected now). */
  settlePendingVisitIds: z.array(z.string()).optional(),
  /**
   * Optional visit date (yyyy-MM-dd or ISO). Omit to use current date/time.
   * OP fee waiver: if any prior OP visit for this patient was within the last 5 days before this visit, charge 0.
   */
  visitDate: z.string().optional(),
  /**
   * When set (e.g. by frontdesk), stored as this visit's OP charge instead of deriving from settings + 5-day waiver.
   */
  opCharge: z.number().min(0).optional(),
  opChargeChangeReason: z.string().optional(),
  /** Optional consulting doctor (User id, role doctor). */
  doctorId: z.string().optional(),
  /** Required when this registration collects OP money (new visit and/or pending settlements). */
  paymentMethodId: z.string().optional(),
  generatedByName: z.string().optional(),
});

function resolveVisitDateForCreate(input: string | undefined): Date {
  if (!input?.trim()) {
    return new Date();
  }
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = parse(trimmed, "yyyy-MM-dd", new Date());
    if (!isValid(d)) {
      throw new Error("Invalid visitDate");
    }
    return startOfDay(d);
  }
  const d = parseISO(trimmed);
  if (!isValid(d)) {
    throw new Error("Invalid visitDate");
  }
  return d;
}

const patchSchema = z.object({
  visitId: z.string().min(1),
  status: z.enum(["waiting", "served"]),
});

export const POST = withRouteLog("visits.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    let visitDate: Date;
    try {
      visitDate = resolveVisitDateForCreate(parsed.data.visitDate);
    } catch {
      return NextResponse.json({ message: "Invalid visitDate" }, { status: 400 });
    }
    if (visitDate.getTime() > Date.now()) {
      return NextResponse.json({ message: "Visit date cannot be in the future" }, { status: 400 });
    }

    const setting = await OPChargeSetting.findOne().sort({ updatedAt: -1 }).lean() as { amount?: number } | null;
    const baseOpCharge = setting?.amount ?? 0;

    const fiveDaysAgo = subDays(visitDate, 5);
    const priorVisit = await OPVisit.findOne({
      patient: parsed.data.patientId,
      visitDate: { $lt: visitDate },
    })
      .sort({ visitDate: -1 })
      .lean() as { visitDate?: Date } | null;

    const hasRecentOpVisit =
      priorVisit?.visitDate != null && new Date(priorVisit.visitDate) >= fiveDaysAgo;
    const derivedOpCharge = hasRecentOpVisit ? 0 : baseOpCharge;
    const opCharge =
      parsed.data.opCharge !== undefined ? Math.max(0, Number(parsed.data.opCharge) || 0) : derivedOpCharge;
    const opChargeChanged = Math.abs(opCharge - derivedOpCharge) > 0.001;
    const opChargeChangeReason = parsed.data.opChargeChangeReason?.trim() || "";
    if (opChargeChanged && !opChargeChangeReason) {
      return NextResponse.json(
        { message: "Reason is required when OP charge is changed" },
        { status: 400 }
      );
    }

    const receiptNo = await generateReceiptNo();
    const userId = (session!.user as { id?: string }).id;
    const generatedByName = parsed.data.generatedByName?.trim() || session!.user.name?.trim() || "";

    let doctorRef: mongoose.Types.ObjectId | undefined;
    try {
      doctorRef = await resolveVisitDoctorId(parsed.data.doctorId);
    } catch (err) {
      return NextResponse.json(
        { message: err instanceof Error ? err.message : "Invalid doctor" },
        { status: 400 }
      );
    }

    const settleIds = parsed.data.settlePendingVisitIds?.filter((id) => mongoose.Types.ObjectId.isValid(id)) ?? [];
    const toSettle =
      settleIds.length > 0
        ? await OPVisit.find({
            _id: { $in: settleIds },
            patient: parsed.data.patientId,
            paid: { $ne: true },
          }).lean()
        : [];

    const totalPendingSettledPreview = toSettle.reduce(
      (s, row) => s + (Number(row.opCharge) || 0),
      0
    );
    const paidForNew = parsed.data.paid ?? false;
    const newVisitCollection = paidForNew ? opCharge : 0;
    const needPaymentMethod = newVisitCollection > 0 || totalPendingSettledPreview > 0;

    let paymentMethodRef: mongoose.Types.ObjectId | undefined;
    try {
      paymentMethodRef = await resolvePaymentMethodId(parsed.data.paymentMethodId, {
        required: needPaymentMethod,
      });
    } catch (err) {
      return NextResponse.json(
        { message: err instanceof Error ? err.message : "Invalid payment method" },
        { status: 400 }
      );
    }

    const visit = await OPVisit.create({
      patient: parsed.data.patientId,
      ...(doctorRef ? { doctor: doctorRef } : {}),
      visitDate,
      status: "waiting",
      opCharge,
      ...(opChargeChanged ? { opChargeChangeReason } : {}),
      paid: parsed.data.paid ?? false,
      receiptNo,
      ...(generatedByName ? { generatedByName } : {}),
      collectedBy: userId,
      ...(paymentMethodRef ? { paymentMethod: paymentMethodRef } : {}),
    });

    let settlement:
      | {
          settledVisits: Array<{
            _id: string;
            receiptNo: string;
            visitDate: Date;
            opCharge: number;
          }>;
          totalPendingSettled: number;
        }
      | undefined;

    if (toSettle.length > 0) {
      const settledVisits: Array<{ _id: string; receiptNo: string; visitDate: Date; opCharge: number }> = [];
      for (const row of toSettle) {
        await OPVisit.updateOne({ _id: row._id }, { $set: { paid: true } });
        settledVisits.push({
          _id: String(row._id),
          receiptNo: row.receiptNo,
          visitDate: row.visitDate as Date,
          opCharge: Number(row.opCharge) || 0,
        });
      }
      const totalPendingSettled = settledVisits.reduce((s, v) => s + v.opCharge, 0);
      if (settledVisits.length > 0) {
        settlement = { settledVisits, totalPendingSettled };
        await OPVisit.findByIdAndUpdate(visit._id, {
          $set: {
            priorSettlementTotal: totalPendingSettled,
            priorSettlementLines: settledVisits.map((v) => ({
              receiptNo: v.receiptNo,
              visitDate: v.visitDate,
              opCharge: v.opCharge,
            })),
          },
        });
      }
    }

    const finalPopulated = await OPVisit.findById(visit._id)
      .populate("patient", "name regNo age gender phone address")
      .populate("collectedBy", "name")
      .populate("doctor", "name")
      .populate("paymentMethod", "name code")
      .lean();

    return NextResponse.json({
      ...finalPopulated,
      ...(settlement ? { settlement } : {}),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

export const PATCH = withRouteLog("visits.PATCH", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "doctor", "frontdesk"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const updated = await OPVisit.findByIdAndUpdate(
      parsed.data.visitId,
      { $set: { status: parsed.data.status } },
      { new: true }
    )
      .populate("patient", "name regNo age gender phone address")
      .populate("collectedBy", "name")
      .populate("doctor", "name")
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
