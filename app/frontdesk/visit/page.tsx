"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format, subDays } from "date-fns";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { PrintLayout } from "@/components/PrintLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Patient = { _id: string; name: string; regNo: string; age: number; gender: string; phone: string };
type Visit = {
  _id: string;
  receiptNo: string;
  visitDate: string;
  status?: "waiting" | "served";
  opCharge: number;
  paid: boolean;
  patient?: Patient;
  /** Prior OP collected when this visit was registered (for reprint). */
  priorSettlementTotal?: number;
  priorSettlementLines?: Array<{
    receiptNo: string;
    visitDate: string;
    opCharge: number;
  }>;
};

type OutstandingOpResponse = {
  total: number;
  visits: Array<{
    _id: string;
    receiptNo: string;
    opCharge: number;
    visitDate: string;
    status?: string;
  }>;
};

type SettlementResponse = {
  settledVisits: Array<{
    _id: string;
    receiptNo: string;
    visitDate: string;
    opCharge: number;
  }>;
  totalPendingSettled: number;
};

type CreateVisitResponse = Visit & { settlement?: SettlementResponse };

type CombinedBill = {
  patient: Patient;
  primaryReceiptNo: string;
  lines: Array<{
    receiptNo: string;
    visitDate: string;
    opCharge: number;
    label: string;
  }>;
  grandTotal: number;
};

function buildCombinedBillFromStoredVisit(data: Visit): CombinedBill | null {
  const patient = data.patient;
  if (!patient) return null;
  const lines: CombinedBill["lines"] = [];
  for (const line of data.priorSettlementLines ?? []) {
    lines.push({
      receiptNo: line.receiptNo,
      visitDate: line.visitDate,
      opCharge: Number(line.opCharge) || 0,
      label: "Pending OP (earlier visit — payment collected now)",
    });
  }
  if (data.paid && Number(data.opCharge ?? 0) > 0) {
    lines.push({
      receiptNo: data.receiptNo,
      visitDate: data.visitDate,
      opCharge: Number(data.opCharge),
      label: "Current OP registration (this visit)",
    });
  }
  const grandTotal = lines.reduce((s, l) => s + l.opCharge, 0);
  if (grandTotal <= 0) return null;
  return {
    patient,
    primaryReceiptNo: data.receiptNo,
    lines,
    grandTotal,
  };
}

export default function VisitPage() {
  const searchParams = useSearchParams();
  const presetPatientId = searchParams.get("patientId");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  /** Standard OP charge from settings (shown in the highlight card). */
  const [baseOpCharge, setBaseOpCharge] = useState(0);
  /** Effective fee for the selected patient (0 if free within 5 days of last served visit). */
  const [consultationFee, setConsultationFee] = useState(0);
  /** Latest served visit (used for 5-day follow-up rule messaging). */
  const [lastServedVisit, setLastServedVisit] = useState<{
    visitDate: string;
    receiptNo?: string;
  } | null>(null);
  const [chargeUpdatedAt, setChargeUpdatedAt] = useState<string | null>(null);
  const [paid, setPaid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [createdVisit, setCreatedVisit] = useState<Visit | null>(null);
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [uiPaymentMethod, setUiPaymentMethod] = useState("cash");
  const [printVisit, setPrintVisit] = useState<Visit | null>(null);
  const [combinedBill, setCombinedBill] = useState<CombinedBill | null>(null);
  const [outstandingOp, setOutstandingOp] = useState<OutstandingOpResponse | null>(null);
  /** Pending OP rows to mark paid in this transaction (checkboxes). */
  const [pendingPaySelected, setPendingPaySelected] = useState<Record<string, boolean>>({});

  const applyVisitToPrintState = (visitData: Visit) => {
    const combined = buildCombinedBillFromStoredVisit(visitData);
    if (combined) {
      setPrintVisit(null);
      setCombinedBill(combined);
    } else {
      setCombinedBill(null);
      setPrintVisit(visitData);
    }
  };

  const openPrintPreview = async (visitId?: string, fallbackVisit?: Visit | null) => {
    setCombinedBill(null);
    try {
      if (visitId) {
        const res = await fetch(`/api/visits/${visitId}`, { cache: "no-store" });
        const raw = await res.json();
        if (!res.ok) {
          throw new Error((raw as { message?: string }).message ?? "Failed to load visit bill");
        }
        applyVisitToPrintState(raw as Visit);
      } else if (fallbackVisit) {
        applyVisitToPrintState(fallbackVisit);
      } else {
        setPrintVisit(null);
      }

      window.setTimeout(() => {
        document.getElementById("consultation-bill-preview")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    } catch (error) {
      if (fallbackVisit) {
        applyVisitToPrintState(fallbackVisit);
        window.setTimeout(() => {
          document.getElementById("consultation-bill-preview")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 50);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Failed to load consultation bill");
    }
  };

  const openCombinedPrintFromResponse = (data: CreateVisitResponse, patient: Patient) => {
    const lines: CombinedBill["lines"] = [];
    for (const v of data.settlement?.settledVisits ?? []) {
      lines.push({
        receiptNo: v.receiptNo,
        visitDate: v.visitDate,
        opCharge: v.opCharge,
        label: "Pending OP (earlier visit — payment collected now)",
      });
    }
    if (data.paid && Number(data.opCharge ?? 0) > 0) {
      lines.push({
        receiptNo: data.receiptNo,
        visitDate: data.visitDate,
        opCharge: Number(data.opCharge),
        label: "Current OP registration (this visit)",
      });
    }
    const grandTotal = lines.reduce((s, l) => s + l.opCharge, 0);
    if (grandTotal <= 0) return;
    setPrintVisit(null);
    setCombinedBill({
      patient,
      primaryReceiptNo: data.receiptNo,
      lines,
      grandTotal,
    });
    window.setTimeout(() => {
      document.getElementById("consultation-bill-preview")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  useEffect(() => {
    if (presetPatientId && !selectedPatient) {
      fetch(`/api/patients/${presetPatientId}`)
        .then((res) => res.json())
        .then((data) => setSelectedPatient(data))
        .catch(() => {});
    }
  }, [presetPatientId, selectedPatient]);

  useEffect(() => {
    if (!selectedPatient) {
      setPendingPaySelected({});
    }
  }, [selectedPatient]);

  const selectedPendingTotal = useMemo(() => {
    if (!outstandingOp) return 0;
    return outstandingOp.visits
      .filter((v) => pendingPaySelected[v._id] && v.opCharge > 0)
      .reduce((s, v) => s + v.opCharge, 0);
  }, [outstandingOp, pendingPaySelected]);

  const newVisitPayableTotal = useMemo(() => {
    if (consultationFee <= 0) return 0;
    return paid ? consultationFee : 0;
  }, [consultationFee, paid]);

  const collectionGrandTotal = selectedPendingTotal + newVisitPayableTotal;

  const syncOpCharge = () => {
    fetch("/api/settings/op-charge", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setBaseOpCharge(data?.amount ?? 0);
        setChargeUpdatedAt(new Date().toISOString());
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!selectedPatient) {
      setConsultationFee(baseOpCharge);
      setLastServedVisit(null);
      return;
    }
    fetch(`/api/visits?patientId=${selectedPatient._id}&status=served`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.visits ?? [];
        const latest = list[0] as { visitDate?: string; receiptNo?: string } | undefined;
        if (!latest?.visitDate) {
          setLastServedVisit(null);
          setConsultationFee(baseOpCharge);
          return;
        }
        setLastServedVisit({ visitDate: latest.visitDate, receiptNo: latest.receiptNo });
        const fiveDaysAgo = subDays(new Date(), 5);
        const vd = new Date(latest.visitDate);
        setConsultationFee(vd >= fiveDaysAgo ? 0 : baseOpCharge);
      })
      .catch(() => {
        setLastServedVisit(null);
        setConsultationFee(baseOpCharge);
      });
  }, [selectedPatient, baseOpCharge]);

  useEffect(() => {
    if (consultationFee === 0) {
      setPaid(true);
    }
  }, [consultationFee]);

  useEffect(() => {
    if (!selectedPatient) {
      setOutstandingOp(null);
      return;
    }
    fetch(`/api/visits?patientId=${selectedPatient._id}&outstandingOp=true`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: OutstandingOpResponse) => {
        if (data && typeof data.total === "number" && Array.isArray(data.visits)) {
          setOutstandingOp(data);
        } else {
          setOutstandingOp(null);
        }
      })
      .catch(() => setOutstandingOp(null));
  }, [selectedPatient]);

  useEffect(() => {
    syncOpCharge();
    const interval = setInterval(syncOpCharge, 30000);
    const onFocus = () => syncOpCharge();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const loadTodayVisits = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTodayVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setTodayVisits([]));
  };

  useEffect(() => {
    loadTodayVisits();
    const interval = setInterval(loadTodayVisits, 15000);
    const onFocus = () => loadTodayVisits();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const doSearch = () => {
    if (!search.trim()) return;
    fetch(`/api/patients?search=${encodeURIComponent(search)}&limit=10`)
      .then((res) => res.json())
      .then((data) => setResults(data.patients ?? []))
      .catch(() => setResults([]));
  };

  const createVisit = async () => {
    if (!selectedPatient) {
      toast.error("Select a patient first");
      return;
    }
    setLoading(true);
    try {
      const paidPayload = consultationFee === 0 ? true : paid;
      const settlePendingVisitIds = Object.entries(pendingPaySelected)
        .filter(([, checked]) => checked)
        .map(([id]) => id);
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient._id,
          paid: paidPayload,
          ...(settlePendingVisitIds.length > 0 ? { settlePendingVisitIds } : {}),
        }),
      });
      const data = (await res.json()) as CreateVisitResponse;
      if (!res.ok) throw new Error((data as { message?: string }).message ?? "Failed");
      setCreatedVisit(data);
      const settledCount = data.settlement?.settledVisits?.length ?? 0;
      const isPaid = Boolean(data?.paid);
      const charge = Number(data?.opCharge ?? 0);
      const hasSettlement = settledCount > 0;

      setPrintVisit(null);
      setCombinedBill(null);

      if (hasSettlement) {
        openCombinedPrintFromResponse(data, selectedPatient);
      } else if (isPaid && charge > 0) {
        await openPrintPreview(data?._id, data);
      }

      if (hasSettlement && settledCount > 0 && charge > 0 && isPaid) {
        toast.success(
          `Visit created — receipt includes ${settledCount} pending visit(s) and today's OP fee.`
        );
      } else if (hasSettlement && settledCount > 0) {
        toast.success(
          settledCount === 1
            ? "Visit created — prior pending OP marked paid. Receipt below."
            : `Visit created — ${settledCount} prior visit(s) marked paid. Receipt below.`
        );
      } else if (isPaid && charge > 0) {
        toast.success("Visit created — consultation bill ready to print below.");
      } else if (isPaid && charge <= 0) {
        toast.success("Visit created (no OP fee for this visit).");
      } else {
        toast.success("Visit created — OP fee pending. Bill is not printed until payment is collected.");
      }
      loadTodayVisits();
      setPendingPaySelected({});
      setSelectedPatient(null);
      setSearch("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="op-page">
      <div>
        <h1 className="op-title">Daily OP Registration</h1>
        <p className="op-subtitle">Create outpatient visit for today</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <Card className="rounded-2xl border-emerald-100">
          <CardContent className="space-y-5 p-5">
            <div className="op-highlight">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">Today OP Charge</p>
              <p className="mt-1 text-3xl font-semibold">{formatCurrency(baseOpCharge)}</p>
              {chargeUpdatedAt && (
                <p className="mt-1 text-xs text-blue-100">
                  Synced {format(new Date(chargeUpdatedAt), "HH:mm:ss")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="op-field-label">Search & Select Patient *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name or patient ID..."
                  value={search}
                  className="op-input"
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())}
                />
                <Button className="op-button-primary" onClick={doSearch}>Search</Button>
              </div>
            </div>

            {results.length > 0 && (
              <div className="op-soft-card space-y-1">
                {results.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white"
                    onClick={() => { setSelectedPatient(p); setResults([]); setSearch(""); }}
                  >
                    {p.name} - {p.regNo} - {p.phone}
                  </button>
                ))}
              </div>
            )}

            {selectedPatient && (
              <>
                <div className="op-soft-card space-y-1">
                  <p className="text-sm font-semibold text-slate-700">{selectedPatient.name}</p>
                  <p className="text-sm text-slate-600">{selectedPatient.regNo} | {selectedPatient.age} yrs | {selectedPatient.gender}</p>
                </div>

                {outstandingOp && outstandingOp.visits.length > 0 && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    <p className="font-semibold">Pending OP account</p>
                    <p className="mt-0.5 text-xs text-amber-900/90">
                      Earlier visit(s) with consultation fee not marked as paid. Tick &quot;Collect now&quot; for visits you
                      are receiving payment for in this transaction.
                    </p>
                    {outstandingOp.total > 0 && (
                      <p className="mt-2 text-lg font-bold tabular-nums">
                        Total pending: {formatCurrency(outstandingOp.total)}
                      </p>
                    )}
                    <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
                      {outstandingOp.visits.map((v) => (
                        <li
                          key={v._id}
                          className="rounded border border-amber-200/90 bg-white/60 px-2 py-2"
                        >
                          <div className="flex flex-wrap items-start gap-2">
                            <input
                              type="checkbox"
                              id={`pending-${v._id}`}
                              className="mt-0.5"
                              disabled={v.opCharge <= 0}
                              checked={!!pendingPaySelected[v._id]}
                              onChange={() =>
                                setPendingPaySelected((s) => ({
                                  ...s,
                                  [v._id]: !s[v._id],
                                }))
                              }
                            />
                            <label htmlFor={`pending-${v._id}`} className="min-w-0 flex-1 cursor-pointer">
                              <div className="flex flex-wrap justify-between gap-1 font-medium">
                                <span>Receipt {v.receiptNo}</span>
                                <span className="tabular-nums">{formatCurrency(v.opCharge)}</span>
                              </div>
                              <p className="mt-1 text-[11px] text-amber-900/85">
                                Consultation visit: {format(new Date(v.visitDate), "dd MMM yyyy, HH:mm")}
                                {v.status ? ` · ${v.status}` : ""}
                              </p>
                              <p className="mt-0.5 text-[11px] text-amber-800">Collect OP for this visit now</p>
                            </label>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="op-field-label">Payment Method *</Label>
                    <Input
                      className="op-input"
                      value={uiPaymentMethod === "cash" ? "Cash" : uiPaymentMethod}
                      onChange={(e) => setUiPaymentMethod(e.target.value)}
                    />
                  </div>
                </div>

                <div className="op-panel bg-emerald-50/50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Payment Details</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Standard OP rate: {formatCurrency(baseOpCharge)} (per consultation period)
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Consultation fee for <span className="font-medium">this new visit</span>:{" "}
                    <span className="font-semibold text-slate-800">{formatCurrency(consultationFee)}</span>
                  </p>
                  {lastServedVisit ? (
                    <div className="mt-2 space-y-1 rounded-md border border-emerald-200/80 bg-white/80 px-3 py-2 text-xs text-slate-700">
                      <p>
                        Last <span className="font-medium">served</span> consultation:{" "}
                        {format(new Date(lastServedVisit.visitDate), "dd MMM yyyy, HH:mm")}
                        {lastServedVisit.receiptNo ? ` (receipt ${lastServedVisit.receiptNo})` : ""}
                      </p>
                      {consultationFee === 0 ? (
                        <p className="text-emerald-800">
                          Within 5 days of that served visit — <span className="font-medium">no new OP charge</span> for
                          this registration (second visit in the same period). Unpaid OP from{" "}
                          <span className="font-medium">earlier consultations</span> (by visit date) stays in{" "}
                          <span className="font-medium">Pending OP account</span> above.
                        </p>
                      ) : (
                        <p className="text-slate-800">
                          Last served consultation was <span className="font-medium">more than 5 days ago</span> — this
                          counts as a <span className="font-medium">new consultation period</span>, so the{" "}
                          <span className="font-medium">full OP charge</span> applies again (second period / new fee).
                          Any older unpaid amounts are still listed under Pending OP account.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">
                      No prior <span className="font-medium">served</span> visit on record — full OP charge applies for
                      this first consultation period.
                    </p>
                  )}
                  {consultationFee > 0 ? (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="paid"
                        checked={paid}
                        onChange={(e) => setPaid(e.target.checked)}
                      />
                      <Label htmlFor="paid">Mark as paid</Label>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-600">
                      No OP payment for this visit — nothing to collect.
                    </p>
                  )}
                </div>

                {selectedPatient && collectionGrandTotal > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm text-slate-900">
                    <p className="font-semibold">Total if you collect selected items now</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(collectionGrandTotal)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Prior visit(s): {formatCurrency(selectedPendingTotal)}
                      {consultationFee > 0 ? (
                        <>
                          {" "}
                          · This new visit: {formatCurrency(newVisitPayableTotal)}
                          {!paid && consultationFee > 0 ? " (mark as paid to include)" : ""}
                        </>
                      ) : null}
                    </p>
                  </div>
                )}

                <Button onClick={createVisit} className="op-button-primary w-full" disabled={loading}>
                  {loading ? "Creating..." : "Create OP Visit"}
                </Button>
              </>
            )}
            {createdVisit && (
              <div className="op-soft-card">
                <p className="text-sm font-semibold text-slate-700">Visit Created</p>
                <p className="mt-1 text-sm text-slate-600">
                  Receipt: {createdVisit.receiptNo} | Patient: {(createdVisit.patient as Patient)?.name ?? "-"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {Number(createdVisit.opCharge ?? 0) === 0
                    ? "No OP fee for this visit — no payment required."
                    : createdVisit.paid
                      ? "OP fee marked as paid."
                      : "OP fee pending — consultation bill was not printed."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-100">
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s OP Summary</CardTitle>
            <CardDescription>{format(new Date(), "dd MMM yyyy")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="op-soft-card">
              <p className="font-medium text-slate-700">Today&apos;s visits</p>
              <p className="mt-1 text-slate-500">{todayVisits.length}</p>
            </div>
            <div className="max-h-52 overflow-auto rounded-lg border border-emerald-100 p-2">
              {todayVisits.length === 0 ? (
                <p className="text-xs text-slate-500">No visits today.</p>
              ) : (
                <ul className="space-y-2">
                  {todayVisits.slice(0, 8).map((v) => (
                    <li key={v._id}>
                      <div className="rounded-md bg-emerald-50/50 px-2 py-1.5 text-xs">
                        <Link
                          href={`/doctor/patients/${(v.patient as Patient)._id}/consultation?visitId=${v._id}`}
                          className="block hover:bg-emerald-100/70"
                        >
                          <p className="font-medium text-slate-700">{(v.patient as Patient | undefined)?.name ?? "-"}</p>
                          <p className="text-slate-500">
                            {format(new Date(v.visitDate), "HH:mm")} | {v.status ?? "waiting"}
                          </p>
                          {Number(v.priorSettlementTotal ?? 0) > 0 && Number(v.opCharge ?? 0) === 0 ? (
                            <p className="mt-1 text-[10px] text-emerald-800">
                              Prior OP collected with this visit — use Print for receipt
                            </p>
                          ) : null}
                        </Link>
                        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                          {(Number(v.priorSettlementTotal ?? 0) > 0 ||
                            (v.paid && Number(v.opCharge ?? 0) > 0)) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openPrintPreview(v._id, v)}
                            >
                              Print Bill
                            </Button>
                          ) : (
                            <span className="text-[11px] text-amber-800">
                              {v.paid ? "No OP fee" : "OP payment pending — no bill until paid"}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {(combinedBill || printVisit) && (
        <div id="consultation-bill-preview">
          <PrintLayout
            title={combinedBill ? "OP consultation receipt" : "Consultation Bill"}
            actions={
              <div className="flex items-center gap-2">
                <Button variant="default" onClick={() => window.print()}>
                  {combinedBill ? "Print receipt" : "Print Consultation Bill"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCombinedBill(null);
                    setPrintVisit(null);
                  }}
                >
                  Close Preview
                </Button>
              </div>
            }
          >
            {combinedBill ? (
              <div className="space-y-4 print-only">
                <p className="text-sm text-slate-700">
                  New registration receipt: <span className="font-semibold">{combinedBill.primaryReceiptNo}</span>
                  {combinedBill.lines.some((l) => l.label.includes("Pending")) && (
                    <span className="block text-xs text-slate-600">
                      Includes one or more prior visits with OP collected in this payment.
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  Printed: {format(new Date(), "dd MMM yyyy, HH:mm")}
                </p>
                <div className="grid grid-cols-2 gap-8 border-y border-slate-400 py-4 text-[15px]">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[120px_1fr]">
                      <span>DMC ID</span>
                      <span>: {combinedBill.patient.regNo ?? "-"}</span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr]">
                      <span>Patient Name</span>
                      <span>: {combinedBill.patient.name ?? "-"}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[120px_1fr]">
                      <span>Age</span>
                      <span>: {combinedBill.patient.age ? `${combinedBill.patient.age}` : "-"}</span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr]">
                      <span>Gender</span>
                      <span>: {combinedBill.patient.gender ?? "-"}</span>
                    </div>
                  </div>
                </div>

                <table className="w-full border-collapse text-[15px]">
                  <thead>
                    <tr>
                      <th className="border border-slate-400 px-3 py-2 text-left font-semibold">#</th>
                      <th className="border border-slate-400 px-3 py-2 text-left font-semibold">Description</th>
                      <th className="border border-slate-400 px-3 py-2 text-center font-semibold">Qty</th>
                      <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Rate</th>
                      <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedBill.lines.map((line, idx) => (
                      <tr key={`${line.receiptNo}-${idx}`}>
                        <td className="border border-slate-400 px-3 py-2 align-top">{idx + 1}</td>
                        <td className="border border-slate-400 px-3 py-2 align-top">
                          <div className="font-medium">{line.label}</div>
                          <div className="text-xs text-slate-600">
                            Receipt {line.receiptNo} · Consultation visit{" "}
                            {line.visitDate
                              ? format(new Date(line.visitDate), "dd MMM yyyy, HH:mm")
                              : "—"}
                          </div>
                        </td>
                        <td className="border border-slate-400 px-3 py-2 text-center align-top">1</td>
                        <td className="border border-slate-400 px-3 py-2 text-right align-top">
                          {formatCurrency(line.opCharge)}
                        </td>
                        <td className="border border-slate-400 px-3 py-2 text-right align-top">
                          {formatCurrency(line.opCharge)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="ml-auto grid w-[320px] grid-cols-[1fr_120px] gap-y-1 pt-8 text-[15px]">
                  <div className="border-b border-slate-300 py-1">Total collected</div>
                  <div className="border-b border-slate-300 py-1 text-right font-semibold">
                    {formatCurrency(combinedBill.grandTotal)}
                  </div>
                </div>
              </div>
            ) : printVisit ? (
              <div className="space-y-4 print-only">
                <div className="grid grid-cols-2 gap-8 border-y border-slate-400 py-4 text-[15px]">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[120px_1fr]">
                      <span>DMC ID</span>
                      <span>: {printVisit.patient?.regNo ?? "-"}</span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr]">
                      <span>Patient Name</span>
                      <span>: {printVisit.patient?.name ?? "-"}</span>
                    </div>
                    <div className="grid grid-cols-[120px_1fr]">
                      <span>Receipt No</span>
                      <span>: {printVisit.receiptNo ?? "-"}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[150px_1fr]">
                      <span>Consultation visit</span>
                      <span>
                        :{" "}
                        {printVisit.visitDate
                          ? format(new Date(printVisit.visitDate), "dd-MM-yyyy HH:mm")
                          : "-"}
                      </span>
                    </div>
                    <div className="grid grid-cols-[150px_1fr]">
                      <span>Age</span>
                      <span>: {printVisit.patient?.age ? `${printVisit.patient.age}` : "-"}</span>
                    </div>
                    <div className="grid grid-cols-[150px_1fr]">
                      <span>Gender</span>
                      <span>: {printVisit.patient?.gender ?? "-"}</span>
                    </div>
                  </div>
                </div>

                <table className="w-full border-collapse text-[15px]">
                  <thead>
                    <tr>
                      <th className="border border-slate-400 px-3 py-2 text-left font-semibold">#</th>
                      <th className="border border-slate-400 px-3 py-2 text-left font-semibold">Description</th>
                      <th className="border border-slate-400 px-3 py-2 text-center font-semibold">Qty</th>
                      <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Rate</th>
                      <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-400 px-3 py-2 align-top">1</td>
                      <td className="border border-slate-400 px-3 py-2 align-top">
                        <div className="font-medium">OP consultation charge</div>
                        <div className="text-xs text-slate-600">
                          For visit dated{" "}
                          {printVisit.visitDate
                            ? format(new Date(printVisit.visitDate), "dd MMM yyyy, HH:mm")
                            : "—"}
                        </div>
                        {Number(printVisit.opCharge ?? 0) === 0 && (
                          <div className="mt-1 text-xs text-slate-600">
                            No fee — follow-up registration within 5 days of a completed (served) consultation.
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-400 px-3 py-2 text-center align-top">1</td>
                      <td className="border border-slate-400 px-3 py-2 text-right align-top">
                        {formatCurrency(printVisit.opCharge ?? 0)}
                      </td>
                      <td className="border border-slate-400 px-3 py-2 text-right align-top">
                        {formatCurrency(printVisit.opCharge ?? 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="ml-auto grid w-[320px] grid-cols-[1fr_120px] gap-y-1 pt-8 text-[15px]">
                  <div className="border-b border-slate-300 py-1">Amount</div>
                  <div className="border-b border-slate-300 py-1 text-right">{formatCurrency(printVisit.opCharge ?? 0)}</div>
                  <div className="py-1 font-semibold">Net Amount</div>
                  <div className="py-1 text-right font-semibold">{formatCurrency(printVisit.opCharge ?? 0)}</div>
                </div>
              </div>
            ) : null}
          </PrintLayout>
        </div>
      )}
    </div>
  );
}
