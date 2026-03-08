"use client";

import { useState, useEffect } from "react";
import { format, differenceInDays } from "date-fns";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { PrintLayout } from "@/components/PrintLayout";

type Patient = { _id: string; name: string; regNo: string };
type Visit = { _id: string; visitDate: string };
type PrescriptionMed = { medicineName: string; medicine?: string };
type Prescription = {
  _id: string;
  visit: string;
  doctor?: { name: string };
  medicines: PrescriptionMed[];
};
type StockBatch = {
  _id: string;
  batchNo: string;
  expiryDate: string;
  mrp: number;
  sellingPrice: number;
  currentStock: number;
  medicine?: { name: string };
};
type BillItem = {
  medicineStockId: string;
  medicineName: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  totalPrice: number;
  currentStock: number;
};
type MedicineBill = {
  _id: string;
  patient?: Patient;
  items: BillItem[];
  grandTotal: number;
};

export default function PharmacyBillingPage() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState<MedicineBill | null>(null);

  const searchPatients = () => {
    if (!search.trim()) return;
    setLoading(true);
    fetch(`/api/patients?search=${encodeURIComponent(search)}&limit=10`)
      .then((res) => res.json())
      .then((data) => { setPatients(data.patients ?? []); setLoading(false); })
      .catch(() => { setPatients([]); setLoading(false); });
  };

  useEffect(() => {
    if (!selectedPatient) return;
    fetch(`/api/visits?patientId=${selectedPatient._id}`)
      .then((res) => res.json())
      .then((data) => setVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setVisits([]));
  }, [selectedPatient]);

  useEffect(() => {
    if (!selectedPatient || !selectedVisitId) { setPrescription(null); setItems([]); return; }
    fetch(`/api/prescriptions?patientId=${selectedPatient._id}&visitId=${selectedVisitId}`)
      .then((res) => res.json())
      .then((pres) => {
        setPrescription(pres);
        if (!pres?.medicines?.length) { setItems([]); return; }
        Promise.all(
          (pres.medicines as PrescriptionMed[]).map((m) => {
            const medId = typeof (m as { medicine?: string | { _id: string } }).medicine === "string"
              ? (m as { medicine: string }).medicine
              : (m as { medicine?: { _id: string } }).medicine?._id;
            return medId
              ? fetch(`/api/stock?medicineId=${medId}`).then((r) => r.json()).then((batches: StockBatch[]) => {
              const sorted = (batches ?? []).sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
              const batch = sorted[0];
              if (!batch) return null;
              return {
                medicineStockId: batch._id,
                medicineName: (batch.medicine as { name?: string })?.name ?? m.medicineName,
                batchNo: batch.batchNo,
                expiryDate: batch.expiryDate,
                quantity: 1,
                mrp: batch.mrp,
                sellingPrice: batch.sellingPrice,
                totalPrice: batch.sellingPrice,
                currentStock: batch.currentStock,
              } as BillItem;
            })
              : Promise.resolve(null);
          })
        ).then((rows) => setItems(rows.filter(Boolean) as BillItem[]));
      })
      .catch(() => { setPrescription(null); setItems([]); });
  }, [selectedPatient, selectedVisitId]);

  const updateItemQty = (idx: number, qty: number) => {
    const item = items[idx];
    if (!item || qty < 0 || qty > item.currentStock) return;
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: qty, totalPrice: next[idx].sellingPrice * qty };
      return next;
    });
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const grandTotal = items.reduce((s, i) => s + i.totalPrice, 0);

  const generateBill = async () => {
    if (!selectedPatient || items.length === 0) {
      toast.error("Select patient and add items");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/medicine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient._id,
          visitId: selectedVisitId || undefined,
          prescriptionId: prescription?._id,
          items: items.map((i) => ({ medicineStockId: i.medicineStockId, quantity: i.quantity, sellingPrice: i.sellingPrice })),
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

  const getExpiryBadge = (expiryDate: string) => {
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return <Badge className="bg-red-600">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500">{"<"}30d</Badge>;
    return <Badge className="bg-green-600">OK</Badge>;
  };

  if (bill) {
    return (
      <PrintLayout title="Medicine Bill">
        <div className="space-y-4 print-only">
          <p><strong>Patient:</strong> {(bill.patient as Patient)?.name} — {(bill.patient as Patient)?.regNo}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bill.items.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.medicineName}</TableCell>
                  <TableCell>{row.batchNo}</TableCell>
                  <TableCell>{format(new Date(row.expiryDate), "dd MMM yyyy")}</TableCell>
                  <TableCell>{row.quantity}</TableCell>
                  <TableCell>{formatCurrency(row.mrp)}</TableCell>
                  <TableCell>{formatCurrency(row.sellingPrice)}</TableCell>
                  <TableCell>{formatCurrency(row.totalPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="font-semibold">Grand Total: {formatCurrency(bill.grandTotal)}</p>
          <p className="mt-8 border-t pt-4">Pharmacist signature: _________________________</p>
        </div>
      </PrintLayout>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Medicine Billing</h1>
      <Card>
        <CardHeader><CardTitle>Step 1: Select Patient</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Search patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPatients())}
          />
          <Button onClick={searchPatients} disabled={loading}>Search</Button>
        </CardContent>
        {patients.length > 0 && (
          <CardContent className="border-t">
            {patients.map((p) => (
              <button
                key={p._id}
                type="button"
                className="block w-full rounded border p-2 text-left hover:bg-muted"
                onClick={() => { setSelectedPatient(p); setPatients([]); setSearch(""); setSelectedVisitId(""); }}
              >
                {p.name} — {p.regNo}
              </button>
            ))}
          </CardContent>
        )}
      </Card>
      {selectedPatient && (
        <Card>
          <CardHeader><CardTitle>Step 2: Select Visit</CardTitle></CardHeader>
          <CardContent>
            <Select value={selectedVisitId} onValueChange={setSelectedVisitId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select visit" /></SelectTrigger>
              <SelectContent>
                {visits.map((v) => (
                  <SelectItem key={v._id} value={v._id}>{format(new Date(v.visitDate), "dd MMM yyyy")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}
      {prescription && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Prescription & Bill</CardTitle>
            <CardDescription className="sr-only">Items</CardDescription>
          </CardHeader>
          <CardContent>
            {prescription.doctor && <p className="text-sm">Doctor: {(prescription.doctor as { name?: string }).name}</p>}
            {items.length === 0 ? (
              <p className="text-muted-foreground py-4">No prescription or no stock for prescribed medicines.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.medicineName}</TableCell>
                        <TableCell>{row.batchNo}</TableCell>
                        <TableCell>{getExpiryBadge(row.expiryDate)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={row.currentStock}
                            value={row.quantity}
                            onChange={(e) => updateItemQty(i, parseInt(e.target.value, 10) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(row.sellingPrice)}</TableCell>
                        <TableCell>{formatCurrency(row.totalPrice)}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => removeItem(i)}>Remove</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="font-semibold mt-2">Grand Total: {formatCurrency(grandTotal)}</p>
                <Button className="mt-4" onClick={generateBill} disabled={loading}>
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
