import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import MedicineStock from "@/models/MedicineStock";
import mongoose from "mongoose";

const putSchema = z.object({
  adjustQty: z.number().int(),
  reason: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      adjustQty: parseInt(String(body.adjustQty), 10),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const stock = await MedicineStock.findById(id);
    if (!stock) return NextResponse.json({ message: "Stock not found" }, { status: 404 });

    const adjustQty = parsed.data.adjustQty;
    if (adjustQty > 0) {
      stock.quantityIn += adjustQty;
      stock.currentStock += adjustQty;
    } else {
      const out = Math.abs(adjustQty);
      if (stock.currentStock < out) {
        return NextResponse.json({ message: "Insufficient stock" }, { status: 400 });
      }
      stock.quantityOut += out;
      stock.currentStock -= out;
    }
    stock.updatedAt = new Date();
    await stock.save();
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
}
