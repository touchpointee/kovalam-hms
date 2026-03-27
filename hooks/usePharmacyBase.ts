"use client";

import { usePathname } from "next/navigation";

/** Base path for pharmacy UI: `/admin/pharmacy` when under admin, else `/pharmacy`. */
export function usePharmacyBase(): string {
  const pathname = usePathname();
  return pathname.startsWith("/admin/pharmacy") ? "/admin/pharmacy" : "/pharmacy";
}
