import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import MedicineBill from "@/models/MedicineBill";
import mongoose from "mongoose";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { billId } = await params;
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const bill = await MedicineBill.findById(billId)
      .populate("patient")
      .populate("visit")
      .populate("prescription")
      .populate("billedBy", "name")
      .populate("items.medicineStock")
      .lean();
    if (!bill) return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    return NextResponse.json(bill);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
