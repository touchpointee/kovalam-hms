import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import Procedure from "@/models/Procedure";
import mongoose from "mongoose";

const putSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
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
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = putSchema.safeParse({
      ...body,
      price: body.price !== undefined ? Number(body.price) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const procedure = await Procedure.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();
    if (!procedure) return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
    return NextResponse.json(procedure);
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
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const procedure = await Procedure.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
    if (!procedure) return NextResponse.json({ message: "Procedure not found" }, { status: 404 });
    return NextResponse.json(procedure);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
