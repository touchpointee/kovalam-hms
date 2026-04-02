import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireRole } from "@/lib/api-auth";
import "@/models/PaymentMethod";
import ProcedureBill from "@/models/ProcedureBill";
import mongoose from "mongoose";
import Procedure from "@/models/Procedure";
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

export const GET = withRouteLog("billing.procedure.billId.GET", async (
  _req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { billId } = await params;
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const bill = await ProcedureBill.findById(billId)
      .populate("patient")
      .populate({
        path: "visit",
        populate: { path: "doctor", select: "name" },
      })
      .populate("billedBy", "name")
      .populate("paymentMethod", "name code")
      .populate("items.procedure")
      .lean();
    if (!bill) return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    return NextResponse.json(bill);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

export const PUT = withRouteLog("billing.procedure.billId.PUT", async (
  req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const forbidden = requireRole(session, ["admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const { billId } = await params;
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const generatedByName = String(body.generatedByName ?? "").trim() || session.user.name?.trim() || "";
    const parsedItems = z.array(itemSchema).min(1).safeParse(
      (body.items ?? []).map((item: { procedureId: string; quantity: number; lineOffer?: number }) => ({
        procedureId: item.procedureId,
        quantity: typeof item.quantity === "number" ? item.quantity : parseInt(String(item.quantity), 10),
        lineOffer: typeof item.lineOffer === "number" ? item.lineOffer : undefined,
      }))
    );
    if (!parsedItems.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const bill = await ProcedureBill.findById(billId);
    if (!bill) return NextResponse.json({ message: "Bill not found" }, { status: 404 });

    const billOfferRaw =
      typeof body.billOffer === "number" ? body.billOffer : parseFloat(String(body.billOffer ?? 0)) || 0;

    const itemsWithDetails = await Promise.all(
      parsedItems.data.map(async (item) => {
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
    const linesNetSum = itemsWithDetails.reduce((sum, item) => sum + item.totalPrice, 0);
    const grandTotal = grandTotalAfterBillOffer(linesNetSum, billOfferRaw);

    let paymentMethodRef: mongoose.Types.ObjectId | undefined;
    const pmBody = body.paymentMethodId != null ? String(body.paymentMethodId).trim() : "";
    if (pmBody) {
      try {
        paymentMethodRef = await resolvePaymentMethodId(pmBody, { required: true });
      } catch (err) {
        return NextResponse.json(
          { message: err instanceof Error ? err.message : "Invalid payment method" },
          { status: 400 }
        );
      }
    } else if (grandTotal > 0 && !bill.paymentMethod) {
      return NextResponse.json({ message: "Payment method is required" }, { status: 400 });
    }

    bill.items = itemsWithDetails as unknown as typeof bill.items;
    bill.billOffer = clampBillOffer(linesNetSum, billOfferRaw);
    bill.grandTotal = grandTotal;
    bill.billedAt = new Date();
    bill.generatedByName = generatedByName;
    bill.billedBy = (session.user as { id?: string }).id as unknown as mongoose.Types.ObjectId;
    if (paymentMethodRef) bill.paymentMethod = paymentMethodRef;
    await bill.save();

    const populated = await ProcedureBill.findById(bill._id)
      .populate("patient", "name regNo age gender phone address")
      .populate({
        path: "visit",
        select: "visitDate receiptNo opCharge",
        populate: { path: "doctor", select: "name" },
      })
      .populate("billedBy", "name")
      .populate("paymentMethod", "name code")
      .populate("items.procedure")
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
