import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import "@/models/PaymentMethod";
import Procedure from "@/models/Procedure";
import ProcedureBill from "@/models/ProcedureBill";
import { withRouteLog } from "@/lib/with-route-log";
import { resolvePaymentMethodId } from "@/lib/payment-method";
import {
  clampBillOffer,
  clampLineOffer,
  grandTotalAfterBillOffer,
  lineNetAfterOffer,
} from "@/lib/bill-offers";

const itemSchema = z.object({
  procedureId: z.string().min(1),
  quantity: z.number().int().min(1),
  lineOffer: z.coerce.number().min(0).optional(),
});

const postSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  items: z.array(itemSchema).min(1),
  billOffer: z.coerce.number().min(0).optional(),
  paymentMethodId: z.string().optional(),
});

export const POST = withRouteLog("billing.procedure.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["frontdesk", "admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      ...body,
      items: (body.items ?? []).map(
        (i: { procedureId: string; quantity: number; lineOffer?: number }) => ({
          procedureId: i.procedureId,
          quantity: typeof i.quantity === "number" ? i.quantity : parseInt(String(i.quantity), 10),
          lineOffer: typeof i.lineOffer === "number" ? i.lineOffer : undefined,
        })
      ),
      billOffer: typeof body.billOffer === "number" ? body.billOffer : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const itemsWithDetails = await Promise.all(
      parsed.data.items.map(async (item) => {
        const proc = await Procedure.findById(item.procedureId).lean() as { name: string; price: number } | null;
        if (!proc) throw new Error(`Procedure ${item.procedureId} not found`);
        const unitPrice = proc.price;
        const gross = unitPrice * item.quantity;
        const lineOffer = clampLineOffer(gross, item.lineOffer ?? 0);
        const totalPrice = lineNetAfterOffer(gross, lineOffer);
        return {
          procedure: item.procedureId,
          procedureName: proc.name,
          quantity: item.quantity,
          unitPrice,
          lineOffer,
          totalPrice,
        };
      })
    );
    const linesNetSum = itemsWithDetails.reduce((sum, i) => sum + i.totalPrice, 0);
    const grandTotal = grandTotalAfterBillOffer(linesNetSum, parsed.data.billOffer ?? 0);
    const userId = (session!.user as { id?: string }).id;

    let paymentMethodRef;
    try {
      paymentMethodRef = await resolvePaymentMethodId(parsed.data.paymentMethodId, {
        required: grandTotal > 0,
      });
    } catch (err) {
      return NextResponse.json(
        { message: err instanceof Error ? err.message : "Invalid payment method" },
        { status: 400 }
      );
    }

    const bill = await ProcedureBill.create({
      patient: parsed.data.patientId,
      visit: parsed.data.visitId || undefined,
      items: itemsWithDetails,
      billOffer: clampBillOffer(linesNetSum, parsed.data.billOffer ?? 0),
      grandTotal,
      billedBy: userId,
      ...(paymentMethodRef ? { paymentMethod: paymentMethodRef } : {}),
    });
    const populated = await ProcedureBill.findById(bill._id)
      .populate("patient", "name regNo age gender phone")
      .populate({
        path: "visit",
        select: "visitDate receiptNo opCharge",
        populate: { path: "doctor", select: "name" },
      })
      .populate("billedBy", "name")
      .populate("paymentMethod", "name code")
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
