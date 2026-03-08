import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import OPVisit from "@/models/OPVisit";
import ProcedureBill from "@/models/ProcedureBill";
import MedicineBill from "@/models/MedicineBill";
import Expense from "@/models/Expense";
import { parseISO, startOfDay, endOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    if (!fromStr || !toStr) {
      return NextResponse.json({ message: "from and to (ISO date) required" }, { status: 400 });
    }
    const from = startOfDay(parseISO(fromStr));
    const to = endOfDay(parseISO(toStr));

    const dateFilter = { $gte: from, $lte: to };

    const [opVisits, procedureBills, medicineBills, expenses] = await Promise.all([
      OPVisit.find({ visitDate: dateFilter, paid: true })
        .populate("patient", "name regNo")
        .sort({ visitDate: 1 })
        .lean(),
      ProcedureBill.find({ billedAt: dateFilter })
        .populate("patient", "name regNo")
        .populate("items.procedure", "name")
        .sort({ billedAt: 1 })
        .lean(),
      MedicineBill.find({ billedAt: dateFilter })
        .populate("patient", "name regNo")
        .sort({ billedAt: 1 })
        .lean(),
      Expense.find({ date: dateFilter }).populate("addedBy", "name").sort({ date: 1 }).lean(),
    ]);

    const opSummary = {
      count: opVisits.length,
      totalAmount: opVisits.reduce((s, v) => s + (v.opCharge ?? 0), 0),
    };
    const procedureSummary = {
      count: procedureBills.length,
      totalAmount: procedureBills.reduce((s, b) => s + (b.grandTotal ?? 0), 0),
    };
    const medicineSummary = {
      count: medicineBills.length,
      totalAmount: medicineBills.reduce((s, b) => s + (b.grandTotal ?? 0), 0),
    };
    const expenseTotal = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
    const byCategory = Array.from(
      expenses.reduce((acc, e) => {
        const c = (e.category as string) ?? "other";
        acc.set(c, (acc.get(c) ?? 0) + (e.amount ?? 0));
        return acc;
      }, new Map<string, number>()).entries()
    ).map(([category, amount]) => ({ category, amount }));
    const expenseSummary = { total: expenseTotal, byCategory };
    const netRevenue =
      opSummary.totalAmount + procedureSummary.totalAmount + medicineSummary.totalAmount - expenseTotal;

    return NextResponse.json({
      opSummary,
      procedureSummary,
      medicineSummary,
      expenseSummary,
      netRevenue,
      opVisits,
      procedureBills,
      medicineBills,
      expenses,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
