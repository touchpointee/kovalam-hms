import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireRole } from "@/lib/api-auth";
import StockTransaction from "@/models/StockTransaction";
import { withRouteLog } from "@/lib/with-route-log";

export const GET = withRouteLog("stock.transactions.GET", async (req: NextRequest) => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const forbidden = requireRole(session, ["admin", "pharmacy"]);
    if (forbidden) return forbidden;

    const medicineId = req.nextUrl.searchParams.get("medicineId");
    const medicineStockId = req.nextUrl.searchParams.get("medicineStockId");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    const query: Record<string, unknown> = {};
    if (medicineId) query.medicine = medicineId;
    if (medicineStockId) query.medicineStock = medicineStockId;
    if (from || to) {
      query.createdAt = {};
      if (from) (query.createdAt as Record<string, unknown>).$gte = new Date(from);
      if (to) (query.createdAt as Record<string, unknown>).$lte = new Date(to);
    }

    const rows = await StockTransaction.find(query)
      .sort({ createdAt: -1 })
      .populate("medicine", "name")
      .populate("performedBy", "name")
      .lean();
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
