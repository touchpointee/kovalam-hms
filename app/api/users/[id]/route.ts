import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/mongoose";
import { requireAuth, requireRole } from "@/lib/api-auth";
import User from "@/models/User";
import mongoose from "mongoose";
import { withRouteLog } from "@/lib/with-route-log";

const putSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "doctor", "pharmacy", "frontdesk", "laboratory"]).optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(6).optional(),
});

export const PUT = withRouteLog("users.id.PUT", async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    await dbConnect();
    const { session, error } = await requireAuth();
    if (error) return error;
    const forbidden = requireRole(session!, ["admin"]);
    if (forbidden) return forbidden;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    }
    const body = await req.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Validation failed" }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.email !== undefined) {
      const normalizedEmail = parsed.data.email.toLowerCase();
      const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: id } })
        .select("_id")
        .lean();
      if (existingUser) {
        return NextResponse.json({ message: "Email already in use" }, { status: 400 });
      }
      update.email = normalizedEmail;
    }
    if (parsed.data.role !== undefined) update.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) update.isActive = parsed.data.isActive;
    if (parsed.data.newPassword) {
      update.password = await bcrypt.hash(parsed.data.newPassword, 10);
    }
    const user = await User.findByIdAndUpdate(id, { $set: update }, { new: true })
      .select("-password")
      .lean();
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
});
