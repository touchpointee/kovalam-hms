import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import LabTest from "@/models/LabTest";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";

const putSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withRouteLog("labTests.id.PUT", async (
  req: NextRequest,
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
    const body = await req.json();
    const parsed = putSchema.safeParse({
      ...body,
      price: body.price !== undefined ? Number(body.price) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const labTest = await LabTest.findByIdAndUpdate(id, { $set: parsed.data }, { new: true }).lean();
    if (!labTest) return NextResponse.json({ message: "Lab test not found" }, { status: 404 });
    return NextResponse.json(labTest);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

export const DELETE = withRouteLog("labTests.id.DELETE", async (
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
    const labTest = await LabTest.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
    if (!labTest) return NextResponse.json({ message: "Lab test not found" }, { status: 404 });
    return NextResponse.json(labTest);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
