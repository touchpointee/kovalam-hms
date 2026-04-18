import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole, type Role } from "@/lib/api-auth";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Patient from "@/models/Patient";
import { generateLabRegNo, generateRegNo, generatePharmacyRegNo } from "@/lib/counters";
import { withRouteLog } from "@/lib/with-route-log";
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile";

const createSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0),
  gender: z.enum(["male", "female", "other"]),
  phone: z
    .string()
    .min(1)
    .transform((value) => normalizeMobileNumber(value))
    .refine((value) => isValidMobileNumber(value), "Enter a valid 10-digit mobile number"),
  address: z.string().optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"])
    .optional(),
  registrationType: z.enum(["op", "lab", "pharmacy"]).optional(),
});

export const GET = withRouteLog("patients.GET", async (req: NextRequest) => {
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

    const andFilters: Array<Record<string, unknown>> = [];
    if (search.trim()) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      andFilters.push({
        $or: [
          { name: re },
          { phone: re },
          { regNo: re },
        ],
      });
    }
    const registrationType = searchParams.get("registrationType");
    if (registrationType === "lab") {
      andFilters.push({
        $or: [
          { registrationType: "lab" },
          { regNo: new RegExp("^LAB\\d+$") },
        ],
      });
    } else if (registrationType === "pharmacy") {
      andFilters.push({
        $or: [
          { registrationType: "pharmacy" },
          { regNo: new RegExp("^PHRM\\d+$") },
        ],
      });
    } else if (registrationType === "op") {
      andFilters.push({
        $and: [
          {
            $or: [
              { registrationType: "op" },
              { registrationType: { $exists: false } },
            ],
          },
          { regNo: { $not: new RegExp("^(LAB|PHRM)\\d+$") } },
        ],
      });
    }
    const filter: Record<string, unknown> =
      andFilters.length === 0 ? {} : andFilters.length === 1 ? andFilters[0] : { $and: andFilters };

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
});

export const POST = withRouteLog("patients.POST", async (req: NextRequest) => {
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
      phone: normalizeMobileNumber(String(body.phone ?? "")),
    });
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed", errors: parsed.error.flatten() }, { status: 400 });
    }

    const registrationType = parsed.data.registrationType ?? "op";
    const regNo = registrationType === "lab" ? await generateLabRegNo() : registrationType === "pharmacy" ? await generatePharmacyRegNo() : await generateRegNo();
    const patient = await Patient.create({ ...parsed.data, registrationType, regNo });
    return NextResponse.json(patient.toJSON());
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
