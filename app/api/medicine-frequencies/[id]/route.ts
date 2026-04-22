import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import MedicineFrequency from "@/models/MedicineFrequency";
import { withRouteLog } from "@/lib/with-route-log";
import { inferDosesPerDayFromFrequencyName } from "@/lib/medicine-frequency";

const schema = z.object({
  name: z.string().min(1).optional(),
  dosesPerDay: z.coerce.number().positive().max(24).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withRouteLog("medicineFrequencies.id.PUT", async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "pharmacy"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name.trim();
    if (parsed.data.dosesPerDay !== undefined) {
      update.dosesPerDay = parsed.data.dosesPerDay;
    } else if (parsed.data.name !== undefined) {
      const inferred = inferDosesPerDayFromFrequencyName(parsed.data.name.trim());
      if (inferred) update.dosesPerDay = inferred;
    }
    if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;

    const row = await MedicineFrequency.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!row) return NextResponse.json({ message: "Frequency not found" }, { status: 404 });
    return NextResponse.json(row);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
});
