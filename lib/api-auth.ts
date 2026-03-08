import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

const ROLES = ["admin", "doctor", "pharmacy", "frontdesk"] as const;
export type Role = (typeof ROLES)[number];

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

export function requireRole(
  session: { user?: { role?: string } } | null,
  allowed: Role[]
): NextResponse | null {
  const role = session?.user?.role as Role | undefined;
  if (!role || !allowed.includes(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return null;
}
