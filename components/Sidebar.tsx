"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    <aside className="flex h-full w-56 flex-col border-r bg-muted/30">
      <div className="border-b p-4">
        <p className="font-semibold text-foreground">{hospitalName}</p>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {links.map(({ href, label, icon }) => (
          <Link key={href} href={href}>
            <Button
              variant={pathname === href ? "secondary" : "ghost"}
              className={cn("w-full justify-start", pathname === href && "bg-muted")}
            >
              {icon}
              {label}
            </Button>
          </Link>
        ))}
      </nav>
      <div className="border-t p-2">
        <Button variant="ghost" className="w-full justify-start" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
