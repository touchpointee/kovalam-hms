"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn, formatCurrency } from "@/lib/utils";
import { Search } from "lucide-react";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Patient = {
  _id: string;
  regNo: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  bloodGroup?: string;
};
type Visit = {
  _id: string;
  visitDate: string;
  status?: "waiting" | "served";
  receiptNo?: string;
  paid?: boolean;
  opCharge?: number;
};
type PrescriptionMed = {
  medicine?: string;
  medicineName: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
};
type Prescription = {
  _id: string;
  visit: string;
  notes?: string;
  medicines: PrescriptionMed[];
  procedures?: (string | { _id: string; name?: string })[];
  labTests?: (string | { _id: string; name?: string })[];
  updatedAt?: string;
  doctor?: { name?: string } | string;
};
type Procedure = { _id: string; name: string };
type LabTest = { _id: string; name: string };
type HistoryProcedureBill = {
  _id: string;
  grandTotal: number;
  billedAt?: string;
  items?: Array<{
    procedureName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
};
type HistoryMedicineBill = {
  _id: string;
  grandTotal: number;
  billedAt?: string;
  items?: Array<{
    medicineName: string;
    batchNo: string;
    quantity: number;
    sellingPrice: number;
    totalPrice: number;
  }>;
};
type HistoryVisit = Visit & {
  prescription?: Prescription;
  procedureBills?: HistoryProcedureBill[];
  medicineBills?: HistoryMedicineBill[];
};

function resolveProcedureLabels(
  procedures: Prescription["procedures"] | undefined,
  catalog: Procedure[]
): string[] {
  if (!procedures?.length) return [];
  return procedures.map((p) => {
    if (typeof p === "string") return catalog.find((x) => x._id === p)?.name ?? p;
    return p.name ?? catalog.find((x) => x._id === p._id)?.name ?? p._id;
  });
}

function resolveLabTestLabels(
  labTests: Prescription["labTests"] | undefined,
  catalog: LabTest[]
): string[] {
  if (!labTests?.length) return [];
  return labTests.map((t) => {
    if (typeof t === "string") return catalog.find((x) => x._id === t)?.name ?? t;
    return t.name ?? catalog.find((x) => x._id === t._id)?.name ?? t._id;
  });
}

function prescriptionDoctorName(doc: Prescription["doctor"]): string | null {
  if (!doc) return null;
  if (typeof doc === "string") return doc;
  return doc.name ?? null;
}

export default function ConsultationPage() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isAdminConsultation = pathname.startsWith("/admin/patients/");
  const patientVisitBase = isAdminConsultation ? `/admin/patients/${id}` : `/doctor/patients/${id}`;
  const pharmacyBillingBase = isAdminConsultation ? "/admin/pharmacy/billing" : "/pharmacy/billing";
  const visitIdFromQuery = searchParams.get("visitId");
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [latestVisitId, setLatestVisitId] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSavedAt, setNotesSavedAt] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<PrescriptionMed[]>([]);
  const [procedureOrders, setProcedureOrders] = useState<string[]>([]);
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]);
  const [labTestOrders, setLabTestOrders] = useState<string[]>([]);
  const [allLabTests, setAllLabTests] = useState<LabTest[]>([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [medicineResults, setMedicineResults] = useState<{ _id: string; name: string }[]>([]);
  const [frequencies, setFrequencies] = useState<{ value: string; label: string }[]>([]);
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newMed, setNewMed] = useState({
    medicineName: "",
    medicineId: "",
    dosage: "",
    frequency: "",
    duration: "",
    instructions: "",
  });
  const [visitError, setVisitError] = useState<string | null>(null);
  const [serving, setServing] = useState(false);
  const [procedureSearch, setProcedureSearch] = useState("");
  const [procedurePickerOpen, setProcedurePickerOpen] = useState(false);
  const procedurePickerRef = useRef<HTMLDivElement>(null);
  const [labTestSearch, setLabTestSearch] = useState("");
  const [labTestPickerOpen, setLabTestPickerOpen] = useState(false);
  const labTestPickerRef = useRef<HTMLDivElement>(null);
  const [historyModalVisit, setHistoryModalVisit] = useState<HistoryVisit | null>(null);

  const loadConsultationData = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/patients/${id}`, { cache: "no-store" });
    const data = await res.json();
    setPatient(data);
    const v = (data.visits ?? []) as Visit[];
    setVisits(v);
    if (!visitIdFromQuery) {
      setLatestVisitId(null);
      setVisitError("Visit is required. Open consultation from the visit list.");
      return;
    }
    const hasRequestedVisit = v.some((visit) => visit._id === visitIdFromQuery);
    if (!hasRequestedVisit) {
      setLatestVisitId(null);
      setVisitError("Selected visit was not found for this patient.");
      return;
    }
    const resolvedVisitId = visitIdFromQuery;
    setVisitError(null);
    setLatestVisitId(resolvedVisitId);
    const pres = (data.prescriptions ?? []).find((p: Prescription) => p.visit === resolvedVisitId) ?? null;
    setPrescription(pres);
    setNotes(pres?.notes ?? "");
    setMedicines(pres?.medicines ?? []);
    setProcedureOrders((pres?.procedures ?? []).map((p: { _id?: string } | string) => (typeof p === "string" ? p : (p as { _id?: string })._id ?? "")));
    setLabTestOrders((pres?.labTests ?? []).map((t: { _id?: string } | string) => (typeof t === "string" ? t : (t as { _id?: string })._id ?? "")));
    setHistory(v.map((visit: Visit) => ({
      ...visit,
      prescription: (data.prescriptions ?? []).find((p: Prescription) => p.visit === visit._id),
      procedureBills: (data.procedureBills ?? []).filter((b: { visit?: string }) => b.visit === visit._id),
      medicineBills: (data.medicineBills ?? []).filter((b: { visit?: string }) => b.visit === visit._id),
    })));
  }, [id, visitIdFromQuery]);

  useEffect(() => {
    if (!id) return;
    loadConsultationData()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, visitIdFromQuery, loadConsultationData]);

  useEffect(() => {
    fetch("/api/procedures", { cache: "no-store" }).then((res) => res.json()).then(setAllProcedures).catch(() => setAllProcedures([]));
    fetch("/api/lab-tests", { cache: "no-store" }).then((res) => res.json()).then(setAllLabTests).catch(() => setAllLabTests([]));
    fetch("/api/medicine-frequencies", { cache: "no-store" }).then((res) => res.json()).then(list => setFrequencies(Array.isArray(list) ? list.map((f: any) => ({ value: f.name, label: f.name })) : [])).catch(() => setFrequencies([]));
  }, []);

  useEffect(() => {
    if (!medicineSearch.trim()) { setMedicineResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/medicines?search=${encodeURIComponent(medicineSearch)}`)
        .then((res) => res.json())
        .then((list) => setMedicineResults(list.slice ? list.slice(0, 8) : []))
        .catch(() => setMedicineResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [medicineSearch]);

  const filteredProcedures = useMemo(() => {
    const q = procedureSearch.trim().toLowerCase();
    if (!q) return allProcedures;
    return allProcedures.filter((p) => p.name.toLowerCase().includes(q));
  }, [allProcedures, procedureSearch]);

  const filteredLabTests = useMemo(() => {
    const q = labTestSearch.trim().toLowerCase();
    if (!q) return allLabTests;
    return allLabTests.filter((t) => t.name.toLowerCase().includes(q));
  }, [allLabTests, labTestSearch]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (procedurePickerRef.current && !procedurePickerRef.current.contains(e.target as Node)) {
        setProcedurePickerOpen(false);
      }
      if (labTestPickerRef.current && !labTestPickerRef.current.contains(e.target as Node)) {
        setLabTestPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProcedurePickerOpen(false);
        setLabTestPickerOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const saveNotes = async () => {
    if (!latestVisitId || !id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: id,
          visitId: latestVisitId,
          notes,
          medicines,
          procedures: procedureOrders,
          labTests: labTestOrders,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setNotesSavedAt(new Date().toISOString());
      toast.success("Notes saved");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const saveMedicines = useCallback(
    async (nextMedicines: PrescriptionMed[], successMessage: string) => {
      if (!latestVisitId || !id) return false;
      setSaving(true);
      try {
        const res = await fetch("/api/prescriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: id,
            visitId: latestVisitId,
            notes: prescription?.notes ?? notes,
            medicines: nextMedicines,
            procedures: procedureOrders,
            labTests: labTestOrders,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setPrescription(data);
        setMedicines(data?.medicines ?? nextMedicines);
        toast.success(successMessage);
        return true;
      } catch {
        toast.error("Failed to save prescription");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, latestVisitId, prescription?.notes, notes, procedureOrders, labTestOrders]
  );

  const addMedicine = async () => {
    if (!newMed.medicineName.trim()) return;
    const nextMedicines = [...medicines, { ...newMed, medicine: newMed.medicineId || undefined }];
    const saved = await saveMedicines(nextMedicines, "Medicine added to prescription");
    if (!saved) return;
    setNewMed({ medicineName: "", medicineId: "", dosage: "", frequency: "", duration: "", instructions: "" });
    setMedicineSearch("");
    setMedicineResults([]);
  };

  const removeMedicine = async (idx: number) => {
    const nextMedicines = medicines.filter((_, i) => i !== idx);
    await saveMedicines(nextMedicines, "Medicine removed from prescription");
  };

  const saveProcedureOrders = async () => {
    if (!latestVisitId || !id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: id,
          visitId: latestVisitId,
          notes: prescription?.notes ?? notes,
          medicines,
          procedures: procedureOrders,
          labTests: labTestOrders,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Procedure orders saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const selectedVisit = visits.find((v) => v._id === latestVisitId) ?? null;
  const isServed = (selectedVisit?.status ?? "waiting") === "served";

  const addProcedureOrder = (procId: string) => {
    if (isServed) return;
    setProcedureOrders((prev) => (prev.includes(procId) ? prev : [...prev, procId]));
    setProcedureSearch("");
    setProcedurePickerOpen(false);
  };

  const removeProcedureOrder = (procId: string) => {
    if (isServed) return;
    setProcedureOrders((prev) => prev.filter((p) => p !== procId));
  };

  const addLabTestOrder = (labTestId: string) => {
    if (isServed) return;
    setLabTestOrders((prev) => (prev.includes(labTestId) ? prev : [...prev, labTestId]));
    setLabTestSearch("");
    setLabTestPickerOpen(false);
  };

  const removeLabTestOrder = (labTestId: string) => {
    if (isServed) return;
    setLabTestOrders((prev) => prev.filter((t) => t !== labTestId));
  };

  const saveLabTestOrders = async () => {
    if (!latestVisitId || !id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: id,
          visitId: latestVisitId,
          notes: prescription?.notes ?? notes,
          medicines,
          procedures: procedureOrders,
          labTests: labTestOrders,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Lab test orders saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const completeServe = async () => {
    if (!latestVisitId) return;
    setServing(true);
    try {
      const res = await fetch("/api/visits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId: latestVisitId, status: "served" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed");
      await loadConsultationData();
      toast.success("Visit marked as served");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete serve");
    } finally {
      setServing(false);
    }
  };

  if (loading || !patient) {
    return (
      <div className="op-page">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!latestVisitId) {
    return (
      <div className="op-page space-y-6">
        <div className="space-y-1">
          <h1 className="op-title">Consultation</h1>
          <p className="op-subtitle">Select a visit to continue</p>
          {visitError && <p className="text-sm text-muted-foreground">{visitError}</p>}
        </div>

        <div className="op-highlight">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">Current Patient</p>
          <p className="mt-1 text-xl font-semibold">
            {patient.name} ({patient.regNo})
          </p>
          <p className="mt-1 text-xs text-blue-100">{visits.length} visit(s) in history</p>
        </div>

        <Card className="rounded-2xl border-emerald-100">
          <CardHeader>
            <CardTitle>Visit History</CardTitle>
            <CardDescription className="sr-only">Choose a visit</CardDescription>
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
                      <TableCell>
                        {typeof v.paid === "boolean" ? (v.paid ? "Yes" : "No") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {v.status ?? "waiting"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`${patientVisitBase}/consultation?visitId=${v._id}`}>
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="op-page">
      <div>
        <h1 className="op-title">Consultation</h1>
        <p className="op-subtitle">Review patient details, notes, medicines, and procedures</p>
        {visitError && <p className="mt-1 text-sm text-destructive">{visitError}</p>}
        {latestVisitId && (
          <p className="mt-1 text-sm">
            <a href={`${pharmacyBillingBase}/${latestVisitId}`} className="text-blue-700 hover:underline">
              Open medicine billing for this visit
            </a>
          </p>
        )}
      </div>
      <div className="op-highlight">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">Current Patient</p>
        <p className="mt-1 text-xl font-semibold">{patient.name} ({patient.regNo})</p>
        <p className="mt-1 text-xs text-blue-100">
          Visit: {selectedVisit?.receiptNo ?? latestVisitId} | Status: {(selectedVisit?.status ?? "waiting")}
        </p>
      </div>
      <Card className="rounded-2xl border-emerald-100">
        <CardHeader>
          <CardTitle>Patient</CardTitle>
          <CardDescription className="sr-only">Info</CardDescription>
        </CardHeader>
        <CardContent>
          <p><strong>{patient.name}</strong> — {patient.regNo} | Age: {patient.age} | Gender: {patient.gender}</p>
          {patient.bloodGroup && <p>Blood Group: {patient.bloodGroup}</p>}
          <p>Phone: {patient.phone}</p>
          <div className="mt-3">
            {isServed ? (
              <p className="text-sm font-medium text-blue-700">This visit is served. Editing is disabled.</p>
            ) : (
              <Button onClick={completeServe} disabled={serving}>
                {serving ? "Completing..." : "Complete Serve"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="notes">
        <TabsList className="grid w-full max-w-4xl grid-cols-5">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="prescription">Prescription (Medicines)</TabsTrigger>
          <TabsTrigger value="procedures">Procedures</TabsTrigger>
          <TabsTrigger value="lab-tests">Lab Tests</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          <Card className="rounded-2xl border-emerald-100">
            <CardContent className="pt-4">
              <Textarea
                rows={8}
                value={notes}
                disabled={isServed}
                onChange={(e) => setNotes(e.target.value)}
                className="op-input"
                placeholder="Consultation notes..."
              />
              <div className="mt-2 flex items-center gap-2">
                <Button className="op-button-primary" onClick={saveNotes} disabled={saving || isServed}>{saving ? "Saving..." : "Save Notes"}</Button>
                {notesSavedAt && (
                  <span className="text-muted-foreground text-sm">Last saved: {format(new Date(notesSavedAt), "HH:mm")}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="prescription">
          <Card className="rounded-2xl border-emerald-100">
            <CardHeader><CardTitle>Add Medicine</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label>Search medicine</Label>
                <Input
                  value={medicineSearch}
                  disabled={isServed}
                  onChange={(e) => { setMedicineSearch(e.target.value); setNewMed((m) => ({ ...m, medicineName: e.target.value })); }}
                  className="op-input"
                  placeholder="Type to search..."
                />
                {medicineResults.length > 0 && (
                  <ul className="mt-1 rounded border bg-background py-1">
                    {medicineResults.map((m) => (
                      <li key={m._id}>
                        <button
                          type="button"
                          className="w-full px-3 py-1 text-left hover:bg-muted"
                          onClick={() => {
                            setNewMed((prev) => ({ ...prev, medicineId: m._id, medicineName: m.name }));
                            setMedicineSearch(m.name);
                            setMedicineResults([]);
                          }}
                        >
                          {m.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Dosage</Label><Input className="op-input" value={newMed.dosage} disabled={isServed} onChange={(e) => setNewMed((m) => ({ ...m, dosage: e.target.value }))} placeholder="e.g. 500mg" /></div>
                <div>
                  <Label>Frequency</Label>
                  <SearchableCombobox
                    options={frequencies}
                    value={newMed.frequency}
                    disabled={isServed}
                    onValueChange={(val) => setNewMed((m) => ({ ...m, frequency: val }))}
                    placeholder="OD / BD"
                    searchPlaceholder="Search frequency…"
                    emptyMessage="No exact match."
                    triggerClassName="w-full"
                  />
                </div>
                <div>
                  <Label>Duration</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      className="op-input pr-12"
                      value={newMed.duration.replace(/[^0-9]/g, "")}
                      disabled={isServed}
                      onChange={(e) => setNewMed((m) => ({ ...m, duration: e.target.value ? `${e.target.value} days` : "" }))}
                      placeholder="e.g. 5"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      days
                    </span>
                  </div>
                </div>
                <div><Label>Instructions</Label><Input className="op-input" value={newMed.instructions} disabled={isServed} onChange={(e) => setNewMed((m) => ({ ...m, instructions: e.target.value }))} /></div>
              </div>
              <Button className="op-button-primary" type="button" onClick={addMedicine} disabled={saving || isServed}>
                {saving ? "Saving..." : "Add to Prescription"}
              </Button>
            </CardContent>
          </Card>
          <Card className="mt-4 rounded-2xl border-emerald-100">
            <CardHeader><CardTitle>Current prescription</CardTitle></CardHeader>
            <CardContent>
              {medicines.length === 0 ? (
                <p className="text-muted-foreground text-sm">No medicines added.</p>
              ) : (
                <ul className="space-y-2">
                  {medicines.map((m, i) => (
                    <li key={i} className="flex items-center justify-between rounded border p-2">
                      <span>{m.medicineName} — {m.dosage} {m.frequency} {m.duration}</span>
                      <Button variant="ghost" size="sm" disabled={saving || isServed} onClick={() => removeMedicine(i)}>Remove</Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="procedures">
          <Card className="rounded-2xl border-emerald-100">
            <CardHeader>
              <CardTitle>Order procedures</CardTitle>
              <CardDescription className="text-sm">
                Search by name and select a procedure to add. Remove from the list below if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div ref={procedurePickerRef} className="relative">
                <Label htmlFor="procedure-search" className="sr-only">
                  Search procedures
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="procedure-search"
                    className="op-input pl-9"
                    placeholder="Search procedures to add…"
                    value={procedureSearch}
                    disabled={isServed}
                    onChange={(e) => setProcedureSearch(e.target.value)}
                    onFocus={() => !isServed && setProcedurePickerOpen(true)}
                    autoComplete="off"
                  />
                </div>
                {procedurePickerOpen && !isServed && (
                  <div
                    className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-background py-1 shadow-md"
                    role="listbox"
                  >
                    {filteredProcedures.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No procedures match your search.</p>
                    ) : (
                      filteredProcedures.map((proc) => {
                        const added = procedureOrders.includes(proc._id);
                        return (
                          <button
                            key={proc._id}
                            type="button"
                            role="option"
                            aria-selected={added}
                            disabled={added}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                              added && "cursor-not-allowed opacity-60"
                            )}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addProcedureOrder(proc._id)}
                          >
                            <span>{proc.name}</span>
                            {added ? (
                              <span className="text-xs text-muted-foreground">Added</span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {procedureOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No procedures ordered yet.</p>
              ) : (
                <ul className="space-y-2">
                  {procedureOrders.map((procId) => {
                    const name = allProcedures.find((p) => p._id === procId)?.name ?? procId;
                    return (
                      <li
                        key={procId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/30 px-3 py-2 text-sm"
                      >
                        <span>{name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isServed}
                          onClick={() => removeProcedureOrder(procId)}
                        >
                          Remove
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Button className="op-button-primary" onClick={saveProcedureOrders} disabled={saving || isServed}>
                {saving ? "Saving..." : "Save Procedure Orders"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="lab-tests">
          <Card className="rounded-2xl border-emerald-100">
            <CardHeader>
              <CardTitle>Order lab tests</CardTitle>
              <CardDescription className="text-sm">
                Search by name and select lab tests to add. Remove from the list below if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div ref={labTestPickerRef} className="relative">
                <Label htmlFor="lab-test-search" className="sr-only">
                  Search lab tests
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lab-test-search"
                    className="op-input pl-9"
                    placeholder="Search lab tests to add…"
                    value={labTestSearch}
                    disabled={isServed}
                    onChange={(e) => setLabTestSearch(e.target.value)}
                    onFocus={() => !isServed && setLabTestPickerOpen(true)}
                    autoComplete="off"
                  />
                </div>
                {labTestPickerOpen && !isServed && (
                  <div
                    className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border bg-background py-1 shadow-md"
                    role="listbox"
                  >
                    {filteredLabTests.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No lab tests match your search.</p>
                    ) : (
                      filteredLabTests.map((test) => {
                        const added = labTestOrders.includes(test._id);
                        return (
                          <button
                            key={test._id}
                            type="button"
                            role="option"
                            aria-selected={added}
                            disabled={added}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                              added && "cursor-not-allowed opacity-60"
                            )}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => addLabTestOrder(test._id)}
                          >
                            <span>{test.name}</span>
                            {added ? (
                              <span className="text-xs text-muted-foreground">Added</span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {labTestOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lab tests ordered yet.</p>
              ) : (
                <ul className="space-y-2">
                  {labTestOrders.map((labTestId) => {
                    const name = allLabTests.find((t) => t._id === labTestId)?.name ?? labTestId;
                    return (
                      <li
                        key={labTestId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/30 px-3 py-2 text-sm"
                      >
                        <span>{name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isServed}
                          onClick={() => removeLabTestOrder(labTestId)}
                        >
                          Remove
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Button className="op-button-primary" onClick={saveLabTestOrders} disabled={saving || isServed}>
                {saving ? "Saving..." : "Save Lab Tests"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card className="rounded-2xl border-emerald-100">
            <CardHeader>
              <CardTitle>Past visits</CardTitle>
              <CardDescription className="text-sm">
                Select a visit to open the full consultation and billing details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No past visits.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((visit) => (
                    <li key={visit._id}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-emerald-100 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setHistoryModalVisit(visit)}
                      >
                        <span className="font-medium">
                          {format(new Date(visit.visitDate), "dd MMM yyyy, HH:mm")}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Receipt {visit.receiptNo ?? "—"}
                          {visit.status ? ` · ${visit.status}` : ""}
                          {typeof visit.paid === "boolean" ? ` · Paid: ${visit.paid ? "Yes" : "No"}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!historyModalVisit}
        onOpenChange={(open) => {
          if (!open) setHistoryModalVisit(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {historyModalVisit ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Visit — {format(new Date(historyModalVisit.visitDate), "dd MMM yyyy, HH:mm")}
                </DialogTitle>
                <DialogDescription className="text-left text-sm">
                  Receipt: {historyModalVisit.receiptNo ?? "—"} · Status: {historyModalVisit.status ?? "—"} · Paid:{" "}
                  {typeof historyModalVisit.paid === "boolean" ? (historyModalVisit.paid ? "Yes" : "No") : "—"} · OP fee:{" "}
                  {formatCurrency(historyModalVisit.opCharge ?? 0)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 text-sm">
                <section className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">Consultation & prescription</h3>
                  {historyModalVisit.prescription ? (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                      {prescriptionDoctorName(historyModalVisit.prescription.doctor) && (
                        <p>
                          <span className="font-medium text-foreground">Doctor: </span>
                          {prescriptionDoctorName(historyModalVisit.prescription.doctor)}
                        </p>
                      )}
                      {historyModalVisit.prescription.notes ? (
                        <div>
                          <p className="font-medium text-foreground">Notes</p>
                          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                            {historyModalVisit.prescription.notes}
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No clinical notes for this visit.</p>
                      )}
                      {(historyModalVisit.prescription.medicines?.length ?? 0) > 0 ? (
                        <div>
                          <p className="mb-2 font-medium text-foreground">Medicines</p>
                          <ul className="space-y-2">
                            {historyModalVisit.prescription.medicines.map((m, i) => (
                              <li
                                key={`${m.medicineName}-${i}`}
                                className="rounded border bg-background px-3 py-2 text-muted-foreground"
                              >
                                <span className="font-medium text-foreground">{m.medicineName}</span>
                                {[m.dosage, m.frequency, m.duration].filter(Boolean).length > 0 && (
                                  <span className="block text-xs">
                                    {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                                {m.instructions ? (
                                  <span className="mt-1 block text-xs">Instructions: {m.instructions}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No medicines on prescription.</p>
                      )}
                      {resolveProcedureLabels(historyModalVisit.prescription.procedures, allProcedures).length >
                      0 ? (
                        <div>
                          <p className="mb-1 font-medium text-foreground">Procedures ordered</p>
                          <ul className="list-inside list-disc text-muted-foreground">
                            {resolveProcedureLabels(
                              historyModalVisit.prescription.procedures,
                              allProcedures
                            ).map((name, idx) => (
                              <li key={`${name}-${idx}`}>{name}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No procedures ordered on prescription.</p>
                      )}
                      {resolveLabTestLabels(historyModalVisit.prescription.labTests, allLabTests).length >
                      0 ? (
                        <div>
                          <p className="mb-1 font-medium text-foreground">Lab tests ordered</p>
                          <ul className="list-inside list-disc text-muted-foreground">
                            {resolveLabTestLabels(
                              historyModalVisit.prescription.labTests,
                              allLabTests
                            ).map((name, idx) => (
                              <li key={`${name}-${idx}`}>{name}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No lab tests ordered on prescription.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No prescription record for this visit.</p>
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">Procedure billing</h3>
                  {(historyModalVisit.procedureBills?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground">No procedure bills for this visit.</p>
                  ) : (
                    historyModalVisit.procedureBills?.map((bill) => (
                      <div
                        key={bill._id}
                        className="space-y-2 rounded-lg border bg-muted/30 p-3"
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            Billed:{" "}
                            {bill.billedAt
                              ? format(new Date(bill.billedAt), "dd MMM yyyy, HH:mm")
                              : "—"}
                          </span>
                          <span className="font-medium text-foreground">
                            Total {formatCurrency(bill.grandTotal ?? 0)}
                          </span>
                        </div>
                        {(bill.items?.length ?? 0) > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Procedure</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Unit</TableHead>
                                <TableHead className="text-right">Line</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bill.items!.map((line, idx) => (
                                <TableRow key={`${bill._id}-${idx}`}>
                                  <TableCell>{line.procedureName}</TableCell>
                                  <TableCell className="text-right">{line.quantity}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(line.unitPrice)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(line.totalPrice)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : null}
                      </div>
                    ))
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">Medicine billing</h3>
                  {(historyModalVisit.medicineBills?.length ?? 0) === 0 ? (
                    <p className="text-muted-foreground">No medicine bills for this visit.</p>
                  ) : (
                    historyModalVisit.medicineBills?.map((bill) => (
                      <div
                        key={bill._id}
                        className="space-y-2 rounded-lg border bg-muted/30 p-3"
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            Billed:{" "}
                            {bill.billedAt
                              ? format(new Date(bill.billedAt), "dd MMM yyyy, HH:mm")
                              : "—"}
                          </span>
                          <span className="font-medium text-foreground">
                            Total {formatCurrency(bill.grandTotal ?? 0)}
                          </span>
                        </div>
                        {(bill.items?.length ?? 0) > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Medicine</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Line</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bill.items!.map((line, idx) => (
                                <TableRow key={`${bill._id}-${idx}`}>
                                  <TableCell>{line.medicineName}</TableCell>
                                  <TableCell className="text-xs">{line.batchNo}</TableCell>
                                  <TableCell className="text-right">{line.quantity}</TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(line.sellingPrice)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(line.totalPrice)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : null}
                      </div>
                    ))
                  )}
                </section>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
