import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/mongoose";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { requireAuth, requireRole } from "@/lib/api-auth";
import Manufacturer from "@/models/Manufacturer";

const schema = z.object({
  name: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
    const search = (req.nextUrl.searchParams.get("search") ?? "").trim();
    const filter: Record<string, unknown> = includeInactive ? {} : { isActive: true };

    if (search) {
      filter.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }

    const rows = await Manufacturer.find(filter).sort({ name: 1 }).lean();
    return NextResponse.json(rows);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin", "pharmacy"]);
    if (forbidden) return forbidden;

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const name = parsed.data.name.trim();
    const existing = await Manufacturer.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();
    if (existing) {
      return NextResponse.json({ message: "Manufacturer already exists" }, { status: 400 });
    }

    const row = await Manufacturer.create({ name });
    return NextResponse.json(row.toJSON());
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
