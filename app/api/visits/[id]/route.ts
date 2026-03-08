import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import OPVisit from "@/models/OPVisit";
import ProcedureBill from "@/models/ProcedureBill";
import MedicineBill from "@/models/MedicineBill";
import mongoose from "mongoose";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const visit = await OPVisit.findById(id)
      .populate("patient")
      .populate("collectedBy", "name")
      .lean();
    if (!visit) return NextResponse.json({ message: "Visit not found" }, { status: 404 });

    const [procedureBills, medicineBills] = await Promise.all([
      ProcedureBill.find({ visit: id }).populate("billedBy", "name").populate("items.procedure").lean(),
      MedicineBill.find({ visit: id }).populate("prescription billedBy", "name").lean(),
    ]);

    return NextResponse.json({
      ...visit,
      procedureBills,
      medicineBills,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
