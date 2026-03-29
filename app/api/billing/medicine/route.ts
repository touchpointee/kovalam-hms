import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import "@/models/PaymentMethod";
import MedicineStock from "@/models/MedicineStock";
import MedicineBill from "@/models/MedicineBill";
import OPVisit from "@/models/OPVisit";
import StockTransaction from "@/models/StockTransaction";
import { withRouteLog } from "@/lib/with-route-log";
import { resolvePaymentMethodId } from "@/lib/payment-method";
import {
  clampBillOffer,
  clampLineOffer,
  grandTotalAfterBillOffer,
  lineNetAfterOffer,
} from "@/lib/bill-offers";

const itemSchema = z.object({
  medicineStockId: z.string().min(1),
  quantity: z.number().int().min(1),
  sellingPrice: z.number().min(0),
  lineOffer: z.coerce.number().min(0).optional(),
});

const postSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1),
  prescriptionId: z.string().optional(),
  items: z.array(itemSchema).min(1),
  billOffer: z.coerce.number().min(0).optional(),
  paymentMethodId: z.string().optional(),
});

export const POST = withRouteLog("billing.medicine.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["pharmacy", "admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      ...body,
      items: (body.items ?? []).map(
        (i: { medicineStockId: string; quantity: number; sellingPrice: number; lineOffer?: number }) => ({
          medicineStockId: i.medicineStockId,
          quantity: typeof i.quantity === "number" ? i.quantity : parseInt(String(i.quantity), 10),
          sellingPrice: Number(i.sellingPrice),
          lineOffer: typeof i.lineOffer === "number" ? i.lineOffer : undefined,
        })
      ),
      billOffer: typeof body.billOffer === "number" ? body.billOffer : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const userId = (session!.user as { id?: string }).id;
    const visit = await OPVisit.findById(parsed.data.visitId).lean() as { patient?: string } | null;
    if (!visit) {
      return NextResponse.json({ message: "Visit not found" }, { status: 400 });
    }
    if (String(visit.patient) !== parsed.data.patientId) {
      return NextResponse.json({ message: "Visit does not belong to patient" }, { status: 400 });
    }
    const existingBill = await MedicineBill.findOne({ visit: parsed.data.visitId }).lean();
    if (existingBill) {
      return NextResponse.json({ message: "Medicine bill already exists for this visit" }, { status: 400 });
    }

    const preparedItems: Array<{
      stock: InstanceType<typeof MedicineStock>;
      quantity: number;
      sellingPrice: number;
      medicineName: string;
    }> = [];
    const billItems: Array<{
      medicineStock: string;
      medicineName: string;
      batchNo: string;
      expiryDate: Date;
      quantity: number;
      mrp: number;
      sellingPrice: number;
      lineOffer: number;
      totalPrice: number;
    }> = [];
    for (const item of parsed.data.items) {
      const stock = await MedicineStock.findById(item.medicineStockId);
      if (!stock) {
        return NextResponse.json({ message: `Stock ${item.medicineStockId} not found` }, { status: 400 });
      }
      if (stock.currentStock < item.quantity) {
        return NextResponse.json(
          { message: `Insufficient stock for batch ${stock.batchNo}. Available: ${stock.currentStock}` },
          { status: 400 }
        );
      }
      const medicine = await import("@/models/Medicine").then((m) => m.default.findById(stock.medicine).select("name").lean() as { name?: string } | null);
      const medicineName = medicine?.name ?? "Unknown";
      preparedItems.push({
        stock,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        medicineName,
      });
      const gross = item.sellingPrice * item.quantity;
      const lineOffer = clampLineOffer(gross, item.lineOffer ?? 0);
      billItems.push({
        medicineStock: item.medicineStockId,
        medicineName,
        batchNo: stock.batchNo,
        expiryDate: stock.expiryDate,
        quantity: item.quantity,
        mrp: stock.mrp,
        sellingPrice: item.sellingPrice,
        lineOffer,
        totalPrice: lineNetAfterOffer(gross, lineOffer),
      });
    }

    const linesNetSum = billItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const grandTotal = grandTotalAfterBillOffer(linesNetSum, parsed.data.billOffer ?? 0);

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

    const bill = await MedicineBill.create({
      patient: parsed.data.patientId,
      visit: parsed.data.visitId,
      prescription: parsed.data.prescriptionId || undefined,
      items: billItems,
      billOffer: clampBillOffer(linesNetSum, parsed.data.billOffer ?? 0),
      grandTotal,
      billedBy: userId,
      ...(paymentMethodRef ? { paymentMethod: paymentMethodRef } : {}),
    });

    for (const item of preparedItems) {
      const { stock, quantity } = item;
      const prevQty = stock.currentStock;
      stock.currentStock = prevQty - quantity;
      stock.quantityOut += quantity;
      stock.updatedAt = new Date();
      await stock.save();

      await StockTransaction.create({
        medicineStock: stock._id,
        medicine: stock.medicine,
        transactionType: "out",
        quantity,
        previousQuantity: prevQty,
        newQuantity: stock.currentStock,
        reason: "Medicine bill generated",
        referenceNumber: String(parsed.data.visitId),
        performedBy: userId,
      });
    }
    const populated = await MedicineBill.findById(bill._id)
      .populate("patient", "name regNo age gender phone")
      .populate({
        path: "visit",
        select: "visitDate receiptNo",
        populate: { path: "doctor", select: "name" },
      })
      .populate("prescription")
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
