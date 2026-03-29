import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import PaymentMethod from "@/models/PaymentMethod";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";

export const GET = withRouteLog("paymentMethods.GET", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;

    const billing = req.nextUrl.searchParams.get("billing") === "1";
    if (billing) {
      const list = await PaymentMethod.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      return NextResponse.json(list);
    }

    const forbidden = requireRole(session!, ["admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const list = await PaymentMethod.find({}).sort({ sortOrder: 1, name: 1 }).lean();
    return NextResponse.json(list);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

const postSchema = z.object({
  name: z.string().min(1).trim(),
  code: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const POST = withRouteLog("paymentMethods.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "frontdesk"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const doc = await PaymentMethod.create({
      name: parsed.data.name,
      code: parsed.data.code || undefined,
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    });
    return NextResponse.json(doc.toObject());
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: number }).code === 11000) {
      return NextResponse.json({ message: "A payment method with this name already exists" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
