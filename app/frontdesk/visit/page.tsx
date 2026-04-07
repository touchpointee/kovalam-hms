"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, subDays } from "date-fns";
import toast from "react-hot-toast";
import { rupeesInWords } from "@/lib/rupees-in-words";
import { formatCurrency, formatPaymentMethodLabel } from "@/lib/utils";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import { BillingStaffSelect, getBillingStaffDisplayName } from "@/components/BillingStaffSelect";
import { BillSignature, PrintLayout } from "@/components/PrintLayout";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Patient = {
  _id: string;
  name: string;
  regNo: string;
  age: number;
  gender: string;
  phone: string;
  address?: string;
};
type Visit = {
  _id: string;
  receiptNo: string;
  visitDate: string;
  status?: "waiting" | "served";
  opCharge: number;
  opChargeChangeReason?: string;
  paid: boolean;
  generatedByName?: string;
  patient?: Patient;
  doctor?: { name?: string } | null;
  /** Prior OP collected when this visit was registered (for reprint). */
  priorSettlementTotal?: number;
  priorSettlementLines?: Array<{
    receiptNo: string;
    visitDate: string;
    opCharge: number;
  }>;
  collectedBy?: { name?: string } | null;
  paymentMethod?: { name?: string; code?: string } | null;
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
  /** Consulting doctor for this registration (primary visit). */
  consultantName?: string | null;
  /** Consultation date/time for the primary (new) visit. */
  primaryConsultationAt?: string;
  lines: Array<{
    receiptNo: string;
    visitDate: string;
    opCharge: number;
    label: string;
  }>;
  grandTotal: number;
  generatedByName?: string;
  paymentMethodLabel?: string;
};

function formatAppointmentSlot(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${format(d, "dd-MM-yyyy")} · ${format(d, "h:mm a")}`;
}

function ReceiptInfoRow({ label, value }: { label: string; value: string }) {
  const v = value.trim();
  return (
    <div className="grid grid-cols-[130px_1fr] gap-x-1 text-[15px] leading-snug">
      <span className="text-slate-800">{label}</span>
      <span>: {v || "—"}</span>
    </div>
  );
}

function ConsultationReceiptPatientBlock({
  patient,
  consultantName,
  appointmentAt,
}: {
  patient: Patient;
  consultantName?: string | null;
  appointmentAt?: string | null;
}) {
  const addr = patient.address?.trim();
  const age =
    patient.age != null && !Number.isNaN(Number(patient.age)) ? String(patient.age) : "—";
  const gender = patient.gender?.trim() || "—";
  return (
    <div className="grid grid-cols-2 gap-8 border-y-2 border-slate-800 py-4 text-[15px]">
      <div className="space-y-2">
        <ReceiptInfoRow label="DMC ID" value={patient.regNo ?? ""} />
        <ReceiptInfoRow label="Patient Name" value={patient.name ?? ""} />
        <ReceiptInfoRow label="Phone" value={patient.phone ?? ""} />
        <ReceiptInfoRow label="Address" value={addr ?? ""} />
      </div>
      <div className="space-y-2">
        <ReceiptInfoRow label="Appointment date" value={formatAppointmentSlot(appointmentAt)} />
        <ReceiptInfoRow label="Consultant doctor" value={consultantName?.trim() ?? ""} />
        <ReceiptInfoRow label="Age / Gender" value={`${age} / ${gender}`} />
      </div>
    </div>
  );
}

function ConsultationPaymentAndTotals({
  paymentMethodLabel,
  grandTotal,
  generatedByName,
}: {
  paymentMethodLabel: string;
  grandTotal: number;
  generatedByName?: string;
}) {
  const pm = paymentMethodLabel.trim();
  return (
    <>
      <div className="mt-4 rounded-sm border-2 border-slate-800 bg-slate-50/80 px-3 py-2.5 print:bg-white">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-900">Payment details</p>
        <div className="mt-2 grid grid-cols-[140px_1fr] gap-x-1 text-[14px]">
          <span className="text-slate-800">Payment method</span>
          <span>: {pm || "—"}</span>
        </div>
      </div>
      <div className="mt-5 border-2 border-slate-800 px-3 py-3 text-[15px]">
        <p className="leading-relaxed">
          <span className="font-semibold text-slate-900">Total amount (in words):</span>{" "}
          <span className="text-slate-800">{rupeesInWords(grandTotal)}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-400 pt-2.5 font-semibold text-slate-900">
          <span>Total collected</span>
          <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
        </div>
      </div>
      <BillSignature staffName={getBillingStaffDisplayName(generatedByName)} />
    </>
  );
}

function buildCombinedBillFromStoredVisit(data: Visit): CombinedBill | null {
  const patient = data.patient;
  if (!patient) return null;
  const lines: CombinedBill["lines"] = [];
  for (const line of data.priorSettlementLines ?? []) {
    lines.push({
      receiptNo: line.receiptNo,
      visitDate: line.visitDate,
      opCharge: Number(line.opCharge) || 0,
      label: "Consultation fees",
    });
  }
  if (data.paid && Number(data.opCharge ?? 0) > 0) {
    lines.push({
      receiptNo: data.receiptNo,
      visitDate: data.visitDate,
      opCharge: Number(data.opCharge),
      label: "Consultation fees",
    });
  }
  const grandTotal = lines.reduce((s, l) => s + l.opCharge, 0);
  if (grandTotal <= 0) return null;
  return {
    patient,
    primaryReceiptNo: data.receiptNo,
    consultantName: data.doctor?.name ?? null,
    primaryConsultationAt: data.visitDate,
    lines,
    grandTotal,
    generatedByName: data.generatedByName?.trim() || data.collectedBy?.name?.trim() || "",
    paymentMethodLabel: formatPaymentMethodLabel(data.paymentMethod),
  };
}

export default function VisitPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const presetPatientId = searchParams.get("patientId");
  const fromPatientDetail = searchParams.get("from") === "patient-detail";
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  /** Standard OP charge from settings (shown in the highlight card). */
  const [baseOpCharge, setBaseOpCharge] = useState(0);
  const [defaultConsultationFee, setDefaultConsultationFee] = useState(0);
  /** Effective fee for the selected patient (0 if free within 5 days of last OP visit creation). */
  const [consultationFee, setConsultationFee] = useState("0");
  const [opChargeChangeReason, setOpChargeChangeReason] = useState("");
  /** Most recent prior OP visit (any status), for 5-day waiver messaging. */
  const [lastPriorOpVisit, setLastPriorOpVisit] = useState<{
    visitDate: string;
    receiptNo?: string;
  } | null>(null);
  const [chargeUpdatedAt, setChargeUpdatedAt] = useState<string | null>(null);
  const [paid, setPaid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [createdVisit, setCreatedVisit] = useState<Visit | null>(null);
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [generatedByName, setGeneratedByName] = useState("");
  const [printVisit, setPrintVisit] = useState<Visit | null>(null);
  const [combinedBill, setCombinedBill] = useState<CombinedBill | null>(null);
  const [outstandingOp, setOutstandingOp] = useState<OutstandingOpResponse | null>(null);
  /** Pending OP rows to mark paid in this transaction (checkboxes). */
  const [pendingPaySelected, setPendingPaySelected] = useState<Record<string, boolean>>({});
  const [doctors, setDoctors] = useState<Array<{ _id: string; name: string; email: string }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [newDoctorForm, setNewDoctorForm] = useState({ name: "", email: "", password: "" });
  const [addDoctorSaving, setAddDoctorSaving] = useState(false);

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
        label: "Consultation fees",
      });
    }
    if (data.paid && Number(data.opCharge ?? 0) > 0) {
      lines.push({
        receiptNo: data.receiptNo,
        visitDate: data.visitDate,
        opCharge: Number(data.opCharge),
        label: "Consultation fees",
      });
    }
    const grandTotal = lines.reduce((s, l) => s + l.opCharge, 0);
    if (grandTotal <= 0) return;
    setPrintVisit(null);
    setCombinedBill({
      patient,
      primaryReceiptNo: data.receiptNo,
      consultantName: data.doctor?.name ?? null,
      primaryConsultationAt: data.visitDate,
      lines,
      grandTotal,
      generatedByName: data.generatedByName?.trim() || data.collectedBy?.name?.trim() || "",
      paymentMethodLabel: formatPaymentMethodLabel(data.paymentMethod),
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

  const loadDoctors = () => {
    fetch("/api/doctors", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: Array<{ _id: string; name: string; email: string }>) => {
        setDoctors(Array.isArray(data) ? data : []);
      })
      .catch(() => setDoctors([]));
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const selectedPendingTotal = useMemo(() => {
    if (!outstandingOp) return 0;
    return outstandingOp.visits
      .filter((v) => pendingPaySelected[v._id] && v.opCharge > 0)
      .reduce((s, v) => s + v.opCharge, 0);
  }, [outstandingOp, pendingPaySelected]);

  const consultationFeeAmount = useMemo(() => {
    const parsed = Number.parseFloat(consultationFee);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }, [consultationFee]);
  const opChargeChanged = Math.abs(consultationFeeAmount - defaultConsultationFee) > 0.001;

  const newVisitPayableTotal = useMemo(() => {
    if (consultationFeeAmount <= 0) return 0;
    return paid ? consultationFeeAmount : 0;
  }, [consultationFeeAmount, paid]);

  const collectionGrandTotal = selectedPendingTotal + newVisitPayableTotal;
  const consultationPatientId =
    (createdVisit?.patient as Patient | undefined)?._id ?? selectedPatient?._id ?? "";

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
      setConsultationFee(String(baseOpCharge));
      setDefaultConsultationFee(baseOpCharge);
      setOpChargeChangeReason("");
      setLastPriorOpVisit(null);
      return;
    }
    const effectiveAt = new Date();

    fetch(`/api/visits?patientId=${selectedPatient._id}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = (Array.isArray(data) ? data : data.visits ?? []) as Array<{
          visitDate?: string;
          receiptNo?: string;
        }>;
        const sorted = [...list].sort(
          (a, b) => new Date(b.visitDate ?? 0).getTime() - new Date(a.visitDate ?? 0).getTime()
        );
        const priorOp = sorted.find((v) => v.visitDate && new Date(v.visitDate) < effectiveAt);
        if (!priorOp?.visitDate) {
          setLastPriorOpVisit(null);
          setDefaultConsultationFee(baseOpCharge);
          setConsultationFee(String(baseOpCharge));
          setOpChargeChangeReason("");
          return;
        }
        setLastPriorOpVisit({ visitDate: priorOp.visitDate, receiptNo: priorOp.receiptNo });
        const fiveDaysAgo = subDays(effectiveAt, 5);
        const vd = new Date(priorOp.visitDate);
        const nextDefaultFee = vd >= fiveDaysAgo ? 0 : baseOpCharge;
        setDefaultConsultationFee(nextDefaultFee);
        setConsultationFee(String(nextDefaultFee));
        setOpChargeChangeReason("");
      })
      .catch(() => {
        setLastPriorOpVisit(null);
        setDefaultConsultationFee(baseOpCharge);
        setConsultationFee(String(baseOpCharge));
        setOpChargeChangeReason("");
      });
  }, [selectedPatient, baseOpCharge]);

  useEffect(() => {
    if (consultationFeeAmount === 0) {
      setPaid(true);
    }
  }, [consultationFeeAmount]);

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
    fetch(`/api/patients?search=${encodeURIComponent(search)}&limit=10&registrationType=op`)
      .then((res) => res.json())
      .then((data) => setResults(data.patients ?? []))
      .catch(() => setResults([]));
  };

  const createVisit = async () => {
    if (!selectedPatient) {
      toast.error("Select a patient first");
      return;
    }
    if (!selectedDoctorId.trim()) {
      toast.error("Select a consulting doctor");
      return;
    }
    if (!generatedByName.trim()) {
      toast.error("Select staff before creating OP visit");
      return;
    }
    if (opChargeChanged && !opChargeChangeReason.trim()) {
      toast.error("Enter reason for changing OP charge");
      return;
    }
    if (collectionGrandTotal > 0 && !paymentMethodId.trim()) {
      toast.error("Select a payment method for this collection");
      return;
    }
    setLoading(true);
    try {
      const paidPayload = consultationFeeAmount === 0 ? true : paid;
      const settlePendingVisitIds = Object.entries(pendingPaySelected)
        .filter(([, checked]) => checked)
        .map(([id]) => id);
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient._id,
          paid: paidPayload,
          opCharge: consultationFeeAmount,
          ...(opChargeChanged ? { opChargeChangeReason: opChargeChangeReason.trim() } : {}),
          generatedByName,
          ...(selectedDoctorId ? { doctorId: selectedDoctorId } : {}),
          ...(settlePendingVisitIds.length > 0 ? { settlePendingVisitIds } : {}),
          ...(collectionGrandTotal > 0 && paymentMethodId.trim()
            ? { paymentMethodId: paymentMethodId.trim() }
            : {}),
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
      } else {
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
        toast.success("Visit created — receipt ready below (no OP fee for this visit).");
      } else {
        toast.success("Visit created — receipt preview is shown below. OP fee is still pending.");
      }
      loadTodayVisits();
      setPendingPaySelected({});
      setSelectedPatient(null);
      setSelectedDoctorId("");
      setSearch("");
      setResults([]);
      setGeneratedByName("");
      setPaymentMethodId("");
      setOutstandingOp(null);
      setConsultationFee(String(baseOpCharge));
      setDefaultConsultationFee(baseOpCharge);
      setOpChargeChangeReason("");
      setLastPriorOpVisit(null);
      setPaid(true);
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
        <p className="op-subtitle">Create outpatient visit — registered with the current date and time</p>
        {fromPatientDetail && presetPatientId && (
          <p className="mt-1 text-xs text-slate-600">
            Opened from patient detail. Patient is preselected; continue to consultation from here after creating the visit.
          </p>
        )}
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

                <div className="space-y-2">
                  <Label className="op-field-label">Consulting doctor *</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <SearchableCombobox
                        options={doctors.map((d) => ({
                          value: d._id,
                          label: d.name,
                          keywords: d.email,
                        }))}
                        value={selectedDoctorId}
                        onValueChange={setSelectedDoctorId}
                        placeholder="Search or select doctor"
                        searchPlaceholder="Type name or email…"
                        emptyMessage="No doctors match."
                      />
                    </div>
                    <Button type="button" variant="outline" className="shrink-0" onClick={() => setAddDoctorOpen(true)}>
                      Add doctor
                    </Button>
                  </div>
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
                                Visit date: {format(new Date(v.visitDate), "dd MMM yyyy, HH:mm")}
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

                <PaymentMethodSelect
                  className="max-w-md"
                  label="Payment method"
                  value={paymentMethodId}
                  onValueChange={setPaymentMethodId}
                  required={collectionGrandTotal > 0}
                  onOptionsLoaded={(opts) => {
                    setPaymentMethodId((id) => id || opts[0]?._id || "");
                  }}
                />

                <div className="op-panel bg-emerald-50/50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Payment Details</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Standard OP rate: {formatCurrency(baseOpCharge)} (per consultation period)
                  </p>
                  <div className="mt-2 space-y-2">
                    <Label htmlFor="op-charge-this-visit" className="text-sm text-slate-600">
                      OP charge for <span className="font-medium">this new visit</span> (editable)
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="op-charge-this-visit"
                        type="number"
                        min={0}
                        step="0.01"
                        className="op-input max-w-[11rem] tabular-nums"
                        value={consultationFee}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setConsultationFee("");
                            return;
                          }
                          const v = Number.parseFloat(raw);
                          if (!Number.isNaN(v)) setConsultationFee(String(Math.max(0, v)));
                        }}
                      />
                      <span className="text-sm text-slate-500">
                        = <span className="font-semibold text-slate-800">{formatCurrency(consultationFeeAmount)}</span>
                      </span>
                    </div>
                  </div>
                  {opChargeChanged ? (
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="op-charge-change-reason" className="text-sm text-slate-600">
                        Reason for OP charge change *
                      </Label>
                      <Input
                        id="op-charge-change-reason"
                        value={opChargeChangeReason}
                        onChange={(e) => setOpChargeChangeReason(e.target.value)}
                        className="op-input max-w-xl"
                        placeholder="Why is the OP charge changed from the default?"
                      />
                    </div>
                  ) : null}
                  {lastPriorOpVisit ? (
                    <div className="mt-2 space-y-1 rounded-md border border-emerald-200/80 bg-white/80 px-3 py-2 text-xs text-slate-700">
                      <p>
                        Last <span className="font-medium">OP visit</span> registered:{" "}
                        {format(new Date(lastPriorOpVisit.visitDate), "dd MMM yyyy, HH:mm")}
                        {lastPriorOpVisit.receiptNo ? ` (receipt ${lastPriorOpVisit.receiptNo})` : ""}
                      </p>
                      {consultationFeeAmount === 0 ? (
                        <p className="text-emerald-800">
                          Within 5 days of that visit — <span className="font-medium">no new OP charge</span> for this
                          registration. Unpaid OP from{" "}
                          <span className="font-medium">earlier visits</span> stays in{" "}
                          <span className="font-medium">Pending OP account</span> above.
                        </p>
                      ) : (
                        <p className="text-slate-800">
                          Last OP visit was <span className="font-medium">more than 5 days ago</span> — this counts as a{" "}
                          <span className="font-medium">new consultation period</span>, so the{" "}
                          <span className="font-medium">full OP charge</span> applies again. Any older unpaid amounts
                          are still listed under Pending OP account.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-600">
                      No prior OP visit on record — full OP charge applies for this first consultation period.
                    </p>
                  )}
                  {consultationFeeAmount > 0 ? (
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
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="op-generated-by" className="text-sm text-slate-600">
                      Name to show on bill
                    </Label>
                    <BillingStaffSelect
                      id="op-generated-by"
                      label=""
                      value={generatedByName}
                      onValueChange={setGeneratedByName}
                      className="max-w-[16rem]"
                      triggerClassName="w-full max-w-[16rem] bg-white"
                    />
                    <p className="text-xs text-slate-500">
                      Prints as a small “Generated by” line on the OP bill.
                    </p>
                  </div>
                </div>

                {selectedPatient && collectionGrandTotal > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm text-slate-900">
                    <p className="font-semibold">Total if you collect selected items now</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(collectionGrandTotal)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Prior visit(s): {formatCurrency(selectedPendingTotal)}
                      {consultationFeeAmount > 0 ? (
                        <>
                          {" "}
                          · This new visit: {formatCurrency(newVisitPayableTotal)}
                          {!paid && consultationFeeAmount > 0 ? " (mark as paid to include)" : ""}
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
                {consultationPatientId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        href={`/doctor/patients/${consultationPatientId}/consultation?visitId=${createdVisit._id}`}
                      >
                        Continue to Consultation
                      </Link>
                    </Button>
                  </div>
                )}
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
            paper="landscape"
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
                {combinedBill.lines.length > 1 ? (
                  <p className="text-xs text-slate-600">
                    Includes one or more prior visits with OP collected in this payment.
                  </p>
                ) : null}

                <ConsultationReceiptPatientBlock
                  patient={combinedBill.patient}
                  consultantName={combinedBill.consultantName}
                  appointmentAt={combinedBill.primaryConsultationAt}
                />

                <table className="w-full border-collapse border-2 border-slate-800 text-[15px]">
                  <thead>
                    <tr className="bg-slate-100 print:bg-slate-50">
                      <th className="border border-slate-800 px-3 py-2 text-left font-semibold">#</th>
                      <th className="border border-slate-800 px-3 py-2 text-left font-semibold">Description</th>
                      <th className="border border-slate-800 px-3 py-2 text-center font-semibold">Qty</th>
                      <th className="border border-slate-800 px-3 py-2 text-right font-semibold">Rate</th>
                      <th className="border border-slate-800 px-3 py-2 text-right font-semibold">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedBill.lines.map((line, idx) => (
                      <tr key={`${line.receiptNo}-${idx}`}>
                        <td className="border border-slate-800 px-3 py-2 align-top">{idx + 1}</td>
                        <td className="border border-slate-800 px-3 py-2 align-top">
                          <div className="font-medium">Consultation fees</div>
                        </td>
                        <td className="border border-slate-800 px-3 py-2 text-center align-top">1</td>
                        <td className="border border-slate-800 px-3 py-2 text-right align-top tabular-nums">
                          {formatCurrency(line.opCharge)}
                        </td>
                        <td className="border border-slate-800 px-3 py-2 text-right align-top tabular-nums">
                          {formatCurrency(line.opCharge)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <ConsultationPaymentAndTotals
                  paymentMethodLabel={combinedBill.paymentMethodLabel ?? ""}
                  grandTotal={combinedBill.grandTotal}
                  generatedByName={combinedBill.generatedByName}
                />
              </div>
            ) : printVisit ? (
              <div className="space-y-4 print-only">
                {printVisit.patient ? (
                  <ConsultationReceiptPatientBlock
                    patient={printVisit.patient as Patient}
                    consultantName={printVisit.doctor?.name}
                    appointmentAt={printVisit.visitDate}
                  />
                ) : (
                  <p className="text-sm text-amber-800">Patient details unavailable for this receipt.</p>
                )}

                <table className="w-full border-collapse border-2 border-slate-800 text-[15px]">
                  <thead>
                    <tr className="bg-slate-100 print:bg-slate-50">
                      <th className="border border-slate-800 px-3 py-2 text-left font-semibold">#</th>
                      <th className="border border-slate-800 px-3 py-2 text-left font-semibold">Description</th>
                      <th className="border border-slate-800 px-3 py-2 text-center font-semibold">Qty</th>
                      <th className="border border-slate-800 px-3 py-2 text-right font-semibold">Rate</th>
                      <th className="border border-slate-800 px-3 py-2 text-right font-semibold">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-800 px-3 py-2 align-top">1</td>
                      <td className="border border-slate-800 px-3 py-2 align-top">
                        <div className="font-medium">Consultation fees</div>
                        {Number(printVisit.opCharge ?? 0) === 0 ? (
                          <div className="mt-1 text-xs text-slate-600">
                            No fee — follow-up registration within 5 days of a prior OP visit.
                          </div>
                        ) : null}
                      </td>
                      <td className="border border-slate-800 px-3 py-2 text-center align-top">1</td>
                      <td className="border border-slate-800 px-3 py-2 text-right align-top tabular-nums">
                        {formatCurrency(printVisit.opCharge ?? 0)}
                      </td>
                      <td className="border border-slate-800 px-3 py-2 text-right align-top tabular-nums">
                        {formatCurrency(printVisit.opCharge ?? 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <ConsultationPaymentAndTotals
                  paymentMethodLabel={formatPaymentMethodLabel(printVisit.paymentMethod)}
                  grandTotal={Number(printVisit.opCharge ?? 0)}
                  generatedByName={printVisit.generatedByName || printVisit.collectedBy?.name}
                />
              </div>
            ) : null}
          </PrintLayout>
        </div>
      )}

      <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add doctor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={newDoctorForm.name}
                onChange={(e) => setNewDoctorForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={newDoctorForm.email}
                onChange={(e) => setNewDoctorForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Password * (min 6)</Label>
              <Input
                type="password"
                value={newDoctorForm.password}
                onChange={(e) => setNewDoctorForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDoctorOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={addDoctorSaving}
              onClick={async () => {
                if (
                  !newDoctorForm.name.trim() ||
                  !newDoctorForm.email.trim() ||
                  newDoctorForm.password.length < 6
                ) {
                  toast.error("Name, email and password (min 6) required");
                  return;
                }
                setAddDoctorSaving(true);
                try {
                  const res = await fetch("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: newDoctorForm.name.trim(),
                      email: newDoctorForm.email.trim(),
                      password: newDoctorForm.password,
                      role: "doctor",
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.message ?? "Failed");
                  toast.success("Doctor added");
                  setNewDoctorForm({ name: "", email: "", password: "" });
                  setAddDoctorOpen(false);
                  loadDoctors();
                  if (data._id) setSelectedDoctorId(String(data._id));
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setAddDoctorSaving(false);
                }
              }}
            >
              {addDoctorSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
