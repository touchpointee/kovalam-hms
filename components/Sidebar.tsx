"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UserPlus,
  ClipboardList,
  CreditCard,
  Users,
  Stethoscope,
  Pill,
  Package,
  ShoppingCart,
  Receipt,
  Settings,
  BarChart3,
  LogOut,
} from "lucide-react";

type Role = "admin" | "doctor" | "pharmacy" | "frontdesk";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";

const linksByRole: Record<Role, { href: string; label: string; icon: React.ReactNode }[]> = {
  frontdesk: [
    { href: "/frontdesk/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/frontdesk/register", label: "Register Patient", icon: <UserPlus className="h-4 w-4" /> },
    { href: "/frontdesk/visit", label: "New Visit", icon: <ClipboardList className="h-4 w-4" /> },
    { href: "/frontdesk/billing/procedure", label: "Procedure Billing", icon: <CreditCard className="h-4 w-4" /> },
  ],
  doctor: [
    { href: "/doctor/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/doctor/patients", label: "Patients", icon: <Users className="h-4 w-4" /> },
  ],
  pharmacy: [
    { href: "/pharmacy/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/pharmacy/medicines", label: "Medicines", icon: <Pill className="h-4 w-4" /> },
    { href: "/pharmacy/stock", label: "Stock", icon: <Package className="h-4 w-4" /> },
    { href: "/pharmacy/billing", label: "Medicine Billing", icon: <ShoppingCart className="h-4 w-4" /> },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/admin/patients", label: "Patients", icon: <Users className="h-4 w-4" /> },
    { href: "/admin/procedures", label: "Procedures", icon: <Stethoscope className="h-4 w-4" /> },
    { href: "/admin/expenses", label: "Expenses", icon: <Receipt className="h-4 w-4" /> },
    { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> },
    { href: "/admin/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
    { href: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  ],
};

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = linksByRole[role] ?? [];

  return (
    <aside
      className="flex h-full w-56 flex-col"
      style={{ backgroundColor: "#e8edf5" }}
    >
      {/* Hospital Name */}
      <div className="px-5 py-5">
        <p className="text-base font-bold text-slate-800">{hospitalName}</p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-0.5 px-3">
        {links.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}>
              <span
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors duration-150",
                  isActive
                    ? "font-semibold text-white bg-[#3d3566]"
                    : "font-normal hover:bg-white/60 hover:text-slate-700"
                )}
              >
                {icon}
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-normal transition-colors hover:bg-[#3d3566] hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
