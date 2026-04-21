"use client";

import Image from "next/image";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";
const hospitalEmail =
  process.env.NEXT_PUBLIC_HOSPITAL_EMAIL ?? "doctorsmedicalcenter24@gmail.com";

export function PrintLayout({
  title,
  children,
  actions,
  paper = "landscape",
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  paper?: "landscape" | "portrait";
}) {
  const paperClass =
    paper === "portrait"
      ? "bill-paper-portrait max-w-[210mm]"
      : "bill-paper-landscape max-w-[297mm]";

  return (
    <div className="print-container bill-print-root">
      {actions ? <div className="no-print mb-4">{actions}</div> : null}

      <div
        id="report-content"
        className={`relative mx-auto w-full overflow-hidden border border-slate-200 bg-white px-2 pb-16 pt-2 shadow-[0_20px_60px_rgba(15,23,42,0.12)] ${paperClass}`}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Image src="/hospital-logo.png" alt="" width={180} height={180} className="opacity-[0.08] object-contain" />
        </div>

        <div className="print-letterhead-header mx-auto max-w-full pt-1 text-center">
          <div className="flex items-start justify-center gap-3">
            <div className="shrink-0 pt-1">
              <Image src="/delma-logo.svg" alt="Delma" width={84} height={45} className="object-contain" />
            </div>

            <div className="min-w-0 px-1">
              <p className="font-serif text-[22px] font-bold uppercase leading-tight tracking-wide sm:text-[26px]">
                <span className="text-[#a61f28]">Doctor&apos;s</span>{" "}
                <span className="text-[#263f86]">Medical Center</span>
              </p>
              <div className="mt-1 text-[11px] leading-tight text-slate-800 sm:text-[13px]">
                <p>(TC 58/2993/1, PARAVILA, PACHALLOOR P.O, THIRUVANANTHAPURAM)</p>
                <p>PH: 0471-3170428, 8089056433</p>
              </div>
            </div>

            <div className="shrink-0 pt-0.5">
              <Image src="/hospital-logo.png" alt={hospitalName} width={58} height={58} className="rounded-full object-cover" />
            </div>
          </div>
        </div>

        <div className="print-letterhead-body relative z-10 mx-auto mt-3 max-w-full">{children}</div>

        <div className="print-letterhead-footer absolute inset-x-2 bottom-1 z-10 pb-0">
          <div className="print-letterhead-footer-inner mx-auto max-w-full text-center">
            <div className="print-letterhead-bluebar mx-auto flex h-[18px] max-w-full items-center justify-center bg-[#263f86] px-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white sm:text-[13px] sm:tracking-[0.35em]">
              Your Health Our Priority
            </div>
            <div className="print-letterhead-redbar mx-auto mt-1.5 max-w-full bg-[#a61f28] px-2 py-0.5 text-[10px] font-semibold uppercase leading-snug tracking-[0.08em] text-white sm:text-[11px]">
              Working Hours : 7:00 AM to 8:00 PM | Sundays : 7:00 AM to 2:00 PM
            </div>
            <p className="mt-1.5 text-[12px] font-medium text-slate-700 sm:text-[14px]">
              <a href={`mailto:${hospitalEmail}`} className="underline-offset-2 print:text-slate-800 print:no-underline">
                {hospitalEmail}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BillSignature({
  staffName,
  label = "Authorized Signatory",
}: {
  staffName?: string | null;
  label?: string;
}) {
  const resolvedName = staffName?.trim() || "—";

  return (
    <div className="mt-8 text-[12px] text-slate-800">
      <p className="font-semibold text-slate-900">{label}:</p>
      <div className="mt-2.5 flex items-end justify-between gap-8">
        <div className="min-w-0">
          <span className="font-medium text-slate-700">Name:</span>{" "}
          <span className="text-slate-900">{resolvedName}</span>
        </div>
        <div className="flex min-w-[220px] items-end gap-2">
          <span className="whitespace-nowrap font-medium text-slate-700">Signature:</span>
          <div className="flex-1 border-b border-slate-500 pb-0.5" />
        </div>
      </div>
    </div>
  );
}
