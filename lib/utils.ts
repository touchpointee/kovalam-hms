import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export function formatPaymentMethodLabel(pm: unknown): string {
  if (pm && typeof pm === "object" && pm !== null && "name" in pm) {
    const n = String((pm as { name: string }).name);
    const c = (pm as { code?: string }).code;
    return c ? `${n} (${c})` : n;
  }
  return "—";
}
