import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const roleDashboard: Record<string, string> = {
  admin: "/admin/dashboard",
  doctor: "/doctor/dashboard",
  pharmacy: "/pharmacy/dashboard",
  frontdesk: "/frontdesk/dashboard",
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role && roleDashboard[role]) {
    redirect(roleDashboard[role]);
  }
  redirect("/login");
}
