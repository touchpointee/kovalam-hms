"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { rupeesInWords } from "@/lib/rupees-in-words";
import { formatCurrency, formatPaymentMethodLabel } from "@/lib/utils";
import { BillSignature, PrintLayout } from "@/components/PrintLayout";
import { getBillingStaffDisplayName } from "@/components/BillingStaffSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  paid?: boolean;
  status?: "waiting" | "served";
  opCharge?: number;
  generatedByName?: string;
  doctor?: { name?: string } | null;
  collectedBy?: { name?: string } | null;
  paymentMethod?: { name?: string; code?: string } | null;
  priorSettlementTotal?: number;
  priorSettlementLines?: Array<{
    receiptNo: string;
    visitDate: string;
    opCharge: number;
  }>;
};

type PatientDetail = {
  _id: string;
  regNo: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address?: string;
  bloodGroup?: string;
  visits?: Visit[];
};

type ProcedureOption = { _id: string; name: string; price?: number };

type LabTestOption = { _id: string; name: string; price?: number };

type DoctorOption = { _id: string; name: string };

type MedicineOption = { _id: string; name: string; genericName?: string };

type MedRow = {
  medicine?: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  /** Estimated / quoted fee for this line (saved on prescription). */
  lineFee: string;
};

const emptyMedRow = (): MedRow => ({
  medicineName: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
  lineFee: "",
});

type PrintableVisit = Visit & {
  patient?: {
    _id?: string;
    regNo?: string;
    name?: string;
    age?: number;
    gender?: string;
    phone?: string;
    address?: string;
  };
};

type CombinedBill = {
  patient: {
    regNo: string;
    name: string;
    age: number;
    gender: string;
    phone: string;
    address?: string;
  };
  consultantName?: string | null;
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

function toDatetimeLocalValue(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  patient: CombinedBill["patient"];
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

function buildCombinedBillFromStoredVisit(data: PrintableVisit): CombinedBill | null {
  const patient = data.patient;
  if (!patient?.name || !patient.regNo || !patient.phone) return null;
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
      receiptNo: data.receiptNo ?? "",
      visitDate: data.visitDate,
      opCharge: Number(data.opCharge) || 0,
      label: "Consultation fees",
    });
  }
  const grandTotal = lines.reduce((s, l) => s + l.opCharge, 0);
  if (grandTotal <= 0) return null;
  return {
    patient: {
      regNo: patient.regNo,
      name: patient.name,
      age: Number(patient.age ?? 0),
      gender: patient.gender ?? "",
      phone: patient.phone,
      address: patient.address,
    },
    consultantName: data.doctor?.name ?? null,
    primaryConsultationAt: data.visitDate,
    lines,
    grandTotal,
    generatedByName: data.generatedByName?.trim() || data.collectedBy?.name?.trim() || "",
    paymentMethodLabel: formatPaymentMethodLabel(data.paymentMethod),
  };
}

export default function FrontdeskPatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [vDate, setVDate] = useState(toDatetimeLocalValue(new Date()));
  const [savingVisit, setSavingVisit] = useState(false);
  const [deletingVisitId, setDeletingVisitId] = useState<string | null>(null);
  const [printingVisitId, setPrintingVisitId] = useState<string | null>(null);
  const [printVisit, setPrintVisit] = useState<PrintableVisit | null>(null);
  const [combinedBill, setCombinedBill] = useState<CombinedBill | null>(null);
  const [allProcedures, setAllProcedures] = useState<ProcedureOption[]>([]);
  const [allLabTests, setAllLabTests] = useState<LabTestOption[]>([]);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([]);
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<string[]>([]);
  const [procedureSearch, setProcedureSearch] = useState("");
  const [labSearch, setLabSearch] = useState("");
  const [consultationFee, setConsultationFee] = useState("0");
  const [medicineRows, setMedicineRows] = useState<MedRow[]>([emptyMedRow()]);
  const [notes, setNotes] = useState("");
  const [allDoctors, setAllDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  // Per-row medicine search state
  const [medSearchStates, setMedSearchStates] = useState<
    { suggestions: MedicineOption[]; open: boolean }[]
  >([{ suggestions: [], open: false }]);
  const medSearchTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const visitDateInputRef = useRef<HTMLInputElement>(null);
  const visitDialogBodyRef = useRef<HTMLDivElement>(null);
  /** Synchronous guard — `disabled={savingVisit}` alone can miss rapid double-clicks before re-render. */
  const visitSaveInFlightRef = useRef(false);

  const resetVisitDialogScroll = useCallback(() => {
    const el = visitDialogBodyRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const openVisitDatetimePicker = useCallback(() => {
    const el = visitDateInputRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.focus();
    }
  }, []);

  const setVisitDatetimeToNow = useCallback(() => {
    setVDate(toDatetimeLocalValue(new Date()));
  }, []);

  const loadPatient = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;
    if (!options?.silent) setLoading(true);
    try {
      const res = await fetch(`/api/patients/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to load");
      setPatient(data);
    } catch {
      setPatient(null);
      toast.error("Could not load patient");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadPatient();
    if (visitDialogOpen) return;
    const interval = setInterval(() => {
      void loadPatient({ silent: true });
    }, 15000);
    const onFocus = () => {
      void loadPatient({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [id, loadPatient, visitDialogOpen]);

  useEffect(() => {
    fetch("/api/procedures", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setAllProcedures(Array.isArray(data) ? data : []))
      .catch(() => setAllProcedures([]));
  }, []);

  useEffect(() => {
    fetch("/api/lab-tests", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setAllLabTests(Array.isArray(data) ? data : []))
      .catch(() => setAllLabTests([]));
  }, []);

  useEffect(() => {
    fetch("/api/doctors", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list: DoctorOption[] = Array.isArray(data) ? data : (data?.users ?? []);
        setAllDoctors(list);
      })
      .catch(() => setAllDoctors([]));
  }, []);

  const visits = useMemo(() => patient?.visits ?? [], [patient]);

  const applyVisitToPrintState = useCallback((visitData: PrintableVisit) => {
    const combined = buildCombinedBillFromStoredVisit(visitData);
    if (combined) {
      setCombinedBill(combined);
      setPrintVisit(null);
      return;
    }
    setCombinedBill(null);
    setPrintVisit(visitData);
  }, []);

  const resetClinicalFields = () => {
    setSelectedProcedureIds([]);
    setSelectedLabTestIds([]);
    setMedicineRows([emptyMedRow()]);
    setNotes("");
    setSelectedDoctorId("");
    setMedSearchStates([{ suggestions: [], open: false }]);
  };

  const openCreateVisit = () => {
    setEditingVisit(null);
    setVDate(toDatetimeLocalValue(new Date()));
    resetClinicalFields();
    setProcedureSearch("");
    setLabSearch("");
    setConsultationFee("0");
    setVisitDialogOpen(true);
    fetch("/api/settings/op-charge", { cache: "no-store" })
      .then((res) => res.json())
      .then((d: { amount?: number }) => {
        if (d?.amount != null && Number.isFinite(d.amount)) setConsultationFee(String(d.amount));
      })
      .catch(() => {});
  };

  const openEditVisit = (visit: Visit) => {
    setEditingVisit(visit);
    setVDate(toDatetimeLocalValue(visit.visitDate));
    resetClinicalFields();
    setProcedureSearch("");
    setLabSearch("");
    setConsultationFee(
      visit.opCharge != null && Number.isFinite(visit.opCharge) ? String(visit.opCharge) : "0"
    );
    const rawDoctor = visit.doctor as { _id?: string } | null | undefined;
    setSelectedDoctorId(rawDoctor?._id ? String(rawDoctor._id) : "");
    setVisitDialogOpen(true);
  };

  useEffect(() => {
    if (!visitDialogOpen || !patient?._id) return;
    resetVisitDialogScroll();
    if (!editingVisit?._id) {
      resetClinicalFields();
      return;
    }
    let cancelled = false;
    fetch(
      `/api/prescriptions?patientId=${patient._id}&visitId=${editingVisit._id}`,
      { cache: "no-store" }
    )
      .then((res) => res.json())
      .then(
        (pres: {
          _id?: string;
          notes?: string;
          procedures?: unknown[];
          labTests?: unknown[];
          medicines?: Array<MedRow & { lineFee?: number }>;
        } | null) => {
        if (cancelled || !pres || !pres._id) return;
        setNotes(pres.notes ?? "");
        const procIds = (pres.procedures ?? []).map((p) =>
          typeof p === "object" && p !== null && "_id" in p
            ? String((p as { _id: string })._id)
            : String(p)
        );
        setSelectedProcedureIds(procIds.filter(Boolean));
        const labIds = (pres.labTests ?? []).map((t) =>
          typeof t === "object" && t !== null && "_id" in t
            ? String((t as { _id: string })._id)
            : String(t)
        );
        setSelectedLabTestIds(labIds.filter(Boolean));
        const meds = pres.medicines;
        if (Array.isArray(meds) && meds.length > 0) {
          setMedicineRows(
            meds.map((m) => {
              const rawMed = m.medicine as { _id?: string } | string | undefined;
              const medicineId =
                rawMed && typeof rawMed === "object" && "_id" in rawMed
                  ? String(rawMed._id)
                  : rawMed
                    ? String(rawMed)
                    : undefined;
              const lf =
                m.lineFee != null && typeof m.lineFee === "number" && Number.isFinite(m.lineFee)
                  ? String(m.lineFee)
                  : "";
              return {
                medicine: medicineId,
                medicineName: m.medicineName ?? "",
                dosage: m.dosage ?? "",
                frequency: m.frequency ?? "",
                duration: m.duration ?? "",
                instructions: m.instructions ?? "",
                lineFee: lf,
              };
            })
          );
        } else {
          setMedicineRows([emptyMedRow()]);
        }
      }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visitDialogOpen, editingVisit?._id, patient?._id, resetVisitDialogScroll]);

  const toggleProcedure = (procId: string) => {
    setSelectedProcedureIds((prev) =>
      prev.includes(procId) ? prev.filter((id) => id !== procId) : [...prev, procId]
    );
  };

  const toggleLabTest = (labId: string) => {
    setSelectedLabTestIds((prev) =>
      prev.includes(labId) ? prev.filter((id) => id !== labId) : [...prev, labId]
    );
  };

  const filteredProcedures = useMemo(() => {
    const q = procedureSearch.trim().toLowerCase();
    if (!q) return allProcedures;
    return allProcedures.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProcedures, procedureSearch]);

  const filteredLabTests = useMemo(() => {
    const q = labSearch.trim().toLowerCase();
    if (!q) return allLabTests;
    return allLabTests.filter((t) => t.name.toLowerCase().includes(q));
  }, [allLabTests, labSearch]);

  const consultationAmount = useMemo(() => {
    const n = parseFloat(String(consultationFee).replace(/,/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [consultationFee]);

  const procedureFeesTotal = useMemo(
    () =>
      selectedProcedureIds.reduce((sum, pid) => {
        const p = allProcedures.find((x) => x._id === pid);
        return sum + (typeof p?.price === "number" && Number.isFinite(p.price) ? p.price : 0);
      }, 0),
    [selectedProcedureIds, allProcedures]
  );

  const labFeesTotal = useMemo(
    () =>
      selectedLabTestIds.reduce((sum, lid) => {
        const t = allLabTests.find((x) => x._id === lid);
        return sum + (typeof t?.price === "number" && Number.isFinite(t.price) ? t.price : 0);
      }, 0),
    [selectedLabTestIds, allLabTests]
  );

  const medicineFeesTotal = useMemo(
    () =>
      medicineRows.reduce((sum, row) => {
        if (!row.medicineName.trim()) return sum;
        const n = parseFloat(String(row.lineFee).replace(/,/g, ""));
        return sum + (Number.isFinite(n) && n >= 0 ? n : 0);
      }, 0),
    [medicineRows]
  );

  const grandFeesTotal = useMemo(
    () => consultationAmount + procedureFeesTotal + medicineFeesTotal + labFeesTotal,
    [consultationAmount, procedureFeesTotal, medicineFeesTotal, labFeesTotal]
  );

  const savePrescriptionForVisit = async (visitId: string) => {
    if (!patient?._id) return;
    const medicines = medicineRows
      .filter((m) => m.medicineName.trim())
      .map((m) => {
        const feeRaw = parseFloat(String(m.lineFee).replace(/,/g, ""));
        const lineFee =
          Number.isFinite(feeRaw) && feeRaw >= 0 ? feeRaw : undefined;
        return {
          ...(m.medicine ? { medicine: m.medicine } : {}),
          medicineName: m.medicineName.trim(),
          dosage: m.dosage.trim() || undefined,
          frequency: m.frequency.trim() || undefined,
          duration: m.duration.trim() || undefined,
          instructions: m.instructions.trim() || undefined,
          ...(lineFee !== undefined ? { lineFee } : {}),
        };
      });
    const res = await fetch("/api/prescriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: patient._id,
        visitId,
        medicines,
        procedures: selectedProcedureIds,
        labTests: selectedLabTestIds,
        notes: notes.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Failed to save clinical data");
  };

  const deleteVisit = async (visitId: string) => {
    if (
      !window.confirm(
        "Delete this visit? Prescriptions, procedure bills, medicine bills, and lab bills linked to this visit will be removed. This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingVisitId(visitId);
    try {
      const res = await fetch(`/api/visits/${visitId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message ?? "Failed to delete visit");
      if (editingVisit?._id === visitId) {
        setVisitDialogOpen(false);
        setEditingVisit(null);
      }
      toast.success("Visit deleted");
      await loadPatient();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete visit");
    } finally {
      setDeletingVisitId(null);
    }
  };

  const openPrintPreview = useCallback(async (visitId: string) => {
    setPrintingVisitId(visitId);
    try {
      const res = await fetch(`/api/visits/${visitId}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to load consultation bill");
      applyVisitToPrintState(data as PrintableVisit);
      window.setTimeout(() => {
        document.getElementById("consultation-bill-preview")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load consultation bill");
    } finally {
      setPrintingVisitId(null);
    }
  }, [applyVisitToPrintState]);

  const saveVisit = async () => {
    if (!patient?._id || visitSaveInFlightRef.current) return;
    visitSaveInFlightRef.current = true;
    setSavingVisit(true);
    const wasEditing = !!editingVisit?._id;
    try {
      const opCharge = consultationAmount;
      const payload: Record<string, unknown> = {
        visitDate: new Date(vDate).toISOString(),
        status: editingVisit?._id ? (editingVisit.status ?? "waiting") : "served",
        opCharge,
        ...(selectedDoctorId ? { doctorId: selectedDoctorId } : {}),
      };
      const endpoint = editingVisit?._id
        ? `/api/visits/${editingVisit._id}`
        : `/api/patients/${patient._id}/visits`;
      const method = editingVisit?._id ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      const visitId = String(data._id ?? editingVisit?._id ?? "");
      if (!visitId) throw new Error("Missing visit id");
      await savePrescriptionForVisit(visitId);
      setVisitDialogOpen(false);
      setEditingVisit(null);
      toast.success(wasEditing ? "Visit and clinical data updated" : "Visit and clinical data saved");
      void loadPatient();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      visitSaveInFlightRef.current = false;
      setSavingVisit(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!patient?._id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Patient Details</h1>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Button asChild variant="outline">
          <Link href="/frontdesk/register">Back to Patient Search</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Patient Details</h1>
          <p className="text-sm text-muted-foreground">Frontdesk view</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/frontdesk/register">Back</Link>
          </Button>
          <Button onClick={openCreateVisit}>Add Visit Data</Button>
        </div>
      </div>

      <Card className="border-blue-100">
        <CardHeader>
          <CardTitle>{patient.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p><strong>Reg No:</strong> {patient.regNo}</p>
          <p><strong>Phone:</strong> {patient.phone}</p>
          <p><strong>Age:</strong> {patient.age}</p>
          <p><strong>Gender:</strong> <span className="capitalize">{patient.gender}</span></p>
          <p><strong>Blood Group:</strong> {patient.bloodGroup ?? "Unknown"}</p>
          <p><strong>Address:</strong> {patient.address || "-"}</p>
        </CardContent>
      </Card>

      <Card className="border-blue-100">
        <CardHeader>
          <CardTitle>Visit History</CardTitle>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Consulting doctor</TableHead>
                  <TableHead>OP / consultation</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => (
                  <TableRow key={v._id}>
                    <TableCell>{format(new Date(v.visitDate), "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell>{v.doctor?.name?.trim() || "-"}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(typeof v.opCharge === "number" ? v.opCharge : 0)}
                    </TableCell>
                    <TableCell>{v.paid ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{v.status ?? "waiting"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openEditVisit(v)}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => void openPrintPreview(v._id)}>
                          {printingVisitId === v._id ? "Loading…" : "Print Bill"}
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/doctor/patients/${patient._id}/consultation?visitId=${v._id}`}>
                            Open Consultation
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          disabled={deletingVisitId === v._id}
                          onClick={() => void deleteVisit(v._id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                          {deletingVisitId === v._id ? "Deleting…" : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
                          <div className="font-medium">{line.label}</div>
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
            ) : printVisit?.patient ? (
              <div className="space-y-4 print-only">
                <ConsultationReceiptPatientBlock
                  patient={{
                    regNo: printVisit.patient.regNo ?? patient.regNo,
                    name: printVisit.patient.name ?? patient.name,
                    age: Number(printVisit.patient.age ?? patient.age),
                    gender: printVisit.patient.gender ?? patient.gender,
                    phone: printVisit.patient.phone ?? patient.phone,
                    address: printVisit.patient.address ?? patient.address,
                  }}
                  consultantName={printVisit.doctor?.name}
                  appointmentAt={printVisit.visitDate}
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
                    <tr>
                      <td className="border border-slate-800 px-3 py-2 align-top">1</td>
                      <td className="border border-slate-800 px-3 py-2 align-top">
                        <div className="font-medium">Consultation fees</div>
                        {Number(printVisit.opCharge ?? 0) === 0 ? (
                          <div className="mt-1 text-xs text-slate-600">
                            No fee recorded for this consultation.
                          </div>
                        ) : null}
                      </td>
                      <td className="border border-slate-800 px-3 py-2 text-center align-top">1</td>
                      <td className="border border-slate-800 px-3 py-2 text-right align-top tabular-nums">
                        {formatCurrency(Number(printVisit.opCharge ?? 0))}
                      </td>
                      <td className="border border-slate-800 px-3 py-2 text-right align-top tabular-nums">
                        {formatCurrency(Number(printVisit.opCharge ?? 0))}
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
            ) : (
              <p className="text-sm text-amber-800">Patient details unavailable for this receipt.</p>
            )}
          </PrintLayout>
        </div>
      )}
      <Dialog
        open={visitDialogOpen}
        onOpenChange={(open) => {
          if (!open && savingVisit) return;
          setVisitDialogOpen(open);
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 shadow-md sm:max-w-3xl"
          onPointerDownOutside={(e) => savingVisit && e.preventDefault()}
          onEscapeKeyDown={(e) => savingVisit && e.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>{editingVisit ? "Edit visit data" : "Add visit data"}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Visit details, then procedures, medicines, and notes (same as consultation record).
            </p>
          </DialogHeader>
          <div
            ref={visitDialogBodyRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 [contain:layout_paint]"
          >
            <div className="grid gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="vDate">Visit date & time</Label>
                  <Button type="button" variant="outline" size="sm" onClick={setVisitDatetimeToNow}>
                    Now
                  </Button>
                </div>
                <Input
                  ref={visitDateInputRef}
                  id="vDate"
                  type="datetime-local"
                  value={vDate}
                  onChange={(e) => setVDate(e.target.value)}
                  onClick={openVisitDatetimePicker}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Use <span className="font-medium">Now</span> to set the current date and current time together.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitDoctor">Consulting doctor</Label>
                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                  <SelectTrigger id="visitDoctor" className="max-w-xs">
                    <SelectValue placeholder="Select a doctor (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {allDoctors.map((d) => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="consultationFee">Consultation fee (OP charge)</Label>
                <Input
                  id="consultationFee"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Saved on the visit receipt. Default for new visits comes from OP charge settings.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Procedures</Label>
                <p className="text-xs text-muted-foreground">Search and add procedures for this visit.</p>
                <Input
                  placeholder="Search procedures..."
                  value={procedureSearch}
                  onChange={(e) => setProcedureSearch(e.target.value)}
                />
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {filteredProcedures.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-muted-foreground">No procedures found.</p>
                  ) : (
                    filteredProcedures.map((p) => {
                      const selected = selectedProcedureIds.includes(p._id);
                      return (
                        <button
                          key={p._id}
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => toggleProcedure(p._id)}
                        >
                          <span className="min-w-0 flex-1">{p.name}</span>
                          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            {formatCurrency(typeof p.price === "number" ? p.price : 0)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{selected ? "Selected" : "Add"}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedProcedureIds.length > 0 && (
                  <div className="space-y-2 rounded-md border bg-slate-50/80 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Selected procedures</p>
                    {selectedProcedureIds.map((procId) => {
                      const proc = allProcedures.find((p) => p._id === procId);
                      const name = proc?.name ?? procId;
                      const price = typeof proc?.price === "number" ? proc.price : 0;
                      return (
                        <div key={procId} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 flex-1">{name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{formatCurrency(price)}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => toggleProcedure(procId)}>
                            Remove
                          </Button>
                        </div>
                      );
                    })}
                    <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                      <span>Procedures subtotal</span>
                      <span className="tabular-nums">{formatCurrency(procedureFeesTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Lab tests</Label>
                <p className="text-xs text-muted-foreground">Tests ordered for this visit (creates/updates lab bill).</p>
                <Input
                  placeholder="Search lab tests..."
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                />
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {filteredLabTests.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-muted-foreground">No lab tests found.</p>
                  ) : (
                    filteredLabTests.map((t) => {
                      const selected = selectedLabTestIds.includes(t._id);
                      return (
                        <button
                          key={t._id}
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => toggleLabTest(t._id)}
                        >
                          <span className="min-w-0 flex-1">{t.name}</span>
                          <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            {formatCurrency(typeof t.price === "number" ? t.price : 0)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{selected ? "Selected" : "Add"}</span>
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedLabTestIds.length > 0 && (
                  <div className="space-y-2 rounded-md border bg-slate-50/80 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Selected lab tests</p>
                    {selectedLabTestIds.map((labId) => {
                      const test = allLabTests.find((x) => x._id === labId);
                      const name = test?.name ?? labId;
                      const price = typeof test?.price === "number" ? test.price : 0;
                      return (
                        <div key={labId} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 flex-1">{name}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{formatCurrency(price)}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => toggleLabTest(labId)}>
                            Remove
                          </Button>
                        </div>
                      );
                    })}
                    <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                      <span>Lab tests subtotal</span>
                      <span className="tabular-nums">{formatCurrency(labFeesTotal)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Medicines</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMedicineRows((rows) => [...rows, emptyMedRow()]);
                      setMedSearchStates((prev) => [...prev, { suggestions: [], open: false }]);
                    }}
                  >
                    Add row
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter medicine name, optional line fee (estimate), and dosage / frequency / duration.
                </p>
                <div className="space-y-3">
                  {medicineRows.map((row, idx) => {
                    const ms = medSearchStates[idx] ?? { suggestions: [], open: false };
                    const updateMs = (patch: Partial<typeof ms>) =>
                      setMedSearchStates((prev) => {
                        const next = [...prev];
                        next[idx] = { ...ms, ...patch };
                        return next;
                      });
                    const handleMedSearch = (q: string) => {
                      // update row.medicineName as the single source of truth
                      setMedicineRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, medicineName: q, medicine: undefined } : r))
                      );
                      // debounce API call
                      if (medSearchTimers.current[idx]) clearTimeout(medSearchTimers.current[idx]);
                      if (!q.trim()) { updateMs({ suggestions: [], open: false }); return; }
                      updateMs({ open: true });
                      medSearchTimers.current[idx] = setTimeout(() => {
                        fetch(`/api/medicines?search=${encodeURIComponent(q.trim())}`, { cache: "no-store" })
                          .then((r) => r.json())
                          .then((data: MedicineOption[]) => updateMs({ suggestions: Array.isArray(data) ? data.slice(0, 10) : [] }))
                          .catch(() => {});
                      }, 250);
                    };
                    const pickMedicine = (med: MedicineOption) => {
                      setMedicineRows((rows) =>
                        rows.map((r, i) =>
                          i === idx ? { ...r, medicine: med._id, medicineName: med.name } : r
                        )
                      );
                      updateMs({ suggestions: [], open: false });
                    };
                    return (
                    <div key={idx} className="rounded-md border p-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {/* Medicine name with search dropdown */}
                        <div className="relative min-w-[8rem] flex-1">
                          <Input
                            placeholder="Search medicine or type name *"
                            value={row.medicineName}
                            onChange={(e) => handleMedSearch(e.target.value)}
                            onFocus={() => { if (row.medicineName.trim()) updateMs({ open: true }); }}
                            onBlur={() => setTimeout(() => updateMs({ open: false }), 150)}
                            className="w-full"
                            autoComplete="off"
                          />
                          {ms.open && ms.suggestions.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                              {ms.suggestions.map((med) => (
                                <button
                                  key={med._id}
                                  type="button"
                                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                  onMouseDown={(e) => { e.preventDefault(); pickMedicine(med); }}
                                >
                                  <span className="font-medium">{med.name}</span>
                                  {med.genericName && (
                                    <span className="text-xs text-muted-foreground">{med.genericName}</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          placeholder="Line fee"
                          value={row.lineFee}
                          onChange={(e) =>
                            setMedicineRows((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, lineFee: e.target.value } : r))
                            )
                          }
                          className="w-28 shrink-0"
                        />
                        {medicineRows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                              setMedicineRows((rows) => rows.filter((_, i) => i !== idx));
                              setMedSearchStates((prev) => prev.filter((_, i) => i !== idx));
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          placeholder="Dosage"
                          value={row.dosage}
                          onChange={(e) =>
                            setMedicineRows((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, dosage: e.target.value } : r))
                            )
                          }
                        />
                        <Input
                          placeholder="Frequency"
                          value={row.frequency}
                          onChange={(e) =>
                            setMedicineRows((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, frequency: e.target.value } : r))
                            )
                          }
                        />
                        <Input
                          placeholder="Duration"
                          value={row.duration}
                          onChange={(e) =>
                            setMedicineRows((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, duration: e.target.value } : r))
                            )
                          }
                        />
                      </div>
                      <Input
                        placeholder="Instructions (optional)"
                        value={row.instructions}
                        onChange={(e) =>
                          setMedicineRows((rows) =>
                            rows.map((r, i) => (i === idx ? { ...r, instructions: e.target.value } : r))
                          )
                        }
                      />
                    </div>
                    );
                  })}
                  <div className="flex justify-between rounded-md border bg-slate-50/80 px-3 py-2 text-sm font-semibold">
                    <span>Medicines subtotal {!medicineRows.some((r) => r.medicineName.trim()) && "(add names)"}</span>
                    <span className="tabular-nums">{formatCurrency(medicineFeesTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vNotes">Clinical notes</Label>
                <Textarea
                  id="vNotes"
                  rows={4}
                  placeholder="Consultation notes, advice, follow-up..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-y min-h-[80px]"
                />
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-blue-950">Fee summary</p>
                <div className="grid gap-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Consultation (OP)</span>
                    <span className="tabular-nums font-medium">{formatCurrency(consultationAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Procedures (catalog)</span>
                    <span className="tabular-nums font-medium">{formatCurrency(procedureFeesTotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Medicines (line fees)</span>
                    <span className="tabular-nums font-medium">{formatCurrency(medicineFeesTotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Lab tests (catalog)</span>
                    <span className="tabular-nums font-medium">{formatCurrency(labFeesTotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-blue-200 pt-2 text-base font-bold text-blue-950">
                    <span>Grand total (estimate)</span>
                    <span className="tabular-nums">{formatCurrency(grandFeesTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-blue-900/80">
                  Consultation is stored on the visit. Procedure and lab amounts follow master prices; medicine line fees are stored on the prescription.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={savingVisit}
              onClick={() => setVisitDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveVisit()} disabled={savingVisit}>
              {savingVisit ? "Saving..." : editingVisit ? "Save changes" : "Create visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
