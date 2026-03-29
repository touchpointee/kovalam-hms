"use client";

import Image from "next/image";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";
const hospitalEmail =
  process.env.NEXT_PUBLIC_HOSPITAL_EMAIL ?? "doctorsmedicalcenter24@gmail.com";

export function PrintLayout({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="print-container bill-print-root">
      {actions ? <div className="no-print mb-4">{actions}</div> : null}

      <div
        id="report-content"
        className="relative mx-auto w-full max-w-[297mm] overflow-hidden border border-slate-200 bg-white px-4 pb-28 pt-3 shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Image
            src="/hospital-logo.png"
            alt=""
            width={280}
            height={280}
            className="opacity-[0.08] object-contain"
          />
        </div>

        <div className="print-letterhead-header mx-auto max-w-full pt-1 text-center">
          <div className="flex items-start justify-between gap-1">
            <div className="pt-1">
              <Image
                src="/delma-logo.svg"
                alt="Delma"
                width={64}
                height={34}
                className="object-contain"
              />
            </div>

            <div className="min-w-0 flex-1 px-2">
              <p className="font-serif text-[22px] font-bold uppercase leading-tight tracking-wide sm:text-[26px]">
                <span className="text-[#a61f28]">Doctor&apos;s</span>{" "}
                <span className="text-[#263f86]">Medical Center</span>
              </p>
              <div className="mt-1 text-[9px] leading-tight text-slate-800 sm:text-[10px]">
                <p>(TC 58/2993/1, PARAVILA, PACHALLOOR P.O, THIRUVANANTHAPURAM)</p>
                <p>PH: 0471-3170428, 8089056433</p>
              </div>
            </div>

            <div className="pt-0.5">
              <Image
                src="/hospital-logo.png"
                alt={hospitalName}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="print-letterhead-body relative z-10 mx-auto mt-6 max-w-full">{children}</div>

        <div className="print-letterhead-footer absolute inset-x-4 bottom-3 z-10 pb-0">
          <div className="print-letterhead-footer-inner mx-auto max-w-full text-center">
            <div className="print-letterhead-bluebar mx-auto flex h-[16px] max-w-full items-center justify-center bg-[#263f86] px-2 text-[9px] font-semibold uppercase tracking-[0.35em] text-white sm:text-[10px] sm:tracking-[0.45em]">
              Your Health Our Priority
            </div>
            <div className="print-letterhead-redbar mx-auto mt-2 max-w-full bg-[#a61f28] px-2 py-0.5 text-[8px] font-semibold uppercase leading-snug tracking-[0.12em] text-white sm:text-[9px]">
              Working Hours : 7:00 AM to 8:00 PM | Sundays : 7:00 AM to 2:00 PM
            </div>
            <p className="mt-2 text-[8px] font-medium text-slate-700 sm:text-[9px]">
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
