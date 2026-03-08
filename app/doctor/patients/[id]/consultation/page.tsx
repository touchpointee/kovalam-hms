"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Patient = {
  _id: string;
  regNo: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  bloodGroup?: string;
};
type Visit = { _id: string; visitDate: string };
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
  procedures: string[];
  updatedAt?: string;
};
type Procedure = { _id: string; name: string };
type HistoryVisit = Visit & {
  prescription?: Prescription;
  procedureBills?: unknown[];
  medicineBills?: unknown[];
};

const FREQUENCIES = ["OD", "BD", "TID", "QID", "SOS"];

export default function ConsultationPage() {
  const params = useParams();
  const id = params.id as string;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [latestVisitId, setLatestVisitId] = useState<string | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSavedAt, setNotesSavedAt] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<PrescriptionMed[]>([]);
  const [procedureOrders, setProcedureOrders] = useState<string[]>([]);
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [medicineResults, setMedicineResults] = useState<{ _id: string; name: string }[]>([]);
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

  useEffect(() => {
    if (!id) return;
    fetch(`/api/patients/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setPatient(data);
        const v = (data.visits ?? []) as Visit[];
        setVisits(v);
        const latestId = v.length > 0 ? v[0]._id : null;
        if (latestId) setLatestVisitId(latestId);
        const pres = (data.prescriptions ?? []).find((p: Prescription) => p.visit === latestId) ?? null;
        setPrescription(pres);
        setNotes(pres?.notes ?? "");
        setMedicines(pres?.medicines ?? []);
        setProcedureOrders((pres?.procedures ?? []).map((p: { _id?: string } | string) => (typeof p === "string" ? p : (p as { _id?: string })._id ?? "")));
        setHistory(v.map((visit: Visit) => ({
          ...visit,
          prescription: (data.prescriptions ?? []).find((p: Prescription) => p.visit === visit._id),
          procedureBills: (data.procedureBills ?? []).filter((b: { visit?: string }) => b.visit === visit._id),
          medicineBills: (data.medicineBills ?? []).filter((b: { visit?: string }) => b.visit === visit._id),
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch("/api/procedures").then((res) => res.json()).then(setAllProcedures).catch(() => setAllProcedures([]));
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
          medicines: prescription?.medicines ?? [],
          procedures: prescription?.procedures ?? procedureOrders,
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

  const addMedicine = () => {
    if (!newMed.medicineName.trim()) return;
    setMedicines((prev) => [...prev, { ...newMed, medicine: newMed.medicineId || undefined }]);
    setNewMed({ medicineName: "", medicineId: "", dosage: "", frequency: "", duration: "", instructions: "" });
    setMedicineSearch("");
    setMedicineResults([]);
  };

  const removeMedicine = (idx: number) => setMedicines((prev) => prev.filter((_, i) => i !== idx));

  const savePrescription = async () => {
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
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPrescription(data);
      toast.success("Prescription saved");
    } catch {
      toast.error("Failed to save prescription");
    } finally {
      setSaving(false);
    }
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
          medicines: prescription?.medicines ?? medicines,
          procedures: procedureOrders,
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

  const toggleProcedure = (procId: string) => {
    setProcedureOrders((prev) =>
      prev.includes(procId) ? prev.filter((p) => p !== procId) : [...prev, procId]
    );
  };

  if (loading || !patient) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Consultation</h1>
      <Card>
        <CardHeader>
          <CardTitle>Patient</CardTitle>
          <CardDescription className="sr-only">Info</CardDescription>
        </CardHeader>
        <CardContent>
          <p><strong>{patient.name}</strong> — {patient.regNo} | Age: {patient.age} | Gender: {patient.gender}</p>
          {patient.bloodGroup && <p>Blood Group: {patient.bloodGroup}</p>}
          <p>Phone: {patient.phone}</p>
        </CardContent>
      </Card>
      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="prescription">Prescription (Medicines)</TabsTrigger>
          <TabsTrigger value="procedures">Procedures</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="notes">
          <Card>
            <CardContent className="pt-4">
              <Textarea
                rows={8}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Consultation notes..."
              />
              <div className="mt-2 flex items-center gap-2">
                <Button onClick={saveNotes} disabled={saving}>{saving ? "Saving..." : "Save Notes"}</Button>
                {notesSavedAt && (
                  <span className="text-muted-foreground text-sm">Last saved: {format(new Date(notesSavedAt), "HH:mm")}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="prescription">
          <Card>
            <CardHeader><CardTitle>Add Medicine</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label>Search medicine</Label>
                <Input
                  value={medicineSearch}
                  onChange={(e) => { setMedicineSearch(e.target.value); setNewMed((m) => ({ ...m, medicineName: e.target.value })); }}
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
                <div><Label>Dosage</Label><Input value={newMed.dosage} onChange={(e) => setNewMed((m) => ({ ...m, dosage: e.target.value }))} placeholder="e.g. 500mg" /></div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={newMed.frequency} onValueChange={(v) => setNewMed((m) => ({ ...m, frequency: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Duration</Label><Input value={newMed.duration} onChange={(e) => setNewMed((m) => ({ ...m, duration: e.target.value }))} placeholder="e.g. 5 days" /></div>
                <div><Label>Instructions</Label><Input value={newMed.instructions} onChange={(e) => setNewMed((m) => ({ ...m, instructions: e.target.value }))} /></div>
              </div>
              <Button type="button" onClick={addMedicine}>Add to Prescription</Button>
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader><CardTitle>Current prescription</CardTitle></CardHeader>
            <CardContent>
              {medicines.length === 0 ? (
                <p className="text-muted-foreground text-sm">No medicines added.</p>
              ) : (
                <ul className="space-y-2">
                  {medicines.map((m, i) => (
                    <li key={i} className="flex items-center justify-between rounded border p-2">
                      <span>{m.medicineName} — {m.dosage} {m.frequency} {m.duration}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeMedicine(i)}>Remove</Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button className="mt-2" onClick={savePrescription} disabled={saving}>
                {saving ? "Saving..." : "Save Prescription"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="procedures">
          <Card>
            <CardHeader><CardTitle>Order procedures</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {allProcedures.map((proc) => (
                  <Badge
                    key={proc._id}
                    variant={procedureOrders.includes(proc._id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleProcedure(proc._id)}
                  >
                    {proc.name}
                  </Badge>
                ))}
              </div>
              <Button className="mt-4" onClick={saveProcedureOrders} disabled={saving}>
                {saving ? "Saving..." : "Save Procedure Orders"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Past visits</CardTitle></CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No past visits.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((visit) => (
                    <details key={visit._id} className="rounded border p-3">
                      <summary className="cursor-pointer font-medium">
                        {format(new Date(visit.visitDate), "dd MMM yyyy, HH:mm")}
                      </summary>
                      <div className="mt-2 pl-4 text-sm">
                        {(visit as HistoryVisit)?.prescription?.notes && (
                          <p><strong>Notes:</strong> {(visit as HistoryVisit)?.prescription?.notes}</p>
                        )}
                        {((visit as HistoryVisit)?.prescription?.medicines?.length ?? 0) > 0 && (
                          <p><strong>Medicines:</strong> {(visit as HistoryVisit)?.prescription?.medicines?.map((m) => m.medicineName).join(", ")}</p>
                        )}
                        <p><strong>Procedure bills:</strong> {((visit as HistoryVisit)?.procedureBills?.length ?? 0)}</p>
                        <p><strong>Medicine bills:</strong> {((visit as HistoryVisit)?.medicineBills?.length ?? 0)}</p>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
