"use client";

import { format } from "date-fns";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";
const hospitalAddress = process.env.NEXT_PUBLIC_HOSPITAL_ADDRESS ?? "";
const hospitalPhone = process.env.NEXT_PUBLIC_HOSPITAL_PHONE ?? "";

export function PrintLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="print-container">
      <div className="print-only mb-4 hidden border-b pb-2 text-center">
        <p className="font-semibold">{hospitalName}</p>
        {hospitalAddress && <p className="text-muted-foreground text-sm">{hospitalAddress}</p>}
        {hospitalPhone && <p className="text-muted-foreground text-sm">{hospitalPhone}</p>}
        <p className="mt-2 font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">Date & Time: {format(new Date(), "dd MMM yyyy, HH:mm")}</p>
      </div>
      <div className="no-print mb-4">
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
      <div>{children}</div>
    </div>
  );
}
