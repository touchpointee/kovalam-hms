"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintLayout } from "@/components/PrintLayout";

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";
const hospitalAddress = process.env.NEXT_PUBLIC_HOSPITAL_ADDRESS ?? "";
const hospitalPhone = process.env.NEXT_PUBLIC_HOSPITAL_PHONE ?? "";

type Patient = { _id: string; name: string; regNo: string; age: number; gender: string; phone: string };
type Visit = {
  _id: string;
  receiptNo: string;
  visitDate: string;
  opCharge: number;
  paid: boolean;
  patient?: Patient;
};

export default function VisitPage() {
  const searchParams = useSearchParams();
  const presetPatientId = searchParams.get("patientId");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [opCharge, setOpCharge] = useState(0);
  const [paid, setPaid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [createdVisit, setCreatedVisit] = useState<Visit | null>(null);

  useEffect(() => {
    if (presetPatientId && !selectedPatient) {
      fetch(`/api/patients/${presetPatientId}`)
        .then((res) => res.json())
        .then((data) => setSelectedPatient(data))
        .catch(() => {});
    }
  }, [presetPatientId, selectedPatient]);

  useEffect(() => {
    fetch("/api/settings/op-charge")
      .then((res) => res.json())
      .then((data) => setOpCharge(data.amount ?? 0))
      .catch(() => {});
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
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: selectedPatient._id, paid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setCreatedVisit(data);
      toast.success("Visit created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (createdVisit) {
    return (
      <PrintLayout title="OP Visit Receipt">
        <div className="space-y-4 print-only">
          <p className="font-semibold">{hospitalName}</p>
          {hospitalAddress && <p className="text-sm">{hospitalAddress}</p>}
          {hospitalPhone && <p className="text-sm">{hospitalPhone}</p>}
          <p className="mt-4 font-medium">Receipt No: {createdVisit.receiptNo}</p>
          <p className="text-sm">Date & Time: {format(new Date(createdVisit.visitDate), "dd MMM yyyy, HH:mm")}</p>
          <div className="mt-4 border-t pt-4">
            <p>Patient: {(createdVisit.patient as Patient)?.name}</p>
            <p>Reg No: {(createdVisit.patient as Patient)?.regNo} | Age: {(createdVisit.patient as Patient)?.age} | Gender: {(createdVisit.patient as Patient)?.gender}</p>
            <p className="font-medium mt-2">OP Charge: {formatCurrency(createdVisit.opCharge)}</p>
            <p>Status: {createdVisit.paid ? "Paid" : "Unpaid"}</p>
          </div>
          <p className="mt-6 text-sm">Thank you for visiting.</p>
        </div>
      </PrintLayout>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New OP Visit</h1>
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Search Patient</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Name, phone or reg no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), doSearch())}
          />
          <Button onClick={doSearch}>Search</Button>
        </CardContent>
        {results.length > 0 && (
          <CardContent className="border-t pt-4">
            {results.map((p) => (
              <button
                key={p._id}
                type="button"
                className="block w-full rounded border p-2 text-left hover:bg-muted"
                onClick={() => { setSelectedPatient(p); setResults([]); setSearch(""); }}
              >
                {p.name} — {p.regNo} — {p.phone}
              </button>
            ))}
          </CardContent>
        )}
      </Card>
      {selectedPatient && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Patient & OP Charge</CardTitle>
              <CardDescription>Current OP charge: {formatCurrency(opCharge)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p><strong>{selectedPatient.name}</strong> — {selectedPatient.regNo} | {selectedPatient.age} yrs | {selectedPatient.gender}</p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="paid"
                  checked={paid}
                  onChange={(e) => setPaid(e.target.checked)}
                />
                <Label htmlFor="paid">Paid</Label>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Create Visit</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={createVisit} disabled={loading}>
                {loading ? "Creating..." : "Create Visit"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
