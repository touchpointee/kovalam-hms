import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import Expense from "@/models/Expense";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";

const categories = ["salary", "supplies", "utilities", "maintenance", "misc", "other"] as const;

const putSchema = z.object({
  category: z.enum(categories).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  date: z.string().min(1).optional(),
});

export const PUT = withRouteLog("expenses.id.PUT", async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = putSchema.safeParse({
      ...body,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const update: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.date) update.date = new Date(parsed.data.date);
    const expense = await Expense.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate("addedBy", "name")
      .lean();
    if (!expense) return NextResponse.json({ message: "Expense not found" }, { status: 404 });
    return NextResponse.json(expense);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

export const DELETE = withRouteLog("expenses.id.DELETE", async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) return NextResponse.json({ message: "Expense not found" }, { status: 404 });
    return NextResponse.json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
