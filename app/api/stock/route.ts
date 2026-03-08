import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import MedicineStock from "@/models/MedicineStock";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const medicineId = req.nextUrl.searchParams.get("medicineId");
    if (!medicineId) {
      return NextResponse.json({ message: "medicineId is required" }, { status: 400 });
    }
    const batches = await MedicineStock.find({ medicine: medicineId })
      .sort({ expiryDate: 1 })
      .populate("medicine", "name unit")
      .populate("addedBy", "name")
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

const postSchema = z.object({
  medicineId: z.string().min(1),
  batchNo: z.string().min(1),
  expiryDate: z.string().min(1),
  mrp: z.number().min(0),
  sellingPrice: z.number().min(0),
  quantityIn: z.number().int().min(1),
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["pharmacy", "admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      ...body,
      mrp: Number(body.mrp),
      sellingPrice: Number(body.sellingPrice),
      quantityIn: parseInt(String(body.quantityIn), 10),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const userId = (session!.user as { id?: string }).id;
    const stock = await MedicineStock.create({
      medicine: parsed.data.medicineId,
      batchNo: parsed.data.batchNo,
      expiryDate: new Date(parsed.data.expiryDate),
      mrp: parsed.data.mrp,
      sellingPrice: parsed.data.sellingPrice,
      quantityIn: parsed.data.quantityIn,
      quantityOut: 0,
      currentStock: parsed.data.quantityIn,
      addedBy: userId,
    });
    const populated = await MedicineStock.findById(stock._id)
      .populate("medicine", "name unit")
      .populate("addedBy", "name")
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
