"use client";

import { signOut } from "next-auth/react";
import { format } from "date-fns";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = "admin" | "doctor" | "pharmacy" | "frontdesk";

const roleBadgeClass: Record<Role, string> = {
  admin: "bg-blue-100 text-blue-800",
  doctor: "bg-red-100 text-red-700",
  pharmacy: "bg-blue-50 text-blue-700",
  frontdesk: "bg-red-50 text-red-700",
};

export function Header({
  name,
  role,
  onOpenMobileNav,
}: {
  name: string;
  role: Role;
  onOpenMobileNav?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/95 px-4 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="no-print md:hidden"
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
          <Badge className={cn("text-xs capitalize", roleBadgeClass[role] ?? "bg-blue-100")}>{role}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">
            {format(new Date(), "dd MMM yyyy")}
          </span>
          <Button
            variant="default"
            size="sm"
            className="no-print bg-blue-800 hover:bg-blue-900"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
