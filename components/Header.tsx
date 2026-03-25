"use client";

import { signOut } from "next-auth/react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Role = "admin" | "doctor" | "pharmacy" | "frontdesk";

const roleBadgeClass: Record<Role, string> = {
  admin: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  doctor: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  pharmacy: "bg-green-500/15 text-green-700 dark:text-green-300",
  frontdesk: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
};

export function Header({
  name,
  role,
}: {
  name: string;
  role: Role;
}) {
  return (
    <header className="flex h-14 items-center justify-between nm-flat px-4" style={{ borderRadius: 0 }}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{name}</span>
        <Badge className={cn("text-xs", roleBadgeClass[role] ?? "bg-muted")}>
          {role}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">{format(new Date(), "dd MMM yyyy")}</span>
        <Button variant="ghost" size="sm" className="no-print" onClick={() => signOut({ callbackUrl: "/login" })}>
          Logout
        </Button>
      </div>
    </header>
  );
}
