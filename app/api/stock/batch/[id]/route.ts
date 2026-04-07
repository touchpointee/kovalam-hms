import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import MedicineStock from "@/models/MedicineStock";
import StockTransaction from "@/models/StockTransaction";
import { withRouteLog } from "@/lib/with-route-log";

const putSchema = z.object({
  batchNo: z.string().min(1),
  expiryDate: z.string().min(1),
  mrp: z.number().min(0),
  sellingPrice: z.number().min(0),
  currentStock: z.number().int().min(0).optional(),
  location: z.string().optional(),
  supplier: z.string().optional(),
  reason: z.string().optional(),
});

export const PUT = withRouteLog("stock.batch.id.PUT", async (
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
      mrp: Number(body.mrp),
      sellingPrice: Number(body.sellingPrice),
      currentStock: body.currentStock !== undefined ? parseInt(String(body.currentStock), 10) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    if (parsed.data.sellingPrice > parsed.data.mrp) {
      return NextResponse.json(
        { message: "Selling price cannot be greater than MRP" },
        { status: 400 }
      );
    }

    const expiryDate = new Date(parsed.data.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) {
      return NextResponse.json({ message: "Invalid expiry date" }, { status: 400 });
    }

    const stock = await MedicineStock.findById(id);
    if (!stock) return NextResponse.json({ message: "Stock not found" }, { status: 404 });

    const prevQty = stock.currentStock;
    const nextQty =
      parsed.data.currentStock !== undefined ? parsed.data.currentStock : stock.currentStock;

    stock.batchNo = parsed.data.batchNo;
    stock.expiryDate = expiryDate;
    stock.mrp = parsed.data.mrp;
    stock.sellingPrice = parsed.data.sellingPrice;
    stock.location = parsed.data.location ?? "";
    stock.supplier = parsed.data.supplier ?? "";
    stock.currentStock = nextQty;
    stock.updatedAt = new Date();
    await stock.save();

    if (nextQty !== prevQty) {
      const userId = (session!.user as { id?: string }).id;
      await StockTransaction.create({
        medicineStock: stock._id,
        medicine: stock.medicine,
        inventoryType: stock.inventoryType ?? "store",
        transactionType: "adjustment",
        quantity: nextQty,
        previousQuantity: prevQty,
        newQuantity: nextQty,
        reason: parsed.data.reason?.trim() || "Batch edit adjustment",
        referenceNumber: "",
        performedBy: userId,
      });
    }

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

export const DELETE = withRouteLog("stock.batch.id.DELETE", async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const stock = await MedicineStock.findById(id);
    if (!stock) return NextResponse.json({ message: "Stock not found" }, { status: 404 });

    if ((stock.currentStock ?? 0) > 0) {
      return NextResponse.json(
        { message: "Cannot delete a batch with stock. Adjust to 0 first." },
        { status: 400 }
      );
    }

    const MedicineBill = (await import("@/models/MedicineBill")).default;
    const used = await MedicineBill.exists({ "items.medicineStock": stock._id });
    if (used) {
      return NextResponse.json(
        { message: "Cannot delete a batch used in billing history." },
        { status: 400 }
      );
    }

    await StockTransaction.deleteMany({ medicineStock: stock._id });
    await MedicineStock.deleteOne({ _id: stock._id });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
