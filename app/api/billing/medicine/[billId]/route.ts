import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireRole } from "@/lib/api-auth";
import "@/models/PaymentMethod";
import MedicineBill from "@/models/MedicineBill";
import mongoose from "mongoose";
import MedicineStock from "@/models/MedicineStock";
import StockTransaction from "@/models/StockTransaction";
import { withRouteLog } from "@/lib/with-route-log";
import { resolvePaymentMethodId } from "@/lib/payment-method";
import {
  clampBillOffer,
  clampLineOffer,
  grandTotalAfterBillOffer,
  lineNetAfterOffer,
} from "@/lib/bill-offers";
import { buildInventoryTypeQuery } from "@/lib/stock";

export const GET = withRouteLog("billing.medicine.billId.GET", async (
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
    const bill = await MedicineBill.findById(billId)
      .populate("patient")
      .populate({
        path: "visit",
        populate: { path: "doctor", select: "name" },
      })
      .populate("prescription")
      .populate("billedBy", "name")
      .populate("paymentMethod", "name code")
      .populate({
        path: "items.medicineStock",
        populate: { path: "medicine", select: "name" },
      })
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

export const PUT = withRouteLog("billing.medicine.billId.PUT", async (
  req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const forbidden = requireRole(session, ["admin", "pharmacy", "frontdesk"]);
    if (forbidden) return forbidden;

    const { billId } = await params;
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const existingBillDoc = await MedicineBill.findById(billId);
    if (!existingBillDoc) {
      return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    }
    const existingBill = existingBillDoc.toObject() as unknown as {
      _id: string;
      visit?: string;
      paymentMethod?: unknown;
      items?: Array<{ medicineStock?: string; quantity?: number }>;
    };

    const body = await req.json();
    const generatedByName = String(body.generatedByName ?? "").trim() || session.user.name?.trim() || "";
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ message: "At least one item is required" }, { status: 400 });
    }
    const previousQtyByStock = new Map<string, number>();
    for (const item of existingBill.items ?? []) {
      if (!item.medicineStock || !item.quantity) continue;
      const key = String(item.medicineStock);
      previousQtyByStock.set(key, (previousQtyByStock.get(key) ?? 0) + item.quantity);
    }

    const preparedItems: Array<{
      stockId: string;
      quantity: number;
      sellingPrice: number;
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

    const billOfferRaw =
      typeof body.billOffer === "number" ? body.billOffer : parseFloat(String(body.billOffer ?? 0)) || 0;

    for (const item of items) {
      const quantity = typeof item.quantity === "number" ? item.quantity : parseInt(String(item.quantity), 10);
      const sellingPrice = Number(item.sellingPrice);
      const lineOfferIn =
        typeof item.lineOffer === "number" ? item.lineOffer : parseFloat(String(item.lineOffer ?? 0)) || 0;
      if (!item.medicineStockId || !quantity || quantity < 1 || Number.isNaN(sellingPrice)) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
      }

      const stock = await MedicineStock.findOne({
        _id: item.medicineStockId,
        ...buildInventoryTypeQuery("pharmacy"),
      });
      if (!stock) {
        return NextResponse.json({ message: `Pharmacy stock ${item.medicineStockId} not found` }, { status: 400 });
      }
      const effectiveAvailable = stock.currentStock + (previousQtyByStock.get(String(stock._id)) ?? 0);
      if (effectiveAvailable < quantity) {
        return NextResponse.json(
          { message: `Insufficient stock for batch ${stock.batchNo}. Available: ${effectiveAvailable}` },
          { status: 400 }
        );
      }

      const medicine = await import("@/models/Medicine").then(
        (m) => m.default.findById(stock.medicine).select("name").lean() as { name?: string } | null
      );
      const medicineName = medicine?.name ?? "Unknown";
      preparedItems.push({
        stockId: String(stock._id),
        quantity,
        sellingPrice,
      });
      const gross = sellingPrice * quantity;
      const lineOffer = clampLineOffer(gross, lineOfferIn);
      billItems.push({
        medicineStock: item.medicineStockId,
        medicineName,
        batchNo: stock.batchNo,
        expiryDate: stock.expiryDate,
        quantity,
        mrp: stock.mrp,
        sellingPrice,
        lineOffer,
        totalPrice: lineNetAfterOffer(gross, lineOffer),
      });
    }

    for (const item of existingBill.items ?? []) {
      if (!item.medicineStock || !item.quantity) continue;
      const stock = await MedicineStock.findOne({
        _id: item.medicineStock,
        ...buildInventoryTypeQuery("pharmacy"),
      });
      if (!stock) continue;

      const prevQty = stock.currentStock;
      stock.currentStock = prevQty + item.quantity;
      stock.quantityOut = Math.max(0, stock.quantityOut - item.quantity);
      stock.updatedAt = new Date();
      await stock.save();

      await StockTransaction.create({
        medicineStock: stock._id,
        medicine: stock.medicine,
        inventoryType: stock.inventoryType ?? "pharmacy",
        transactionType: "in",
        quantity: item.quantity,
        previousQuantity: prevQty,
        newQuantity: stock.currentStock,
        reason: "Medicine bill edit restore",
        referenceNumber: String(existingBill.visit ?? billId),
        performedBy: (session.user as { id?: string }).id,
      });
    }

    for (const item of preparedItems) {
      const { stockId, quantity } = item;
      const stock = await MedicineStock.findOne({
        _id: stockId,
        ...buildInventoryTypeQuery("pharmacy"),
      });
      if (!stock) {
        return NextResponse.json({ message: `Pharmacy stock ${stockId} not found` }, { status: 400 });
      }
      const prevQty = stock.currentStock;
      stock.currentStock = prevQty - quantity;
      stock.quantityOut += quantity;
      stock.updatedAt = new Date();
      await stock.save();

      await StockTransaction.create({
        medicineStock: stock._id,
        medicine: stock.medicine,
        inventoryType: stock.inventoryType ?? "pharmacy",
        transactionType: "out",
        quantity,
        previousQuantity: prevQty,
        newQuantity: stock.currentStock,
        reason: "Medicine bill updated",
        referenceNumber: String(existingBill.visit ?? billId),
        performedBy: (session.user as { id?: string }).id,
      });
    }

    const linesNetSum = billItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const grandTotal = grandTotalAfterBillOffer(linesNetSum, billOfferRaw);

    const pmBody = body.paymentMethodId != null ? String(body.paymentMethodId).trim() : "";
    let paymentMethodUpdate: mongoose.Types.ObjectId | undefined;
    if (pmBody) {
      try {
        paymentMethodUpdate = await resolvePaymentMethodId(pmBody, { required: true });
      } catch (err) {
        return NextResponse.json(
          { message: err instanceof Error ? err.message : "Invalid payment method" },
          { status: 400 }
        );
      }
    } else if (grandTotal > 0 && !existingBillDoc.paymentMethod) {
      return NextResponse.json({ message: "Payment method is required" }, { status: 400 });
    }

    const setPayload: Record<string, unknown> = {
      items: billItems,
      billOffer: clampBillOffer(linesNetSum, billOfferRaw),
      grandTotal,
      billedAt: new Date(),
      generatedByName,
      billedBy: (session.user as { id?: string }).id,
    };
    if (paymentMethodUpdate) setPayload.paymentMethod = paymentMethodUpdate;

    const updated = await MedicineBill.findByIdAndUpdate(
      billId,
      { $set: setPayload },
      { new: true }
    )
      .populate("patient")
      .populate({
        path: "visit",
        populate: { path: "doctor", select: "name" },
      })
      .populate("prescription")
      .populate("billedBy", "name")
      .populate("paymentMethod", "name code")
      .populate({
        path: "items.medicineStock",
        populate: { path: "medicine", select: "name" },
      })
      .lean();

    if (!updated) return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
