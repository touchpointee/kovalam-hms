import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import User from "@/models/User";
import { withRouteLog } from "@/lib/with-route-log";

const postSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "doctor", "pharmacy", "frontdesk", "laboratory"]),
});

export const GET = withRouteLog("users.GET", async () => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const users = await User.find({}).select("-password").sort({ createdAt: -1 }).lean();
    return NextResponse.json(users);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});

export const POST = withRouteLog("users.POST", async (req: NextRequest) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const isDoctorOnly = parsed.data.role === "doctor";
    const forbidden = isDoctorOnly
      ? requireRole(session!, ["admin", "frontdesk"])
      : requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;
    const hashed = await bcrypt.hash(parsed.data.password, 10);
    const user = await User.create({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      password: hashed,
      role: parsed.data.role,
    });
    const u = user.toJSON() as Record<string, unknown>;
    delete u.password;
    return NextResponse.json(u);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
