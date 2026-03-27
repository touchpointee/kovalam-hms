"use client";

import { PwaRegister } from "@/components/PwaRegister";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PwaRegister />
      {children}
      <Toaster position="top-right" />
    </SessionProvider>
  );
}
