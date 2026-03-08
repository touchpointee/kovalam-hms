import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import MedicineStock from "@/models/MedicineStock";
import MedicineBill from "@/models/MedicineBill";

const itemSchema = z.object({
  medicineStockId: z.string().min(1),
  quantity: z.number().int().min(1),
  sellingPrice: z.number().min(0),
});

const postSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  prescriptionId: z.string().optional(),
  items: z.array(itemSchema).min(1),
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
      items: (body.items ?? []).map((i: { medicineStockId: string; quantity: number; sellingPrice: number }) => ({
        medicineStockId: i.medicineStockId,
        quantity: typeof i.quantity === "number" ? i.quantity : parseInt(String(i.quantity), 10),
        sellingPrice: Number(i.sellingPrice),
      })),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const userId = (session!.user as { id?: string }).id;
    const billItems: Array<{
      medicineStock: string;
      medicineName: string;
      batchNo: string;
      expiryDate: Date;
      quantity: number;
      mrp: number;
      sellingPrice: number;
      totalPrice: number;
    }> = [];
    for (const item of parsed.data.items) {
      const stock = await MedicineStock.findById(item.medicineStockId);
      if (!stock) {
        return NextResponse.json({ message: `Stock ${item.medicineStockId} not found` }, { status: 400 });
      }
      if (stock.currentStock < item.quantity) {
        return NextResponse.json(
          { message: `Insufficient stock for batch ${stock.batchNo}. Available: ${stock.currentStock}` },
          { status: 400 }
        );
      }
      const medicine = await import("@/models/Medicine").then((m) => m.default.findById(stock.medicine).select("name").lean() as { name?: string } | null);
      billItems.push({
        medicineStock: item.medicineStockId,
        medicineName: medicine?.name ?? "Unknown",
        batchNo: stock.batchNo,
        expiryDate: stock.expiryDate,
        quantity: item.quantity,
        mrp: stock.mrp,
        sellingPrice: item.sellingPrice,
        totalPrice: item.sellingPrice * item.quantity,
      });
    }

    for (const item of parsed.data.items) {
      await MedicineStock.findByIdAndUpdate(item.medicineStockId, {
        $inc: { quantityOut: item.quantity, currentStock: -item.quantity },
        $set: { updatedAt: new Date() },
      });
    }

    const grandTotal = billItems.reduce((sum, i) => sum + i.totalPrice, 0);
    const bill = await MedicineBill.create({
      patient: parsed.data.patientId,
      visit: parsed.data.visitId || undefined,
      prescription: parsed.data.prescriptionId || undefined,
      items: billItems,
      grandTotal,
      billedBy: userId,
    });
    const populated = await MedicineBill.findById(bill._id)
      .populate("patient", "name regNo age gender phone")
      .populate("visit", "visitDate receiptNo")
      .populate("prescription")
      .populate("billedBy", "name")
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
