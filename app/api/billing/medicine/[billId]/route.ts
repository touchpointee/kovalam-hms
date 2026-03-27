import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireRole } from "@/lib/api-auth";
import MedicineBill from "@/models/MedicineBill";
import mongoose from "mongoose";
import MedicineStock from "@/models/MedicineStock";
import StockTransaction from "@/models/StockTransaction";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
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
      .populate("visit")
      .populate("prescription")
      .populate("billedBy", "name")
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
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const forbidden = requireRole(session, ["admin"]);
    if (forbidden) return forbidden;

    const { billId } = await params;
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const existingBill = await MedicineBill.findById(billId).lean() as {
      _id: string;
      visit?: string;
      items?: Array<{ medicineStock?: string; quantity?: number }>;
    } | null;
    if (!existingBill) {
      return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    }

    const body = await req.json();
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
      totalPrice: number;
    }> = [];

    for (const item of items) {
      const quantity = typeof item.quantity === "number" ? item.quantity : parseInt(String(item.quantity), 10);
      const sellingPrice = Number(item.sellingPrice);
      if (!item.medicineStockId || !quantity || quantity < 1 || Number.isNaN(sellingPrice)) {
        return NextResponse.json({ message: "Validation failed" }, { status: 400 });
      }

      const stock = await MedicineStock.findById(item.medicineStockId);
      if (!stock) {
        return NextResponse.json({ message: `Stock ${item.medicineStockId} not found` }, { status: 400 });
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
      billItems.push({
        medicineStock: item.medicineStockId,
        medicineName,
        batchNo: stock.batchNo,
        expiryDate: stock.expiryDate,
        quantity,
        mrp: stock.mrp,
        sellingPrice,
        totalPrice: sellingPrice * quantity,
      });
    }

    for (const item of existingBill.items ?? []) {
      if (!item.medicineStock || !item.quantity) continue;
      const stock = await MedicineStock.findById(item.medicineStock);
      if (!stock) continue;

      const prevQty = stock.currentStock;
      stock.currentStock = prevQty + item.quantity;
      stock.quantityOut = Math.max(0, stock.quantityOut - item.quantity);
      stock.updatedAt = new Date();
      await stock.save();

      await StockTransaction.create({
        medicineStock: stock._id,
        medicine: stock.medicine,
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
      const stock = await MedicineStock.findById(stockId);
      if (!stock) {
        return NextResponse.json({ message: `Stock ${stockId} not found` }, { status: 400 });
      }
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
        reason: "Medicine bill updated",
        referenceNumber: String(existingBill.visit ?? billId),
        performedBy: (session.user as { id?: string }).id,
      });
    }

    const grandTotal = billItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const updated = await MedicineBill.findByIdAndUpdate(
      billId,
      {
        $set: {
          items: billItems,
          grandTotal,
          billedAt: new Date(),
          billedBy: (session.user as { id?: string }).id,
        },
      },
      { new: true }
    )
      .populate("patient")
      .populate("visit")
      .populate("prescription")
      .populate("billedBy", "name")
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
}
