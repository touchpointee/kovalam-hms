"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UserPlus,
  ClipboardList,
  Users,
  Stethoscope,
  Pill,
  Package,
  Factory,
  Tags,
  Truck,
  ShoppingCart,
  CreditCard,
  Receipt,
  Settings,
  BarChart3,
  LogOut,
  CalendarDays,
} from "lucide-react";

type Role = "admin" | "doctor" | "pharmacy" | "frontdesk";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";

const linksByRole: Record<Role, { href: string; label: string; icon: React.ReactNode }[]> = {
  frontdesk: [
    { href: "/frontdesk/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/frontdesk/register", label: "Register Patient", icon: <UserPlus className="h-4 w-4" /> },
    { href: "/frontdesk/visit", label: "New Visit", icon: <ClipboardList className="h-4 w-4" /> },
    { href: "/frontdesk/procedure-billing", label: "Procedure Billing", icon: <CreditCard className="h-4 w-4" /> },
    { href: "/frontdesk/expenses", label: "Expenses", icon: <Receipt className="h-4 w-4" /> },
  ],
  doctor: [
    { href: "/doctor/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/doctor/patients", label: "Patients", icon: <Users className="h-4 w-4" /> },
  ],
  pharmacy: [
    { href: "/pharmacy/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/pharmacy/medicines", label: "Medicines", icon: <Pill className="h-4 w-4" /> },
    { href: "/pharmacy/medicine-categories", label: "Categories", icon: <Tags className="h-4 w-4" /> },
    { href: "/pharmacy/manufacturers", label: "Manufacturers", icon: <Factory className="h-4 w-4" /> },
    { href: "/pharmacy/suppliers", label: "Suppliers", icon: <Truck className="h-4 w-4" /> },
    { href: "/pharmacy/stock", label: "Stock", icon: <Package className="h-4 w-4" /> },
    { href: "/pharmacy/billing", label: "Medicine Billing", icon: <ShoppingCart className="h-4 w-4" /> },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: "/admin/visits", label: "OP visit", icon: <CalendarDays className="h-4 w-4" /> },
    { href: "/admin/patients", label: "Patients", icon: <Users className="h-4 w-4" /> },
    { href: "/admin/procedures", label: "Procedures", icon: <Stethoscope className="h-4 w-4" /> },
    { href: "/admin/pharmacy/medicines", label: "Medicines", icon: <Pill className="h-4 w-4" /> },
    { href: "/admin/pharmacy/medicine-categories", label: "Medicine Categories", icon: <Tags className="h-4 w-4" /> },
    { href: "/admin/pharmacy/manufacturers", label: "Manufacturers", icon: <Factory className="h-4 w-4" /> },
    { href: "/admin/pharmacy/suppliers", label: "Suppliers", icon: <Truck className="h-4 w-4" /> },
    { href: "/admin/pharmacy/stock", label: "Stock Management", icon: <Package className="h-4 w-4" /> },
    { href: "/admin/expenses", label: "Expenses", icon: <Receipt className="h-4 w-4" /> },
    { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> },
    { href: "/admin/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
    { href: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  ],
};

export function Sidebar({
  role,
  mobileOpen = false,
  onMobileClose,
}: {
  role: Role;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const links = linksByRole[role] ?? [];

  return (
    <>
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onMobileClose}
        className={cn(
          "no-print fixed inset-0 z-40 bg-black/30 transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-blue-100 bg-blue-50/40 md:fixed md:top-0 md:h-screen md:w-64",
          "transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Hospital Name */}
        <div className="border-b border-blue-100 px-5 py-5">
          <div className="rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <Image
                src="/hospital-logo.png"
                alt={hospitalName}
                width={36}
                height={36}
                className="rounded-full border border-white/40 bg-white object-cover"
              />
              <p className="text-base font-bold leading-tight">{hospitalName}</p>
            </div>
            <p className="mt-0.5 text-xs text-blue-100">Hospital Management System</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {links.map(({ href, label, icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} onClick={onMobileClose}>
                <span
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                    isActive
                      ? "bg-blue-800 text-white shadow-sm"
                      : "text-slate-700 hover:bg-blue-100/70"
                  )}
                >
                  <span className={cn("text-slate-500", isActive && "text-white")}>
                    {icon}
                  </span>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-blue-100 px-4 py-4">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-800 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-900"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
