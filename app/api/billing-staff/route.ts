import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import BillingStaff from "@/models/BillingStaff";
import { withRouteLog } from "@/lib/with-route-log";
import { ensureBillingStaffSeeded } from "@/lib/billing-staff";

export const GET = withRouteLog("billingStaff.GET", async (req: NextRequest) => {
  try {
    await dbConnect();
    await ensureBillingStaffSeeded();
    const { session, error } = await requireAuth();
    if (error) return error;

    const billing = req.nextUrl.searchParams.get("billing") === "1";
    const query = billing ? { isActive: true } : {};

    if (!billing) {
      const forbidden = requireRole(session!, ["admin"]);
      if (forbidden) return forbidden;
    }

    const rows = await BillingStaff.find(query).sort({ sortOrder: 1, name: 1 }).lean();
    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        label: row.code?.trim() ? `${row.name} ${row.code.trim()}` : row.name,
      }))
    );
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

export const POST = withRouteLog("billingStaff.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const doc = await BillingStaff.create({
      name: parsed.data.name,
      code: parsed.data.code || undefined,
      isActive: parsed.data.isActive ?? true,
      sortOrder: parsed.data.sortOrder ?? 0,
    });

    const row = doc.toObject() as { name: string; code?: string };
    return NextResponse.json({
      ...row,
      label: row.code?.trim() ? `${row.name} ${row.code.trim()}` : row.name,
    });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: number }).code === 11000) {
      return NextResponse.json({ message: "A staff entry with this name and code already exists" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
