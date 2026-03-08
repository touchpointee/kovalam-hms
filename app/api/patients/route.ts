import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole, type Role } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Patient from "@/models/Patient";
import { generateRegNo } from "@/lib/counters";

const createSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().min(1),
  address: z.string().optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"])
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (search.trim()) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: re },
        { phone: re },
        { regNo: re },
      ];
    }

    const [patients, total] = await Promise.all([
      Patient.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Patient.countDocuments(filter),
    ]);

    return NextResponse.json({
      patients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "doctor", "pharmacy", "frontdesk"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = createSchema.safeParse({
      ...body,
      age: typeof body.age === "string" ? parseInt(body.age, 10) : body.age,
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const regNo = await generateRegNo();
    const patient = await Patient.create({ ...parsed.data, regNo });
    return NextResponse.json(patient.toJSON());
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
