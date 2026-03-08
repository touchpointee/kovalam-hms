"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PrintLayout } from "@/components/PrintLayout";

type Patient = { _id: string; name: string; regNo: string };
type Visit = { _id: string; visitDate: string; receiptNo: string };
type Procedure = { _id: string; name: string; price: number };
type BillItem = { procedureId: string; procedureName: string; quantity: number; unitPrice: number; totalPrice: number };
type ProcedureBill = {
  _id: string;
  patient?: Patient;
  visit?: Visit;
  items: BillItem[];
  grandTotal: number;
};

export default function ProcedureBillingPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<string>("");
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [items, setItems] = useState<BillItem[]>([]);
  const [newProcId, setNewProcId] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState<ProcedureBill | null>(null);

  useEffect(() => {
    fetch("/api/procedures").then((res) => res.json()).then(setProcedures).catch(() => setProcedures([]));
  }, []);

  const searchPatients = () => {
    if (!search.trim()) return;
    fetch(`/api/patients?search=${encodeURIComponent(search)}&limit=10`)
      .then((res) => res.json())
      .then((data) => setPatients(data.patients ?? []))
      .catch(() => setPatients([]));
  };

  useEffect(() => {
    if (!selectedPatient) return;
    fetch(`/api/visits?patientId=${selectedPatient._id}`)
      .then((res) => res.json())
      .then((data) => setVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setVisits([]));
  }, [selectedPatient]);

  const addItem = () => {
    const proc = procedures.find((p) => p._id === newProcId);
    if (!proc) return;
    const totalPrice = proc.price * newQty;
    setItems((prev) => [...prev, {
      procedureId: proc._id,
      procedureName: proc.name,
      quantity: newQty,
      unitPrice: proc.price,
      totalPrice,
    }]);
    setNewProcId("");
    setNewQty(1);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const grandTotal = items.reduce((s, i) => s + i.totalPrice, 0);

  const generateBill = async () => {
    if (!selectedPatient || items.length === 0) {
      toast.error("Select patient and add at least one procedure");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/procedure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient._id,
          visitId: selectedVisitId || undefined,
          items: items.map((i) => ({ procedureId: i.procedureId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      setBill(data);
      toast.success("Bill generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  if (bill) {
    return (
      <PrintLayout title="Procedure Bill">
        <div className="space-y-4 print-only">
          <p><strong>Patient:</strong> {(bill.patient as Patient)?.name} — {(bill.patient as Patient)?.regNo}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Procedure</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.items.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.procedureName}</TableCell>
                  <TableCell>{row.quantity}</TableCell>
                  <TableCell>{formatCurrency(row.unitPrice)}</TableCell>
                  <TableCell>{formatCurrency(row.totalPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="font-semibold">Grand Total: {formatCurrency(bill.grandTotal)}</p>
          <p className="mt-8 border-t pt-4">Signature: _________________________</p>
        </div>
      </PrintLayout>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Procedure Billing</h1>
      <Card>
        <CardHeader><CardTitle>Step 1: Select Patient</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Search patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPatients())}
          />
          <Button onClick={searchPatients}>Search</Button>
        </CardContent>
        {patients.length > 0 && (
          <CardContent className="border-t">
            {patients.map((p) => (
              <button
                key={p._id}
                type="button"
                className="block w-full rounded border p-2 text-left hover:bg-muted"
                onClick={() => { setSelectedPatient(p); setPatients([]); setSearch(""); }}
              >
                {p.name} — {p.regNo}
              </button>
            ))}
          </CardContent>
        )}
        {selectedPatient && (
          <CardContent className="border-t">
            <p className="font-medium">Selected: {selectedPatient.name} ({selectedPatient.regNo})</p>
          </CardContent>
        )}
      </Card>
      {selectedPatient && (
        <Card>
          <CardHeader><CardTitle>Step 2: Optional Visit</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedVisitId} onValueChange={setSelectedVisitId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select visit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {visits.map((v) => (
                  <SelectItem key={v._id} value={v._id}>
                    {format(new Date(v.visitDate), "dd MMM yyyy")} — {v.receiptNo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}
      {selectedPatient && (
        <Card>
          <CardHeader><CardTitle>Step 3: Add Procedures</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select value={newProcId} onValueChange={setNewProcId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Procedure" /></SelectTrigger>
                <SelectContent>
                  {procedures.map((p) => (
                    <SelectItem key={p._id} value={p._id}>{p.name} — {formatCurrency(p.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(parseInt(e.target.value, 10) || 1)}
                className="w-20"
              />
              <Button type="button" onClick={addItem} disabled={!newProcId}>Add</Button>
            </div>
            {items.length > 0 && (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Procedure</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.procedureName}</TableCell>
                        <TableCell>{row.quantity}</TableCell>
                        <TableCell>{formatCurrency(row.unitPrice)}</TableCell>
                        <TableCell>{formatCurrency(row.totalPrice)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(i)}>Remove</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="font-semibold">Grand Total: {formatCurrency(grandTotal)}</p>
                <Button onClick={generateBill} disabled={loading}>
                  {loading ? "Generating..." : "Generate Bill"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
