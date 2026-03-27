import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import Medicine from "@/models/Medicine";
import mongoose from "mongoose";

const putSchema = z.object({
  name: z.string().min(1).optional(),
  genericName: z.string().optional(),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  unit: z.string().optional(),
  minQuantity: z.number().int().min(0).optional(),
  maxQuantity: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "pharmacy"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = putSchema.safeParse({
      ...body,
      minQuantity: body.minQuantity === "" || body.minQuantity === undefined ? undefined : parseInt(String(body.minQuantity), 10),
      maxQuantity: body.maxQuantity === "" || body.maxQuantity === undefined ? undefined : parseInt(String(body.maxQuantity), 10),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const medicine = await Medicine.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();
    if (!medicine) return NextResponse.json({ message: "Medicine not found" }, { status: 404 });
    return NextResponse.json(medicine);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "pharmacy"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const medicine = await Medicine.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
    if (!medicine) return NextResponse.json({ message: "Medicine not found" }, { status: 404 });
    return NextResponse.json(medicine);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
