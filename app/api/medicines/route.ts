import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Medicine from "@/models/Medicine";
import { withRouteLog } from "@/lib/with-route-log";

export const GET = withRouteLog("medicines.GET", async (req: NextRequest) => {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const filter: Record<string, unknown> = { isActive: true };
    if (search.trim()) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      (filter as Record<string, unknown>).$or = [{ name: re }, { genericName: re }];
    }
    const medicines = await Medicine.find(filter).sort({ name: 1 }).lean();
    return NextResponse.json(medicines);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

const postSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  category: z.string().optional(),
  group: z.string().optional(),
  manufacturer: z.string().optional(),
  unit: z.string().optional(),
  minQuantity: z.number().int().min(0).optional(),
  maxQuantity: z.number().int().min(0).optional(),
});

export const POST = withRouteLog("medicines.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "pharmacy"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse({
      ...body,
      minQuantity: body.minQuantity === "" || body.minQuantity === undefined ? undefined : parseInt(String(body.minQuantity), 10),
      maxQuantity: body.maxQuantity === "" || body.maxQuantity === undefined ? undefined : parseInt(String(body.maxQuantity), 10),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }
    const medicine = await Medicine.create({
      ...parsed.data,
      category: parsed.data.category || "",
      group: parsed.data.group || "",
      unit: parsed.data.unit || "unit",
      minQuantity: parsed.data.minQuantity ?? 10,
      maxQuantity: parsed.data.maxQuantity ?? 0,
    });
    return NextResponse.json(medicine.toJSON());
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
