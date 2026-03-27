import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import OPVisit from "@/models/OPVisit";
import OPChargeSetting from "@/models/OPChargeSetting";
import { generateReceiptNo } from "@/lib/counters";
import { startOfDay, endOfDay, parseISO, subDays } from "date-fns";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
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
      .populate("patient", "name regNo age gender phone")
      .populate("collectedBy", "name")
      .sort({ visitDate: -1 })
      .lean();

    if (!includeProcedureBills || visits.length === 0) {
      return NextResponse.json(visits);
    }

    const visitIds = visits.map((visit) => visit._id);
    const procedureBills = await import("@/models/ProcedureBill").then(({ default: ProcedureBill }) =>
      ProcedureBill.find({ visit: { $in: visitIds } }).select("_id visit grandTotal billedAt").lean()
    );

    const billsByVisit = new Map<string, Array<{ _id: string; grandTotal?: number; billedAt?: Date }>>();
    for (const bill of procedureBills as Array<{ _id: { toString(): string }; visit?: { toString(): string }; grandTotal?: number; billedAt?: Date }>) {
      const visitKey = bill.visit?.toString();
      if (!visitKey) continue;
      const existing = billsByVisit.get(visitKey) ?? [];
      existing.push({
        _id: bill._id.toString(),
        grandTotal: bill.grandTotal,
        billedAt: bill.billedAt,
      });
      billsByVisit.set(visitKey, existing);
    }

    return NextResponse.json(
      visits.map((visit) => ({
        ...visit,
        procedureBills: billsByVisit.get(String(visit._id)) ?? [],
      }))
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

const postSchema = z.object({
  patientId: z.string().min(1),
  paid: z.boolean().optional(),
  /** Mark these existing unpaid OP visits as paid (same patient; payment collected now). */
  settlePendingVisitIds: z.array(z.string()).optional(),
});

const patchSchema = z.object({
  visitId: z.string().min(1),
  status: z.enum(["waiting", "served"]),
});

export async function POST(req: NextRequest) {
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

    const setting = await OPChargeSetting.findOne().sort({ updatedAt: -1 }).lean() as { amount?: number } | null;
    const baseOpCharge = setting?.amount ?? 0;

    const fiveDaysAgo = subDays(new Date(), 5);
    const latestServed = await OPVisit.findOne({
      patient: parsed.data.patientId,
      status: "served",
    })
      .sort({ visitDate: -1 })
      .lean() as { visitDate?: Date } | null;

    const hasRecentServedVisit =
      latestServed?.visitDate != null && new Date(latestServed.visitDate) >= fiveDaysAgo;
    const opCharge = hasRecentServedVisit ? 0 : baseOpCharge;

    const receiptNo = await generateReceiptNo();
    const userId = (session!.user as { id?: string }).id;

    const visit = await OPVisit.create({
      patient: parsed.data.patientId,
      status: "waiting",
      opCharge,
      paid: parsed.data.paid ?? false,
      receiptNo,
      collectedBy: userId,
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

    const settleIds = parsed.data.settlePendingVisitIds?.filter((id) => mongoose.Types.ObjectId.isValid(id)) ?? [];
    if (settleIds.length > 0) {
      const toSettle = await OPVisit.find({
        _id: { $in: settleIds },
        patient: parsed.data.patientId,
        paid: { $ne: true },
      }).lean();

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
      .populate("patient", "name regNo age gender phone")
      .populate("collectedBy", "name")
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
}

export async function PATCH(req: NextRequest) {
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
