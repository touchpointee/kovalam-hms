"use client";

import Image from "next/image";
import { format } from "date-fns";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";
const hospitalAddress = process.env.NEXT_PUBLIC_HOSPITAL_ADDRESS ?? "";
const hospitalPhone = process.env.NEXT_PUBLIC_HOSPITAL_PHONE ?? "";
const hospitalEmail = process.env.NEXT_PUBLIC_HOSPITAL_EMAIL ?? "";

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
    <div className="print-container">
      {actions ? <div className="no-print mb-4">{actions}</div> : null}

      <div
        id="report-content"
        className="relative mx-auto min-h-[1122px] w-full max-w-[794px] overflow-hidden border border-slate-200 bg-white px-8 pb-44 pt-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Image
            src="/hospital-logo.png"
            alt=""
            width={520}
            height={520}
            className="opacity-[0.08] object-contain"
          />
        </div>

        <div className="print-letterhead-header mx-auto max-w-3xl pt-2 text-center">
          <div className="flex items-start justify-between">
            <div className="pt-4">
              <Image
                src="/delma-logo.svg"
                alt="Delma"
                width={108}
                height={58}
                className="object-contain"
              />
            </div>

            <div className="flex-1 px-6">
              <p className="font-serif text-[56px] font-bold uppercase leading-none tracking-wide text-[#a61f28]">
                Doctor&apos;s
              </p>
              <p className="-mt-1 text-[34px] font-extrabold uppercase leading-none tracking-[0.08em] text-[#263f86]">
                Medical Center
              </p>
              <div className="mt-2 text-[13px] leading-tight text-slate-800">
                <p>(TC 58/2993/1, PARAVILA, PACHALLOOR P.O, THIRUVANANTHAPURAM)</p>
                <p>PH: 0471-3170428, 8089056433</p>
              </div>
            </div>

            <div className="pt-2">
              <Image
                src="/hospital-logo.png"
                alt={hospitalName}
                width={58}
                height={58}
                className="rounded-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="print-letterhead-body relative z-10 mx-auto mt-14 max-w-3xl">{children}</div>

        <div className="print-letterhead-footer absolute inset-x-8 bottom-6 z-10 pb-0">
          <div className="print-letterhead-footer-inner mx-auto max-w-3xl text-center">
            <div className="print-letterhead-bluebar mx-auto flex h-[20px] max-w-[620px] items-center justify-center bg-[#263f86] px-3 text-[12px] font-semibold uppercase tracking-[0.5em] text-white">
              Your Health Our Priority
            </div>
            <div className="print-letterhead-redbar mx-auto mt-4 max-w-[690px] bg-[#a61f28] px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.22em] text-white">
              Working Hours : 7:00 AM to 8:00 PM | Sundays : 7:00 AM to 2:00 PM
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
