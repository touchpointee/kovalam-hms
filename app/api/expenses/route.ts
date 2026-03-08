import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Expense from "@/models/Expense";
import { parseISO } from "date-fns";

const categories = ["salary", "supplies", "utilities", "maintenance", "misc", "other"] as const;

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const category = searchParams.get("category");

    const filter: Record<string, unknown> = {};
    if (fromStr || toStr) {
      const dateFilter: Record<string, Date> = {};
      if (fromStr) dateFilter.$gte = parseISO(fromStr);
      if (toStr) dateFilter.$lte = parseISO(toStr);
      (filter as Record<string, unknown>).date = dateFilter;
    }
    if (category && categories.includes(category as (typeof categories)[number])) {
      (filter as Record<string, unknown>).category = category;
    }

    const [expenses, totalResult] = await Promise.all([
      Expense.find(filter).populate("addedBy", "name").sort({ date: -1 }).lean(),
      Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    ]);
    const total = totalResult[0]?.total ?? 0;
    return NextResponse.json({ expenses, total });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

const postSchema = z.object({
  category: z.enum(categories),
  description: z.string().min(1),
  amount: z.number().min(0),
  date: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      ...body,
      amount: Number(body.amount),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const userId = (session!.user as { id?: string }).id;
    const expense = await Expense.create({
      ...parsed.data,
      date: new Date(parsed.data.date),
      addedBy: userId,
    });
    const populated = await Expense.findById(expense._id).populate("addedBy", "name").lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
