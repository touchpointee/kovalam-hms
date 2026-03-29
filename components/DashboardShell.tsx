"use client";

import * as React from "react";
import { useSession } from "next-auth/react";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

type Role = "admin" | "doctor" | "pharmacy" | "frontdesk" | "laboratory";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-b-2 border-blue-800" />
          <p className="mt-4 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  const role = (session?.user as { role?: Role })?.role as Role | undefined;
  const name = session?.user?.name ?? "";
  if (!role) {
    return null;
  }
  return (
    <div className="dashboard-shell-root min-h-screen bg-blue-50/40">
      <div className="flex min-h-screen overflow-hidden">
        <Sidebar
          role={role}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pl-64">
          <Header
            name={name}
            role={role}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <main className="flex-1 overflow-auto bg-transparent px-4 py-6 sm:px-6 lg:px-8">
          <div className="dashboard-content mx-auto w-full max-w-7xl rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            {children}
          </div>
          </main>
        </div>
      </div>
    </div>
  );
}
