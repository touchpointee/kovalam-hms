"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";
const hospitalEmail =
  process.env.NEXT_PUBLIC_HOSPITAL_EMAIL ?? "doctorsmedicalcenter24@gmail.com";

type PrintOrientation = "landscape" | "portrait";
type PrintPageSize = "a4" | "a5";

export function PrintLayout({
  title,
  children,
  actions,
  paper = "landscape",
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  paper?: PrintOrientation;
}) {
  const [selectedPaper, setSelectedPaper] = useState<PrintOrientation>(paper);
  const [selectedPageSize, setSelectedPageSize] = useState<PrintPageSize>("a4");
  const [previewScale, setPreviewScale] = useState(1);
  const previewShellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedPaper(paper);
  }, [paper]);

  const paperClass = `bill-paper-${selectedPageSize}-${selectedPaper}`;
  const printPaperSizeLabel = selectedPageSize.toUpperCase();
  const printPageCssSize = `${printPaperSizeLabel} ${selectedPaper}`;
  const previewFrameDimensions =
    selectedPageSize === "a5"
      ? { width: "148mm", minHeight: "210mm", widthPx: 559, heightPx: 794 }
      : { width: "210mm", minHeight: "297mm", widthPx: 794, heightPx: 1123 };
  const previewContentDimensions =
    selectedPageSize === "a5"
      ? selectedPaper === "portrait"
        ? { width: "148mm", minHeight: "210mm", widthPx: 559, heightPx: 794 }
        : { width: "210mm", minHeight: "148mm", widthPx: 794, heightPx: 559 }
      : selectedPaper === "portrait"
        ? { width: "210mm", minHeight: "297mm", widthPx: 794, heightPx: 1123 }
        : { width: "297mm", minHeight: "210mm", widthPx: 1123, heightPx: 794 };
  const previewContentFitScale =
    selectedPaper === "landscape"
      ? Math.min(
        previewFrameDimensions.widthPx / previewContentDimensions.heightPx,
        previewFrameDimensions.heightPx / previewContentDimensions.widthPx
      )
      : 1;
  const previewLandscapeSafetyScale =
    selectedPageSize === "a5" && selectedPaper === "landscape" ? 0.86 : 1;
  const previewEffectiveContentScale =
    previewContentFitScale * previewLandscapeSafetyScale;
  const previewContentRenderedWidth =
    (selectedPaper === "landscape"
      ? previewContentDimensions.heightPx
      : previewContentDimensions.widthPx) * previewEffectiveContentScale;
  const previewContentRenderedHeight =
    (selectedPaper === "landscape"
      ? previewContentDimensions.widthPx
      : previewContentDimensions.heightPx) * previewEffectiveContentScale;
  const previewContentOffsetLeft =
    (previewFrameDimensions.widthPx - previewContentRenderedWidth) / 2;
  const previewContentOffsetTop =
    (previewFrameDimensions.heightPx - previewContentRenderedHeight) / 2;

  useEffect(() => {
    const node = previewShellRef.current;
    if (!node) return;

    const updateScale = () => {
      const availableWidth = Math.max(node.clientWidth - 24, 0);
      const availableHeight = Math.max(window.innerHeight - 220, 360);
      if (availableWidth === 0 || availableHeight === 0) {
        setPreviewScale(1);
        return;
      }

      setPreviewScale(
        Math.min(
          1,
          availableWidth / previewFrameDimensions.widthPx,
          availableHeight / previewFrameDimensions.heightPx
        )
      );
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [previewFrameDimensions.heightPx, previewFrameDimensions.widthPx]);

  return (
    <div className="print-container bill-print-root">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={selectedPageSize === "a4" ? "default" : "outline"}
              className={cn("h-8", selectedPageSize === "a4" ? "" : "bg-white")}
              onClick={() => setSelectedPageSize("a4")}
            >
              A4
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedPageSize === "a5" ? "default" : "outline"}
              className={cn("h-8", selectedPageSize === "a5" ? "" : "bg-white")}
              onClick={() => setSelectedPageSize("a5")}
            >
              A5
            </Button>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={selectedPaper === "landscape" ? "default" : "outline"}
              className={cn("h-8", selectedPaper === "landscape" ? "" : "bg-white")}
              onClick={() => setSelectedPaper("landscape")}
            >
              Landscape
            </Button>
            <Button
              type="button"
              size="sm"
              variant={selectedPaper === "portrait" ? "default" : "outline"}
              className={cn("h-8", selectedPaper === "portrait" ? "" : "bg-white")}
              onClick={() => setSelectedPaper("portrait")}
            >
              Portrait
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={previewShellRef}
        className="bill-preview-shell flex min-h-[70vh] w-full items-start justify-center overflow-auto rounded-xl bg-slate-100/40 p-3"
      >
        <div
          className="bill-preview-stage mx-auto"
          style={{
            width: `${previewFrameDimensions.widthPx * previewScale}px`,
            height: `${previewFrameDimensions.heightPx * previewScale}px`,
          }}
        >
          <div
            className="preview-scale-inner origin-top-left"
            style={{
              width: `${previewFrameDimensions.widthPx}px`,
              height: `${previewFrameDimensions.heightPx}px`,
              transform: `scale(${previewScale})`,
            }}
          >
            <div
              className="bill-preview-frame relative overflow-hidden border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
              style={{ width: previewFrameDimensions.width, minHeight: previewFrameDimensions.minHeight }}
            >
              <div
                className="preview-page-content absolute"
                style={{
                  left: `${previewContentOffsetLeft}px`,
                  top: `${previewContentOffsetTop}px`,
                  width: `${previewContentRenderedWidth}px`,
                  minHeight: `${previewContentRenderedHeight}px`,
                }}
              >
                <div
                  className="preview-page-content-inner origin-top-left"
                  style={{
                    width: `${previewContentDimensions.widthPx}px`,
                    height: `${previewContentDimensions.heightPx}px`,
                    transform:
                      selectedPaper === "landscape"
                        ? `scale(${previewEffectiveContentScale}) rotate(-90deg) translateX(-100%)`
                        : `scale(${previewEffectiveContentScale})`,
                  }}
                >
                  <div
                    id="report-content"
                    className={`bill-content relative mx-auto w-full overflow-hidden bg-white px-2 pb-16 pt-2 ${paperClass} bill-size-${selectedPageSize}`}
                    style={{ width: previewContentDimensions.width, minHeight: previewContentDimensions.minHeight }}
                  >
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Image src="/hospital-logo.png" alt="" width={180} height={180} className="opacity-[0.08] object-contain" />
                    </div>

                    <div className="print-letterhead-header mx-auto max-w-full pt-1 text-center">
                      <div className="flex items-start justify-center gap-3">
                        <div className="bill-brand-logo shrink-0 pt-1">
                          <Image src="/delma-logo.svg" alt="Delma" width={84} height={45} className="object-contain" />
                        </div>

                        <div className="min-w-0 px-1">
                          <p className="bill-hospital-name font-serif text-[22px] font-bold uppercase leading-tight tracking-wide sm:text-[26px]">
                            <span className="text-[#a61f28]">Doctor&apos;s</span>{" "}
                            <span className="text-[#263f86]">Medical Center</span>
                          </p>
                          <div className="bill-hospital-meta mt-1 text-[11px] leading-tight text-slate-800 sm:text-[13px]">
                            <p>(TC 58/2993/1, PARAVILA, PACHALLOOR P.O, THIRUVANANTHAPURAM)</p>
                            <p>PH: 0471-3170428, 8089056438</p>
                          </div>
                        </div>

                        <div className="bill-hospital-logo shrink-0 pt-0.5">
                          <Image src="/hospital-logo.png" alt={hospitalName} width={58} height={58} className="rounded-full object-cover" />
                        </div>
                      </div>
                    </div>

                    <div className="print-letterhead-body relative z-10 mx-auto mt-3 w-full max-w-full">{children}</div>

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
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        #report-content.bill-content {
          font-size: 11px;
        }

        #report-content.bill-content .bill-hospital-name {
          font-size: 20px;
          line-height: 1.1;
        }

        #report-content.bill-content .bill-hospital-meta {
          font-size: 10px;
          line-height: 1.2;
        }

        #report-content.bill-content .print-letterhead-bluebar {
          font-size: 10px;
        }

        #report-content.bill-content .print-letterhead-redbar {
          font-size: 9px;
        }

        #report-content.bill-content table,
        #report-content.bill-content th,
        #report-content.bill-content td {
          font-size: 12px;
          padding: 5px 6px;
        }

        #report-content.bill-content .text-\[15px\] {
          font-size: 12px !important;
        }

        #report-content.bill-content .text-\[13px\] {
          font-size: 10px !important;
          line-height: 1.2 !important;
        }

        #report-content.bill-content .bill-signature {
          font-size: 11px;
        }

        #report-content.bill-paper-a4-portrait .bill-signature {
          min-height: 380px !important;
        }

        #report-content.bill-paper-a4-landscape,
        #report-content.bill-paper-a5-landscape {
          font-size: 10px;
        }

        #report-content.bill-paper-a4-landscape .bill-hospital-name,
        #report-content.bill-paper-a5-landscape .bill-hospital-name {
          font-size: 18px;
        }

        #report-content.bill-paper-a4-landscape .bill-hospital-meta,
        #report-content.bill-paper-a5-landscape .bill-hospital-meta {
          font-size: 9px;
        }

        #report-content.bill-paper-a4-landscape table,
        #report-content.bill-paper-a4-landscape th,
        #report-content.bill-paper-a4-landscape td,
        #report-content.bill-paper-a5-landscape table,
        #report-content.bill-paper-a5-landscape th,
        #report-content.bill-paper-a5-landscape td {
          font-size: 10px;
          padding: 4px 5px;
        }

        #report-content.bill-paper-a4-landscape .text-\[15px\],
        #report-content.bill-paper-a5-landscape .text-\[15px\] {
          font-size: 10px !important;
        }

        #report-content.bill-paper-a4-landscape .text-\[13px\],
        #report-content.bill-paper-a5-landscape .text-\[13px\] {
          font-size: 8px !important;
          line-height: 1.15 !important;
        }

        #report-content.bill-paper-a4-landscape .bill-signature,
        #report-content.bill-paper-a5-landscape .bill-signature {
          margin-top: 10px !important;
          min-height: 72px !important;
          font-size: 9px !important;
        }

        #report-content.bill-paper-a4-landscape .w-\[340px\],
        #report-content.bill-paper-a5-landscape .w-\[340px\] {
          width: 250px !important;
        }

        #report-content.bill-paper-a4-landscape .w-\[320px\],
        #report-content.bill-paper-a5-landscape .w-\[320px\] {
          width: 240px !important;
        }

        #report-content.bill-size-a5 {
          font-size: 10px;
        }

        #report-content.bill-size-a5 .print-letterhead-header,
        #report-content.bill-size-a5 .print-letterhead-body,
        #report-content.bill-size-a5 .print-letterhead-footer {
          padding-left: 5mm !important;
          padding-right: 5mm !important;
        }

        #report-content.bill-size-a5 .print-letterhead-body {
          margin-top: 6px !important;
        }

        #report-content.bill-size-a5 .bill-hospital-name {
          font-size: 17px !important;
          line-height: 1.1 !important;
          letter-spacing: 0.02em !important;
        }

        #report-content.bill-size-a5 .bill-hospital-meta {
          margin-top: 2px !important;
          font-size: 8px !important;
          line-height: 1.2 !important;
        }

        #report-content.bill-size-a5 .bill-brand-logo img {
          width: 60px !important;
          height: 32px !important;
        }

        #report-content.bill-size-a5 .bill-hospital-logo img {
          width: 42px !important;
          height: 42px !important;
        }

        #report-content.bill-size-a5 .print-letterhead-bluebar {
          height: 14px !important;
          font-size: 8px !important;
          letter-spacing: 0.18em !important;
        }

        #report-content.bill-size-a5 .print-letterhead-redbar {
          margin-top: 4px !important;
          padding: 1px 4px !important;
          font-size: 7px !important;
          letter-spacing: 0.04em !important;
        }

        #report-content.bill-size-a5 .print-letterhead-footer p {
          margin-top: 4px !important;
          font-size: 9px !important;
        }

        #report-content.bill-size-a5 .bill-section-heading {
          margin-top: -4px !important;
          margin-bottom: -4px !important;
          font-size: 8px !important;
          letter-spacing: 0.04em !important;
        }

        #report-content.bill-size-a5 .bill-signature {
          margin-top: 12px !important;
          min-height: 64px !important;
          font-size: 9px !important;
        }

        #report-content.bill-size-a5 .bill-signature > div {
          margin-top: 6px !important;
          gap: 12px !important;
        }

        #report-content.bill-paper-a4-landscape .bill-signature {
          min-height: 140px !important;
        }

        #report-content.bill-paper-a5-portrait .bill-signature {
          min-height: 160px !important;
        }

        #report-content.bill-paper-a5-landscape .bill-signature {
          min-height: 84px !important;
        }

        #report-content.bill-size-a5 table,
        #report-content.bill-size-a5 th,
        #report-content.bill-size-a5 td {
          font-size: 10px !important;
          padding: 3px 4px !important;
        }

        #report-content.bill-size-a5 .text-\\[15px\\] {
          font-size: 10px !important;
        }

        #report-content.bill-size-a5 .text-\\[13px\\] {
          font-size: 8px !important;
          line-height: 1.2 !important;
        }

        #report-content.bill-size-a5 .w-\\[340px\\] {
          width: 230px !important;
        }

        #report-content.bill-size-a5 .w-\\[320px\\] {
          width: 220px !important;
        }

        #report-content.bill-size-a5 .min-w-\\[220px\\] {
          min-width: 120px !important;
        }

        @media print {
          @page {
            size: ${printPageCssSize};
            margin: 0;
          }

          .bill-print-root .bill-preview-shell {
            display: block !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: transparent !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }

          .bill-print-root .bill-preview-stage,
          .bill-print-root .preview-scale-inner,
          .bill-print-root .bill-preview-frame,
          .bill-print-root .preview-page-content,
          .bill-print-root .preview-page-content-inner {
            width: auto !important;
            min-height: 0 !important;
            height: auto !important;
            max-width: none !important;
            transform: none !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }

          .bill-print-root #report-content {
            width: ${previewContentDimensions.width} !important;
            min-height: ${previewContentDimensions.minHeight} !important;
            max-width: none !important;
            margin: 0 auto !important;
            padding-top: 2mm !important;
            padding-bottom: 2mm !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .bill-print-root .print-letterhead-header,
          .bill-print-root .print-letterhead-body,
          .bill-print-root .print-letterhead-footer {
            padding-left: 8mm !important;
            padding-right: 8mm !important;
            max-width: none !important;
          }

          .bill-print-root .print-letterhead-header {
            padding-top: 0 !important;
          }

          .bill-print-root .print-letterhead-body {
            margin-top: 10px !important;
            margin-bottom: 0 !important;
            flex: 1 0 auto !important;
          }

          .bill-print-root .print-letterhead-footer {
            position: static !important;
            inset: auto !important;
            margin-top: auto !important;
            padding-bottom: 0 !important;
          }

          .bill-print-root .print-letterhead-footer-inner,
          .bill-print-root .print-letterhead-header,
          .bill-print-root .print-letterhead-bluebar,
          .bill-print-root .print-letterhead-redbar {
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>
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
    <div className="bill-signature mt-8 flex min-h-[220px] flex-col justify-end text-[12px] text-slate-800">
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

export function BillSectionHeading({
  label,
}: {
  label: string;
}) {
  return (
    <div className="bill-section-heading -my-2 py-0 text-center text-[10px] leading-none font-bold uppercase tracking-[0.06em] text-slate-700">
      {label}
    </div>
  );
}
