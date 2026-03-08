import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import Procedure from "@/models/Procedure";
import ProcedureBill from "@/models/ProcedureBill";

const itemSchema = z.object({
  procedureId: z.string().min(1),
  quantity: z.number().int().min(1),
});

const postSchema = z.object({
  patientId: z.string().min(1),
  visitId: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["frontdesk", "admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      ...body,
      items: (body.items ?? []).map((i: { procedureId: string; quantity: number }) => ({
        procedureId: i.procedureId,
        quantity: typeof i.quantity === "number" ? i.quantity : parseInt(String(i.quantity), 10),
      })),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const itemsWithDetails = await Promise.all(
      parsed.data.items.map(async (item) => {
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
    const grandTotal = itemsWithDetails.reduce((sum, i) => sum + i.totalPrice, 0);
    const userId = (session!.user as { id?: string }).id;

    const bill = await ProcedureBill.create({
      patient: parsed.data.patientId,
      visit: parsed.data.visitId || undefined,
      items: itemsWithDetails,
      grandTotal,
      billedBy: userId,
    });
    const populated = await ProcedureBill.findById(bill._id)
      .populate("patient", "name regNo age gender phone")
      .populate("visit", "visitDate receiptNo opCharge")
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
