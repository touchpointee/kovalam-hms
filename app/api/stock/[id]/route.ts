import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import MedicineStock from "@/models/MedicineStock";
import StockTransaction from "@/models/StockTransaction";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";

const putSchema = z.object({
  transactionType: z.enum(["in", "out", "adjustment"]),
  quantity: z.number().int().min(1),
  reason: z.string().optional(),
  referenceNumber: z.string().optional(),
});

export const PUT = withRouteLog("stock.id.PUT", async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["pharmacy", "admin"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = putSchema.safeParse({
      ...body,
      quantity: parseInt(String(body.quantity), 10),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const stock = await MedicineStock.findById(id);
    if (!stock) return NextResponse.json({ message: "Stock not found" }, { status: 404 });

    const prevQty = stock.currentStock;
    let nextQty = prevQty;
    if (parsed.data.transactionType === "in") {
      stock.quantityIn += parsed.data.quantity;
      nextQty = prevQty + parsed.data.quantity;
    } else if (parsed.data.transactionType === "out") {
      if (stock.currentStock < parsed.data.quantity) {
        return NextResponse.json({ message: "Insufficient stock" }, { status: 400 });
      }
      stock.quantityOut += parsed.data.quantity;
      nextQty = prevQty - parsed.data.quantity;
    } else {
      nextQty = parsed.data.quantity;
    }
    stock.currentStock = nextQty;
    stock.updatedAt = new Date();
    await stock.save();

    const userId = (session!.user as { id?: string }).id;
    await StockTransaction.create({
      medicineStock: stock._id,
      medicine: stock.medicine,
      inventoryType: stock.inventoryType ?? "store",
      transactionType: parsed.data.transactionType,
      quantity: parsed.data.quantity,
      previousQuantity: prevQty,
      newQuantity: nextQty,
      reason: parsed.data.reason ?? "",
      referenceNumber: parsed.data.referenceNumber ?? "",
      performedBy: userId,
    });

    const updated = await MedicineStock.findById(id)
      .populate("medicine", "name unit")
      .populate("addedBy", "name")
      .lean();
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
