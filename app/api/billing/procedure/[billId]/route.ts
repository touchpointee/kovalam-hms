import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireRole } from "@/lib/api-auth";
import ProcedureBill from "@/models/ProcedureBill";
import mongoose from "mongoose";
import Procedure from "@/models/Procedure";

const itemSchema = z.object({
  procedureId: z.string().min(1),
  quantity: z.number().int().min(1),
});

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
    const bill = await ProcedureBill.findById(billId)
      .populate("patient")
      .populate("visit")
      .populate("billedBy", "name")
      .populate("items.procedure")
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const forbidden = requireRole(session, ["admin"]);
    if (forbidden) return forbidden;

    const { billId } = await params;
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsedItems = z.array(itemSchema).min(1).safeParse(
      (body.items ?? []).map((item: { procedureId: string; quantity: number }) => ({
        procedureId: item.procedureId,
        quantity: typeof item.quantity === "number" ? item.quantity : parseInt(String(item.quantity), 10),
      }))
    );
    if (!parsedItems.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const bill = await ProcedureBill.findById(billId);
    if (!bill) return NextResponse.json({ message: "Bill not found" }, { status: 404 });

    const itemsWithDetails = await Promise.all(
      parsedItems.data.map(async (item) => {
        const proc = await Procedure.findById(item.procedureId).lean() as { name: string; price: number } | null;
        if (!proc) throw new Error(`Procedure ${item.procedureId} not found`);
        const unitPrice = proc.price;
        const totalPrice = unitPrice * item.quantity;
        return {
          procedure: item.procedureId,
          procedureName: proc.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        };
      })
    );
    const grandTotal = itemsWithDetails.reduce((sum, item) => sum + item.totalPrice, 0);
    bill.items = itemsWithDetails;
    bill.grandTotal = grandTotal;
    bill.billedAt = new Date();
    bill.billedBy = (session.user as { id?: string }).id;
    await bill.save();

    const populated = await ProcedureBill.findById(bill._id)
      .populate("patient", "name regNo age gender phone")
      .populate("visit", "visitDate receiptNo opCharge")
      .populate("billedBy", "name")
      .populate("items.procedure")
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
