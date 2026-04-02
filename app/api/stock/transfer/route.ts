import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import MedicineStock from "@/models/MedicineStock";
import StockTransaction from "@/models/StockTransaction";
import { withRouteLog } from "@/lib/with-route-log";
import { buildInventoryTypeQuery } from "@/lib/stock";

const postSchema = z.object({
  sourceStockId: z.string().min(1),
  quantity: z.number().int().min(1),
  reason: z.string().optional(),
  referenceNumber: z.string().optional(),
});

export const POST = withRouteLog("stock.transfer.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["pharmacy", "admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      ...body,
      quantity: parseInt(String(body.quantity), 10),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const { sourceStockId, quantity, reason, referenceNumber } = parsed.data;
    if (!mongoose.Types.ObjectId.isValid(sourceStockId)) {
      return NextResponse.json({ message: "Invalid source stock" }, { status: 400 });
    }

    const sourceStock = await MedicineStock.findOne({
      _id: sourceStockId,
      ...buildInventoryTypeQuery("store"),
    });
    if (!sourceStock) {
      return NextResponse.json({ message: "Store stock not found" }, { status: 404 });
    }
    if (sourceStock.currentStock < quantity) {
      return NextResponse.json(
        { message: `Insufficient store stock for batch ${sourceStock.batchNo}. Available: ${sourceStock.currentStock}` },
        { status: 400 }
      );
    }

    let targetStock = await MedicineStock.findOne({
      inventoryType: "pharmacy",
      medicine: sourceStock.medicine,
      batchNo: sourceStock.batchNo,
      expiryDate: sourceStock.expiryDate,
      mrp: sourceStock.mrp,
      sellingPrice: sourceStock.sellingPrice,
      sourceStock: sourceStock._id,
    });

    const userId = (session!.user as { id?: string }).id;
    const sourcePrevQty = sourceStock.currentStock;
    sourceStock.currentStock = sourcePrevQty - quantity;
    sourceStock.quantityOut += quantity;
    sourceStock.updatedAt = new Date();
    await sourceStock.save();

    if (!targetStock) {
      targetStock = await MedicineStock.create({
        medicine: sourceStock.medicine,
        inventoryType: "pharmacy",
        sourceStock: sourceStock._id,
        batchNo: sourceStock.batchNo,
        expiryDate: sourceStock.expiryDate,
        mrp: sourceStock.mrp,
        sellingPrice: sourceStock.sellingPrice,
        quantityIn: quantity,
        quantityOut: 0,
        currentStock: quantity,
        minQuantity: sourceStock.minQuantity,
        maxQuantity: sourceStock.maxQuantity,
        location: "Pharmacy",
        supplier: sourceStock.supplier,
        addedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      targetStock.quantityIn += quantity;
      targetStock.currentStock += quantity;
      targetStock.updatedAt = new Date();
      await targetStock.save();
    }

    await StockTransaction.create([
      {
        medicineStock: sourceStock._id,
        medicine: sourceStock.medicine,
        inventoryType: "store",
        relatedStock: targetStock._id,
        transactionType: "out",
        quantity,
        previousQuantity: sourcePrevQty,
        newQuantity: sourceStock.currentStock,
        reason: reason?.trim() || "Transferred to pharmacy stock",
        referenceNumber: referenceNumber?.trim() || "",
        performedBy: userId,
      },
      {
        medicineStock: targetStock._id,
        medicine: targetStock.medicine,
        inventoryType: "pharmacy",
        relatedStock: sourceStock._id,
        transactionType: "in",
        quantity,
        previousQuantity: targetStock.currentStock - quantity,
        newQuantity: targetStock.currentStock,
        reason: reason?.trim() || "Received from store stock",
        referenceNumber: referenceNumber?.trim() || "",
        performedBy: userId,
      },
    ]);

    const populated = await MedicineStock.findById(targetStock._id)
      .populate("medicine", "name unit")
      .populate("addedBy", "name")
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
