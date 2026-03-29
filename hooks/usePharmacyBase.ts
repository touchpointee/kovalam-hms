"use client";

import { usePathname } from "next/navigation";

/** Base path for pharmacy admin UI: `/admin/pharmacy` when under admin, else `/pharmacy`. */
export function usePharmacyBase(): string {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/pharmacy")) return "/admin/pharmacy";
  return "/pharmacy";
}

/**
 * Prefix for medicine billing list and visit detail URLs.
 * - `/admin/pharmacy/billing/[visitId]`
 * - `/frontdesk/medicine-billing/[visitId]`
 * - `/pharmacy/billing/[visitId]`
 */
export function useMedicineBillingBase(): string {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/pharmacy")) return "/admin/pharmacy/billing";
  if (pathname.startsWith("/frontdesk/medicine-billing")) return "/frontdesk/medicine-billing";
  return "/pharmacy/billing";
}

/** Where "Back to visit list" should go from medicine billing detail. */
export function useMedicineBillingListHref(): string {
  const pathname = usePathname();
  if (pathname.startsWith("/admin/pharmacy")) return "/admin/visits";
  if (pathname.startsWith("/frontdesk/medicine-billing")) return "/frontdesk/medicine-billing";
  return "/pharmacy/billing";
}
