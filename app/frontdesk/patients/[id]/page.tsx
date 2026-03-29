"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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

type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  paid?: boolean;
  status?: "waiting" | "served";
  opCharge?: number;
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

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FrontdeskPatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [vDate, setVDate] = useState(toDatetimeLocalValue(new Date().toISOString()));
  const [savingVisit, setSavingVisit] = useState(false);
  const [deletingVisitId, setDeletingVisitId] = useState<string | null>(null);
  const [allProcedures, setAllProcedures] = useState<ProcedureOption[]>([]);
  const [allLabTests, setAllLabTests] = useState<LabTestOption[]>([]);
  const [selectedProcedureIds, setSelectedProcedureIds] = useState<string[]>([]);
  const [selectedLabTestIds, setSelectedLabTestIds] = useState<string[]>([]);
  const [procedureSearch, setProcedureSearch] = useState("");
  const [labSearch, setLabSearch] = useState("");
  const [consultationFee, setConsultationFee] = useState("0");
  const [medicineRows, setMedicineRows] = useState<MedRow[]>([emptyMedRow()]);
  const [notes, setNotes] = useState("");
  const visitDateInputRef = useRef<HTMLInputElement>(null);
  /** Synchronous guard — `disabled={savingVisit}` alone can miss rapid double-clicks before re-render. */
  const visitSaveInFlightRef = useRef(false);

  const openVisitDatetimePicker = useCallback(() => {
    const el = visitDateInputRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.focus();
    }
  }, []);

  const loadPatient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to load");
      setPatient(data);
    } catch {
      setPatient(null);
      toast.error("Could not load patient");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadPatient();
    const interval = setInterval(loadPatient, 15000);
    const onFocus = () => loadPatient();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [id, loadPatient]);

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

  const visits = useMemo(() => patient?.visits ?? [], [patient]);

  const resetClinicalFields = () => {
    setSelectedProcedureIds([]);
    setSelectedLabTestIds([]);
    setMedicineRows([emptyMedRow()]);
    setNotes("");
  };

  const openCreateVisit = () => {
    setEditingVisit(null);
    setVDate(toDatetimeLocalValue(new Date().toISOString()));
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
    setVisitDialogOpen(true);
  };

  useEffect(() => {
    if (!visitDialogOpen || !patient?._id) return;
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
  }, [visitDialogOpen, editingVisit?._id, patient?._id]);

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

  const saveVisit = async () => {
    if (!patient?._id || visitSaveInFlightRef.current) return;
    visitSaveInFlightRef.current = true;
    setSavingVisit(true);
    const wasEditing = !!editingVisit?._id;
    try {
      const opCharge = consultationAmount;
      const payload = {
        visitDate: new Date(vDate).toISOString(),
        status: editingVisit?._id ? (editingVisit.status ?? "waiting") : "served",
        opCharge,
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
                  <TableHead>Receipt</TableHead>
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
                    <TableCell>{v.receiptNo ?? "-"}</TableCell>
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
      <Dialog
        open={visitDialogOpen}
        onOpenChange={(open) => {
          if (!open && savingVisit) return;
          setVisitDialogOpen(open);
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          onPointerDownOutside={(e) => savingVisit && e.preventDefault()}
          onEscapeKeyDown={(e) => savingVisit && e.preventDefault()}
        >
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle>{editingVisit ? "Edit visit data" : "Add visit data"}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Visit details, then procedures, medicines, and notes (same as consultation record).
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="vDate">Visit date & time</Label>
                <Input
                  ref={visitDateInputRef}
                  id="vDate"
                  type="datetime-local"
                  value={vDate}
                  onChange={(e) => setVDate(e.target.value)}
                  onClick={openVisitDatetimePicker}
                  className="cursor-pointer"
                />
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
                    onClick={() => setMedicineRows((rows) => [...rows, emptyMedRow()])}
                  >
                    Add row
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter medicine name, optional line fee (estimate), and dosage / frequency / duration.
                </p>
                <div className="space-y-3">
                  {medicineRows.map((row, idx) => (
                    <div key={idx} className="rounded-md border p-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Input
                          placeholder="Medicine name *"
                          value={row.medicineName}
                          onChange={(e) =>
                            setMedicineRows((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, medicineName: e.target.value } : r))
                            )
                          }
                          className="min-w-[8rem] flex-1"
                        />
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
                            onClick={() =>
                              setMedicineRows((rows) => rows.filter((_, i) => i !== idx))
                            }
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
                  ))}
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

