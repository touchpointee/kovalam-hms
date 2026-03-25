"use client";

import { useSession } from "next-auth/react";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

type Role = "admin" | "doctor" | "pharmacy" | "frontdesk";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  const role = (session?.user as { role?: Role })?.role as Role | undefined;
  const name = session?.user?.name ?? "";
  if (!role) {
    return null;
  }
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--nm-bg)" }}>
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header name={name} role={role} />
        <main className="flex-1 overflow-auto p-4" style={{ background: "var(--nm-bg)" }}>{children}</main>
      </div>
    </div>
  );
}
