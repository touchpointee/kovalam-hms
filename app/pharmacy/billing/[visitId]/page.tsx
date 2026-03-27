"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { differenceInDays, format } from "date-fns";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { PrintLayout } from "@/components/PrintLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X } from "lucide-react";

type Patient = { _id: string; name: string; regNo: string };
type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  patient?: Patient;
  medicineBills?: Array<{ _id: string }>;
};
type PrescriptionMed = { medicineName: string; medicine?: string | { _id: string } };
type Prescription = {
  _id: string;
  doctor?: { name: string };
  medicines: PrescriptionMed[];
};
type MedicineOption = {
  _id: string;
  name: string;
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
  id: string;
  medicineId?: string;
  medicineStockId?: string;
  medicineName: string;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  totalPrice: number;
  currentStock: number;
  stockStatus: "in_stock" | "no_stock";
  availableBatches: StockBatch[];
  source: "prescription" | "manual";
};
type MedicineBill = {
  _id: string;
  patient?: Patient;
  billedAt?: string;
  items: BillItem[];
  grandTotal: number;
};
type StoredMedicineBill = {
  _id: string;
  patient?: Patient;
  billedAt?: string;
  items: Array<{
    medicineStock?: {
      _id?: string;
      medicine?: string | { _id?: string; name?: string };
    };
    medicineName: string;
    batchNo: string;
    expiryDate: string;
    quantity: number;
    mrp: number;
    sellingPrice: number;
    totalPrice: number;
  }>;
  grandTotal: number;
};

export default function VisitMedicineBillingPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const pathname = usePathname();
  const visitListBackHref = pathname.startsWith("/admin/") ? "/admin/visits" : "/pharmacy/billing";
  const params = useParams<{ visitId: string }>();
  const visitId = params?.visitId ?? "";

  const [visit, setVisit] = useState<Visit | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [medicineOptions, setMedicineOptions] = useState<MedicineOption[]>([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bill, setBill] = useState<MedicineBill | null>(null);
  const [editingBill, setEditingBill] = useState(false);

  const buildBillItem = (medicineId: string | undefined, medicineName: string, batches: StockBatch[], source: "prescription" | "manual"): BillItem => {
    const availableBatches = [...batches]
      .filter((batch) => batch.currentStock > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    const batch = availableBatches[0];

    if (!batch) {
      return {
        id: `${medicineId ?? medicineName}-${source}-${Math.random().toString(36).slice(2, 9)}`,
        medicineId,
        medicineStockId: undefined,
        medicineName,
        batchNo: "-",
        expiryDate: new Date().toISOString(),
        quantity: 0,
        mrp: 0,
        sellingPrice: 0,
        totalPrice: 0,
        currentStock: 0,
        stockStatus: "no_stock",
        availableBatches: [],
        source,
      };
    }

    return {
      id: `${medicineId ?? medicineName}-${batch._id}-${source}-${Math.random().toString(36).slice(2, 9)}`,
      medicineId,
      medicineStockId: batch._id,
      medicineName: batch.medicine?.name ?? medicineName,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      quantity: 1,
      mrp: batch.mrp,
      sellingPrice: batch.sellingPrice,
      totalPrice: batch.sellingPrice,
      currentStock: batch.currentStock,
      stockStatus: "in_stock",
      availableBatches,
      source,
    };
  };

  const hydrateStoredBillItems = useCallback(async (storedBill: StoredMedicineBill) => {
    const rows = await Promise.all(
      storedBill.items.map(async (item) => {
        const stock = item.medicineStock;
        const medicineId =
          typeof stock?.medicine === "string"
            ? stock.medicine
            : (stock?.medicine as { _id?: string } | undefined)?._id;

        if (!medicineId) {
          return buildBillItem(undefined, item.medicineName, [], "manual");
        }

        const batchesRes = await fetch(`/api/stock?medicineId=${medicineId}`, { cache: "no-store" });
        const batches = (await batchesRes.json()) as StockBatch[];
        const availableBatches = (batches ?? []).filter((batch) => batch.currentStock > 0);
        const selectedBatch = availableBatches.find((batch) => batch._id === stock?._id);
        if (!selectedBatch) {
          return buildBillItem(medicineId, item.medicineName, batches ?? [], "manual");
        }

        return {
          id: `${medicineId}-${selectedBatch._id}-saved-${Math.random().toString(36).slice(2, 9)}`,
          medicineId,
          medicineStockId: selectedBatch._id,
          medicineName: item.medicineName,
          batchNo: selectedBatch.batchNo,
          expiryDate: selectedBatch.expiryDate,
          quantity: Math.min(item.quantity, selectedBatch.currentStock),
          mrp: selectedBatch.mrp,
          sellingPrice: selectedBatch.sellingPrice,
          totalPrice: selectedBatch.sellingPrice * Math.min(item.quantity, selectedBatch.currentStock),
          currentStock: selectedBatch.currentStock,
          stockStatus: "in_stock",
          availableBatches,
          source: "manual",
        } as BillItem;
      })
    );

    setItems(rows);
  }, []);

  useEffect(() => {
    if (!visitId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/visits/${visitId}`, { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/medicines", { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(async ([visitData, medicineList]) => {
        setMedicineOptions(Array.isArray(medicineList) ? medicineList : []);
        if (!visitData?._id || !visitData?.patient?._id) {
          throw new Error("Visit not found");
        }
        setVisit(visitData as Visit);
        const existingBillId = Array.isArray(visitData.medicineBills) && visitData.medicineBills.length > 0
          ? visitData.medicineBills[0]?._id
          : undefined;
        if (existingBillId) {
          const billRes = await fetch(`/api/billing/medicine/${existingBillId}`, { cache: "no-store" });
          const storedBill = (await billRes.json()) as StoredMedicineBill;
          setBill(storedBill as unknown as MedicineBill);
          setEditingBill(false);
          await hydrateStoredBillItems(storedBill);
        } else {
          setBill(null);
          setEditingBill(true);
        }
        return fetch(
          `/api/prescriptions?patientId=${visitData.patient._id}&visitId=${visitData._id}`,
          { cache: "no-store" }
        );
      })
      .then((res) => res.json())
      .then(async (pres) => {
        setPrescription(pres?._id ? (pres as Prescription) : null);
        if (!pres?._id || !Array.isArray(pres.medicines) || pres.medicines.length === 0) {
          setItems([]);
          return;
        }

        const rows = await Promise.all(
          (pres.medicines as PrescriptionMed[]).map(async (m) => {
            const medId =
              typeof m.medicine === "string"
                ? m.medicine
                : (m.medicine as { _id?: string } | undefined)?._id;

            if (!medId) {
              return buildBillItem(undefined, m.medicineName, [], "prescription");
            }

            const batchesRes = await fetch(`/api/stock?medicineId=${medId}`, { cache: "no-store" });
            const batches = (await batchesRes.json()) as StockBatch[];
            return buildBillItem(medId, m.medicineName, batches ?? [], "prescription");
          })
        );
        setItems((prev) => (prev.length > 0 ? prev : rows));
      })
      .catch((e) => {
        setVisit(null);
        setPrescription(null);
        setItems([]);
        toast.error(e instanceof Error ? e.message : "Failed to load visit");
      })
      .finally(() => setLoading(false));
  }, [hydrateStoredBillItems, visitId]);

  const updateItemQty = (idx: number, qty: number) => {
    const item = items[idx];
    if (!item || item.stockStatus === "no_stock" || qty < 0 || qty > item.currentStock) return;
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: qty, totalPrice: next[idx].sellingPrice * qty };
      return next;
    });
  };

  const updateItemBatch = (idx: number, batchId: string) => {
    const item = items[idx];
    if (!item) return;
    const nextBatch = item.availableBatches.find((batch) => batch._id === batchId);
    if (!nextBatch) return;

    setItems((prev) => {
      const next = [...prev];
      const quantity = Math.min(Math.max(next[idx].quantity, 1), nextBatch.currentStock);
      next[idx] = {
        ...next[idx],
        medicineStockId: nextBatch._id,
        medicineName: nextBatch.medicine?.name ?? next[idx].medicineName,
        batchNo: nextBatch.batchNo,
        expiryDate: nextBatch.expiryDate,
        mrp: nextBatch.mrp,
        sellingPrice: nextBatch.sellingPrice,
        currentStock: nextBatch.currentStock,
        quantity,
        totalPrice: nextBatch.sellingPrice * quantity,
        stockStatus: "in_stock",
      };
      return next;
    });
  };

  const addMedicineToBill = async () => {
    if (!selectedMedicineId) {
      toast.error("Select a medicine");
      return;
    }

    try {
      const res = await fetch(`/api/stock?medicineId=${selectedMedicineId}`, { cache: "no-store" });
      const batches = (await res.json()) as StockBatch[];
      const selectedMedicine = medicineOptions.find((medicine) => medicine._id === selectedMedicineId);
      const newItem = buildBillItem(selectedMedicineId, selectedMedicine?.name ?? "Medicine", batches ?? [], "manual");
      setItems((prev) => [...prev, newItem]);
      setSelectedMedicineId("");
    } catch {
      toast.error("Failed to load medicine stock");
    }
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== idx));
  };

  const billableItems = useMemo(
    () => items.filter((i) => i.stockStatus === "in_stock" && i.medicineStockId && i.quantity > 0),
    [items]
  );

  const grandTotal = useMemo(() => billableItems.reduce((sum, row) => sum + row.totalPrice, 0), [billableItems]);

  const generateBill = async () => {
    if (!visit?.patient?._id || !visit?._id || billableItems.length === 0) {
      if (billableItems.length === 0) {
        toast.error("No billable medicines found for this visit");
      } else {
        toast.error("Visit details missing");
      }
      return;
    }
    setSubmitting(true);
    try {
      const isUpdate = Boolean(bill?._id);
      const res = await fetch(isUpdate ? `/api/billing/medicine/${bill?._id}` : "/api/billing/medicine", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: visit.patient._id,
          visitId: visit._id,
          prescriptionId: prescription?._id,
          items: billableItems.map((i) => ({
            medicineStockId: i.medicineStockId,
            quantity: i.quantity,
            sellingPrice: i.sellingPrice,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to generate bill");
      setBill(data as MedicineBill);
      setEditingBill(false);
      toast.success(isUpdate ? "Bill updated" : "Bill generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate bill");
    } finally {
      setSubmitting(false);
    }
  };

  const getExpiryBadge = (expiryDate: string) => {
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return <Badge className="bg-red-600">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500">{"<"}30d</Badge>;
    return <Badge className="bg-green-600">OK</Badge>;
  };

  if (bill && !editingBill) {
    return (
      <PrintLayout
        title="Medicine Bill"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => window.print()}>
              Print
            </Button>
            <Button asChild variant="outline">
              <Link href={visitListBackHref}>Back to Visit List</Link>
            </Button>
            {isAdmin && (
              <Button variant="outline" onClick={() => setEditingBill(true)}>
                Edit Bill
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4 print-only">
          <div className="grid grid-cols-2 gap-8 border-y border-slate-400 py-4 text-[15px]">
            <div className="space-y-2">
              <div className="grid grid-cols-[120px_1fr]">
                <span>DMC ID</span>
                <span>: {(bill.patient as Patient)?.regNo ?? "-"}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span>Patient Name</span>
                <span>: {(bill.patient as Patient)?.name ?? "-"}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span>Address</span>
                <span>: -</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[150px_1fr]">
                <span>Appointment Date</span>
                <span>: {bill.billedAt ? format(new Date(bill.billedAt), "dd-MM-yyyy") : "-"}</span>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <span>Age</span>
                <span>: -</span>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <span>Consultant Doctor</span>
                <span>: -</span>
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
                <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Amount ($)</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((row, i) => (
                <tr key={i}>
                  <td className="border border-slate-400 px-3 py-2 align-top">{i + 1}</td>
                  <td className="border border-slate-400 px-3 py-2 align-top">
                    <div>{row.medicineName}</div>
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-center align-top">{row.quantity}</td>
                  <td className="border border-slate-400 px-3 py-2 text-right align-top">{formatCurrency(row.sellingPrice)}</td>
                  <td className="border border-slate-400 px-3 py-2 text-right align-top">{formatCurrency(row.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto grid w-[320px] grid-cols-[1fr_120px] gap-y-1 pt-8 text-[15px]">
            <div className="border-b border-slate-300 py-1">Amount</div>
            <div className="border-b border-slate-300 py-1 text-right">{formatCurrency(bill.grandTotal)}</div>
            <div className="py-1 font-semibold">Net Amount</div>
            <div className="py-1 text-right font-semibold">{formatCurrency(bill.grandTotal)}</div>
          </div>
        </div>
      </PrintLayout>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Visit Billing Details</h1>
        <Button asChild variant="outline">
          <Link href={visitListBackHref}>Back</Link>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading visit details...</CardContent>
        </Card>
      ) : !visit ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Visit not found.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Visit</CardTitle>
              <CardDescription>Billing is locked to this visit only</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                <strong>Patient:</strong> {visit.patient?.name} ({visit.patient?.regNo})
              </p>
              <p>
                <strong>Receipt:</strong> {visit.receiptNo ?? "-"} | <strong>Time:</strong>{" "}
                {format(new Date(visit.visitDate), "dd MMM yyyy, HH:mm")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prescription Medicines</CardTitle>
              <CardDescription>
                {prescription?.doctor?.name
                  ? `Prescribed by ${prescription.doctor.name}`
                  : "Pharmacist can add medicines and change batches before billing"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!prescription && (
                <p className="mb-4 text-sm text-muted-foreground">No prescription found for this visit. You can add medicines manually.</p>
              )}
              
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-4">
                  <div className="grid min-w-[260px] gap-2">
                    <Label>Add Medicine</Label>
                    <Select value={selectedMedicineId} onValueChange={setSelectedMedicineId}>
                      <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                      <SelectContent>
                        {medicineOptions.map((medicine) => (
                          <SelectItem key={medicine._id} value={medicine._id}>{medicine.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={addMedicineToBill}>Add Medicine</Button>
                </div>

                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No medicines in prescription.</p>
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
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((row, idx) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.medicineName}</TableCell>
                            <TableCell>
                              {row.stockStatus === "no_stock" ? (
                                "-"
                              ) : (
                                <Select value={row.medicineStockId} onValueChange={(value) => updateItemBatch(idx, value)}>
                                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {row.availableBatches.map((batch) => (
                                      <SelectItem key={batch._id} value={batch._id}>
                                        {batch.batchNo} ({batch.currentStock})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.stockStatus === "no_stock" ? (
                                <Badge className="bg-red-600">No Stock</Badge>
                              ) : (
                                getExpiryBadge(row.expiryDate)
                              )}
                            </TableCell>
                            <TableCell>
                              {row.stockStatus === "no_stock" ? (
                                <span className="text-xs text-muted-foreground">-</span>
                              ) : (
                                <Input
                                  type="number"
                                  min={1}
                                  max={row.currentStock}
                                  value={row.quantity}
                                  onChange={(e) => updateItemQty(idx, parseInt(e.target.value, 10) || 0)}
                                  className="w-20"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              {row.stockStatus === "no_stock" ? "-" : formatCurrency(row.sellingPrice)}
                            </TableCell>
                            <TableCell>
                              {row.stockStatus === "no_stock" ? "-" : formatCurrency(row.totalPrice)}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm font-semibold">Total: {formatCurrency(grandTotal)}</p>
                      <Button onClick={generateBill} disabled={submitting || billableItems.length === 0}>
                        {submitting ? (bill ? "Updating..." : "Generating...") : (bill ? "Update Bill" : "Generate Bill")}
                      </Button>
                    </div>
                  </>
                )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
