"use client";

import { ClientErrorReporter } from "@/components/ClientErrorReporter";
import { PwaRegister } from "@/components/PwaRegister";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PwaRegister />
      <ClientErrorReporter />
      {children}
      <Toaster position="top-right" />
    </SessionProvider>
  );
}
