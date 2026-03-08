import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireRole } from "@/lib/api-auth";
import MedicineStock from "@/models/MedicineStock";
import { addDays } from "date-fns";

export async function GET() {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const forbidden = requireRole(session!, ["admin", "pharmacy"]);
    if (forbidden) return forbidden;

    const today = new Date();
    const in30Days = addDays(today, 30);
    const batches = await MedicineStock.find({
      $or: [
        { currentStock: { $lt: 10 } },
        { expiryDate: { $lte: in30Days } },
      ],
    })
      .populate("medicine", "name unit")
      .sort({ expiryDate: 1 })
      .lean();
    return NextResponse.json(batches);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
