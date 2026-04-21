"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { differenceInDays, format } from "date-fns";
import toast from "react-hot-toast";
import { formatCurrency, formatPaymentMethodLabel } from "@/lib/utils";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import {
  grandTotalAfterBillOffer,
  lineNetAfterOffer,
} from "@/lib/bill-offers";
import { BillSignature, PrintLayout } from "@/components/PrintLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X } from "lucide-react";
import { useMedicineBillingListHref } from "@/hooks/usePharmacyBase";
import { BillingStaffSelect, getBillingStaffDisplayName } from "@/components/BillingStaffSelect";

type Patient = { _id: string; name: string; regNo: string; phone?: string; age?: number; address?: string };
type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  patient?: Patient;
  doctor?: { name?: string } | null;
  medicineBills?: Array<{ _id: string }>;
};
type PrescriptionMed = { medicineName: string; medicine?: string | { _id: string } };
type Prescription = {
  _id: string;
  doctor?: { name: string };
  medicines: Array<PrescriptionMed & { frequency?: string; duration?: string }>;
};
type MedicineOption = {
  _id: string;
  name: string;
};
type FrequencyOption = {
  value: string;
  label: string;
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
  lineOffer: number;
  totalPrice: number;
  currentStock: number;
  stockStatus: "in_stock" | "no_stock";
  availableBatches: StockBatch[];
  source: "prescription" | "manual";
  frequency: string;
  duration: string;
};
type MedicineBill = {
  _id: string;
  patient?: Patient;
  billedAt?: string;
  generatedByName?: string;
  billedBy?: { name?: string } | null;
  items: BillItem[];
  grandTotal: number;
  billOffer?: number;
  paymentMethod?: { _id?: string; name?: string; code?: string } | null;
};
type StoredMedicineBill = {
  _id: string;
  patient?: Patient;
  billedAt?: string;
  generatedByName?: string;
  billedBy?: { name?: string } | null;
  paymentMethod?: { _id?: string; name?: string; code?: string } | null;
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
    lineOffer?: number;
    frequency?: string;
    duration?: string;
  }>;
  grandTotal: number;
  billOffer?: number;
};

function calculateSuggestedQuantity(frequency: string, durationStr: string): number | null {
  const daysMatch = durationStr.match(/(\d+)/);
  if (!daysMatch) return null;
  const days = parseInt(daysMatch[1], 10);
  if (isNaN(days) || days <= 0) return null;

  const f = (frequency || "").toLowerCase().trim();
  let dailyDoses = 0;

  if (/^(\d)(?:-|\+)(\d)(?:-|\+)(\d)(?:-|\+)(\d)$/.test(f)) {
    const match = f.match(/^(\d)(?:-|\+)(\d)(?:-|\+)(\d)(?:-|\+)(\d)$/);
    if (match) dailyDoses = parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3]) + parseInt(match[4]);
  } else if (/^(\d)(?:-|\+)(\d)(?:-|\+)(\d)$/.test(f)) {
    const match = f.match(/^(\d)(?:-|\+)(\d)(?:-|\+)(\d)$/);
    if (match) dailyDoses = parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3]);
  } else if (/^(\d)(?:-|\+)(\d)$/.test(f)) {
    const match = f.match(/^(\d)(?:-|\+)(\d)$/);
    if (match) dailyDoses = parseInt(match[1]) + parseInt(match[2]);
  } else if (f.includes("qid") || f.includes("q.i.d")) {
    dailyDoses = 4;
  } else if (f.includes("tds") || f.includes("tid") || f.includes("t.i.d") || f.includes("thrice")) {
    dailyDoses = 3;
  } else if (f.includes("bd") || f.includes("bid") || f.includes("b.i.d") || f.includes("twice")) {
    dailyDoses = 2;
  } else if (f.includes("od") || f.includes("o.d") || f.includes("daily") || f.includes("once")) {
    dailyDoses = 1;
  }

  if (dailyDoses > 0) {
    return Math.ceil(dailyDoses * days);
  }
  return null;
}

export default function VisitMedicineBillingPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const role = session?.user?.role;
  const canEditMedicineBill =
    isAdmin || role === "pharmacy" || role === "frontdesk";
  const visitListBackHref = useMedicineBillingListHref();
  const params = useParams<{ visitId: string }>();
  const visitId = params?.visitId ?? "";

  const [visit, setVisit] = useState<Visit | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [medicineOptions, setMedicineOptions] = useState<MedicineOption[]>([]);
  const [frequencies, setFrequencies] = useState<FrequencyOption[]>([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bill, setBill] = useState<MedicineBill | null>(null);
  const [editingBill, setEditingBill] = useState(false);
  const [billOffer, setBillOffer] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [generatedByName, setGeneratedByName] = useState("");

  const buildBillItem = (
    medicineId: string | undefined,
    medicineName: string,
    batches: StockBatch[],
    source: "prescription" | "manual",
    options?: { frequency?: string; duration?: string }
  ): BillItem => {
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
        frequency: options?.frequency?.trim() || "",
        duration: options?.duration?.trim() || "",
        batchNo: "-",
        expiryDate: new Date().toISOString(),
        quantity: 0,
        mrp: 0,
        sellingPrice: 0,
        lineOffer: 0,
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
      frequency: options?.frequency?.trim() || "",
      duration: options?.duration?.trim() || "",
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      quantity: 1,
      mrp: batch.mrp,
      sellingPrice: batch.sellingPrice,
      lineOffer: 0,
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
          return buildBillItem(undefined, item.medicineName, [], "manual", {
            frequency: item.frequency,
            duration: item.duration,
          });
        }

        const batchesRes = await fetch(`/api/stock?medicineId=${medicineId}&inventoryType=pharmacy`, { cache: "no-store" });
        const batches = (await batchesRes.json()) as StockBatch[];
        const availableBatches = (batches ?? []).filter((batch) => batch.currentStock > 0);
        const selectedBatch = availableBatches.find((batch) => batch._id === stock?._id);
        if (!selectedBatch) {
          return buildBillItem(medicineId, item.medicineName, batches ?? [], "manual", {
            frequency: item.frequency,
            duration: item.duration,
          });
        }

        const q = Math.min(item.quantity, selectedBatch.currentStock);
        const sp = Number(item.sellingPrice) || selectedBatch.sellingPrice;
        const lineOffer = Number(item.lineOffer) || 0;
        const gross = sp * q;
        return {
          id: `${medicineId}-${selectedBatch._id}-saved-${Math.random().toString(36).slice(2, 9)}`,
          medicineId,
          medicineStockId: selectedBatch._id,
          medicineName: item.medicineName,
          frequency: item.frequency?.trim() || "",
          duration: item.duration?.trim() || "",
          batchNo: selectedBatch.batchNo,
          expiryDate: selectedBatch.expiryDate,
          quantity: q,
          mrp: selectedBatch.mrp,
          sellingPrice: sp,
          lineOffer,
          totalPrice: lineNetAfterOffer(gross, lineOffer),
          currentStock: selectedBatch.currentStock,
          stockStatus: "in_stock",
          availableBatches,
          source: "manual",
        } as BillItem;
      })
    );

    setItems(rows);
    setBillOffer(Number(storedBill.billOffer) || 0);
    const pm = storedBill.paymentMethod;
    setPaymentMethodId(pm?._id ? String(pm._id) : "");
    setGeneratedByName(storedBill.generatedByName?.trim() || "");
  }, []);

  useEffect(() => {
    if (!visitId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/visits/${visitId}`, { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/medicines", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/medicine-frequencies", { cache: "no-store" }).then((res) => res.json()).catch(() => []),
    ])
      .then(async ([visitData, medicineList, freqList]) => {
        setMedicineOptions(Array.isArray(medicineList) ? medicineList : []);
        setFrequencies(Array.isArray(freqList) ? freqList.map((f: { name: string }) => ({ value: f.name, label: f.name })) : []);
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
          setPaymentMethodId("");
          setGeneratedByName("");
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
          (pres.medicines as Prescription["medicines"]).map(async (m) => {
            const medId =
              typeof m.medicine === "string"
                ? m.medicine
                : (m.medicine as { _id?: string } | undefined)?._id;

            if (!medId) {
              return buildBillItem(undefined, m.medicineName, [], "prescription", {
                frequency: m.frequency,
                duration: m.duration,
              });
            }

            const batchesRes = await fetch(`/api/stock?medicineId=${medId}&inventoryType=pharmacy`, { cache: "no-store" });
            const batches = (await batchesRes.json()) as StockBatch[];
            return buildBillItem(medId, m.medicineName, batches ?? [], "prescription", {
              frequency: m.frequency,
              duration: m.duration,
            });
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
      const row = next[idx];
      const gross = row.sellingPrice * qty;
      next[idx] = {
        ...row,
        quantity: qty,
        totalPrice: lineNetAfterOffer(gross, row.lineOffer),
      };
      return next;
    });
  };

  const updateLineOffer = (idx: number, raw: number) => {
    setItems((prev) => {
      const next = [...prev];
      const row = next[idx];
      const gross = row.sellingPrice * row.quantity;
      const lineOffer = Math.max(0, raw);
      next[idx] = {
        ...row,
        lineOffer,
        totalPrice: lineNetAfterOffer(gross, lineOffer),
      };
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
      const row = next[idx];
      const gross = nextBatch.sellingPrice * quantity;
      next[idx] = {
        ...row,
        medicineStockId: nextBatch._id,
        medicineName: nextBatch.medicine?.name ?? row.medicineName,
        batchNo: nextBatch.batchNo,
        expiryDate: nextBatch.expiryDate,
        mrp: nextBatch.mrp,
        sellingPrice: nextBatch.sellingPrice,
        currentStock: nextBatch.currentStock,
        quantity,
        totalPrice: lineNetAfterOffer(gross, row.lineOffer),
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
      const res = await fetch(`/api/stock?medicineId=${selectedMedicineId}&inventoryType=pharmacy`, { cache: "no-store" });
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

  const updateItemFrequency = (idx: number, value: string) => {
    setItems((prev) => prev.map((row, itemIndex) => {
      if (itemIndex !== idx) return row;
      const nextRow = { ...row, frequency: value };
      const suggested = calculateSuggestedQuantity(value, nextRow.duration);
      if (suggested !== null && nextRow.stockStatus === "in_stock") {
        const qty = Math.min(suggested, nextRow.currentStock);
        nextRow.quantity = Math.max(1, qty);
        nextRow.totalPrice = lineNetAfterOffer(nextRow.sellingPrice * nextRow.quantity, nextRow.lineOffer);
      }
      return nextRow;
    }));
  };

  const updateItemDuration = (idx: number, value: string) => {
    setItems((prev) => prev.map((row, itemIndex) => {
      if (itemIndex !== idx) return row;
      const nextRow = { ...row, duration: value };
      const suggested = calculateSuggestedQuantity(nextRow.frequency, value);
      if (suggested !== null && nextRow.stockStatus === "in_stock") {
        const qty = Math.min(suggested, nextRow.currentStock);
        nextRow.quantity = Math.max(1, qty);
        nextRow.totalPrice = lineNetAfterOffer(nextRow.sellingPrice * nextRow.quantity, nextRow.lineOffer);
      }
      return nextRow;
    }));
  };

  const billableItems = useMemo(
    () => items.filter((i) => i.stockStatus === "in_stock" && i.medicineStockId && i.quantity > 0),
    [items]
  );

  const linesNetSum = useMemo(
    () => billableItems.reduce((sum, row) => sum + row.totalPrice, 0),
    [billableItems]
  );
  const grandTotal = useMemo(
    () => grandTotalAfterBillOffer(linesNetSum, billOffer),
    [linesNetSum, billOffer]
  );

  const generateBill = async () => {
    if (!visit?.patient?._id || !visit?._id || billableItems.length === 0) {
      if (billableItems.length === 0) {
        toast.error("No billable medicines found for this visit");
      } else {
        toast.error("Visit details missing");
      }
      return;
    }
    if (!generatedByName.trim()) {
      toast.error("Select staff before generating the bill");
      return;
    }
    if (grandTotal > 0 && !paymentMethodId.trim()) {
      toast.error("Select a payment method");
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
          billOffer,
          ...(grandTotal > 0 && paymentMethodId.trim()
            ? { paymentMethodId: paymentMethodId.trim() }
            : {}),
          generatedByName,
          items: billableItems.map((i) => ({
            medicineStockId: i.medicineStockId,
            quantity: i.quantity,
            sellingPrice: i.sellingPrice,
            frequency: i.frequency.trim() || undefined,
            duration: i.duration.trim() || undefined,
            ...(i.lineOffer > 0 ? { lineOffer: i.lineOffer } : {}),
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

  const deleteBill = async () => {
    if (!bill?._id) return;
    if (!window.confirm("Are you sure you want to delete this bill? This action cannot be undone.")) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/billing/medicine/${bill._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to delete bill");
      toast.success("Medicine bill deleted");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete bill");
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
        paper="portrait"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => window.print()}>
              Print
            </Button>
            <Button asChild variant="outline">
              <Link href={visitListBackHref}>Back to Visit List</Link>
            </Button>
            {canEditMedicineBill && (
              <Button variant="outline" onClick={() => setEditingBill(true)}>
                Edit Bill
              </Button>
            )}
            {isAdmin && (
              <Button variant="destructive" onClick={deleteBill} disabled={submitting}>
                {submitting ? "Deleting..." : "Delete Bill"}
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
                <span>Phone</span>
                <span>: {(bill.patient as Patient)?.phone ?? "-"}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span>Address</span>
                <span>: {(bill.patient as Patient)?.address?.trim() || "-"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[150px_1fr]">
                <span>Consultation date and time</span>
                <span>
                  :{" "}
                  {visit?.visitDate
                    ? format(new Date(visit.visitDate), "dd MMM yyyy, HH:mm")
                    : "—"}
                </span>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <span>Bill date and time</span>
                <span>
                  : {bill.billedAt ? format(new Date(bill.billedAt), "dd MMM yyyy, HH:mm") : "—"}
                </span>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <span>Age</span>
                <span>: {(bill.patient as Patient)?.age ?? "-"}</span>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <span>Consultant Doctor</span>
                <span>
                  :{" "}
                  {visit?.doctor?.name?.trim()
                    ? visit.doctor.name
                    : prescription?.doctor?.name?.trim()
                      ? prescription.doctor.name
                      : "—"}
                </span>
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
                <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Line offer</th>
                <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((row, i) => {
                const lo = Number((row as BillItem).lineOffer) || 0;
                return (
                  <tr key={i}>
                    <td className="border border-slate-400 px-3 py-2 align-top">{i + 1}</td>
                    <td className="border border-slate-400 px-3 py-2 align-top">
                      <div>{row.medicineName}</div>
                      {row.frequency || row.duration ? (
                        <div className="mt-1 text-[13px] text-slate-600">
                          {row.frequency ? `Freq: ${row.frequency}` : ""}
                          {row.frequency && row.duration ? " | " : ""}
                          {row.duration ? `Duration: ${row.duration}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="border border-slate-400 px-3 py-2 text-center align-top">{row.quantity}</td>
                    <td className="border border-slate-400 px-3 py-2 text-right align-top">{formatCurrency(row.sellingPrice)}</td>
                    <td className="border border-slate-400 px-3 py-2 text-right align-top">
                      {lo > 0 ? formatCurrency(lo) : "—"}
                    </td>
                    <td className="border border-slate-400 px-3 py-2 text-right align-top">{formatCurrency(row.totalPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(() => {
            const grossSum = bill.items.reduce(
              (s, r) => s + Number(r.sellingPrice) * Number(r.quantity),
              0
            );
            const lineOfferSum = bill.items.reduce(
              (s, r) => s + (Number((r as BillItem).lineOffer) || 0),
              0
            );
            const linesNet = bill.items.reduce((s, r) => s + Number(r.totalPrice), 0);
            const bo = Number(bill.billOffer) || 0;
            return (
              <div className="pt-8">
                <div className="ml-auto grid w-[340px] grid-cols-[1fr_120px] gap-y-1 text-[15px]">
                  <div className="border-b border-slate-300 py-1">Subtotal (gross)</div>
                  <div className="border-b border-slate-300 py-1 text-right">{formatCurrency(grossSum)}</div>
                  <div className="border-b border-slate-300 py-1">Line offers</div>
                  <div className="border-b border-slate-300 py-1 text-right text-red-700">
                    {lineOfferSum > 0 ? `−${formatCurrency(lineOfferSum)}` : "—"}
                  </div>
                  <div className="border-b border-slate-300 py-1">After line offers</div>
                  <div className="border-b border-slate-300 py-1 text-right">{formatCurrency(linesNet)}</div>
                  {bo > 0 ? (
                    <>
                      <div className="border-b border-slate-300 py-1">Bill offer</div>
                      <div className="border-b border-slate-300 py-1 text-right text-red-700">−{formatCurrency(bo)}</div>
                    </>
                  ) : null}
                  {formatPaymentMethodLabel(bill.paymentMethod) ? (
                    <>
                      <div className="border-b border-slate-300 py-1">Payment method</div>
                      <div className="border-b border-slate-300 py-1 text-right">
                        {formatPaymentMethodLabel(bill.paymentMethod)}
                      </div>
                    </>
                  ) : null}
                  <div className="py-1 font-semibold">Net amount</div>
                  <div className="py-1 text-right font-semibold">{formatCurrency(bill.grandTotal)}</div>
                </div>
                <BillSignature
                  staffName={getBillingStaffDisplayName(bill.generatedByName) || bill.billedBy?.name?.trim()}
                />
              </div>
            );
          })()}
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
                  ? `Prescribed by ${prescription.doctor.name}. Search to add medicines or change batches.`
                  : "Search the catalog to add medicines; adjust batches before billing."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!prescription && (
                <p className="mb-4 text-sm text-muted-foreground">No prescription found for this visit. You can add medicines manually.</p>
              )}

                <div className="mb-4 rounded-xl border border-blue-100 bg-slate-50/60 p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="grid min-w-[min(100%,18rem)] flex-1 gap-2 sm:max-w-md">
                      <Label>Add medicine</Label>
                      <SearchableCombobox
                        options={medicineOptions.map((m) => ({ value: m._id, label: m.name }))}
                        value={selectedMedicineId}
                        onValueChange={setSelectedMedicineId}
                        placeholder="Search or select medicine"
                        searchPlaceholder="Type to filter…"
                        emptyMessage="No medicines match."
                      />
                    </div>
                    <Button type="button" className="shrink-0" onClick={addMedicineToBill}>
                      Add medicine
                    </Button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No medicines in prescription.</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Medicine</TableHead>
                          <TableHead>Frequency</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Line offer</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((row, idx) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.medicineName}</TableCell>
                            <TableCell>
                              <SearchableCombobox
                                options={frequencies}
                                value={row.frequency}
                                onValueChange={(value) => updateItemFrequency(idx, value)}
                                placeholder="Frequency"
                                searchPlaceholder="Search..."
                                emptyMessage="No match."
                                triggerClassName="h-9 min-w-[8rem]"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="relative min-w-[8rem]">
                                <Input
                                  type="number"
                                  min="1"
                                  value={row.duration.replace(/[^0-9]/g, "")}
                                  onChange={(e) => updateItemDuration(idx, e.target.value ? `${e.target.value} days` : "")}
                                  placeholder="0"
                                  className="pr-12"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                  days
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.stockStatus === "no_stock" ? (
                                "-"
                              ) : (
                                <SearchableCombobox
                                  options={row.availableBatches.map((batch) => ({
                                    value: batch._id,
                                    label: `${batch.batchNo} · exp ${format(new Date(batch.expiryDate), "dd/MM/yy")} · ${batch.currentStock} u · ${formatCurrency(batch.sellingPrice)}`,
                                    keywords: `${batch.batchNo} ${batch.mrp} ${batch.sellingPrice}`,
                                  }))}
                                  value={row.medicineStockId ?? ""}
                                  onValueChange={(value) => updateItemBatch(idx, value)}
                                  placeholder="Batch"
                                  searchPlaceholder="Search batch…"
                                  emptyMessage="No batches."
                                  triggerClassName="h-9 w-full min-w-[11rem] max-w-[240px] justify-between"
                                  contentClassName="min-w-[18rem]"
                                />
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
                              {row.stockStatus === "no_stock" ? (
                                "-"
                              ) : (
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={row.lineOffer || ""}
                                  placeholder="0"
                                  onChange={(e) =>
                                    updateLineOffer(idx, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-24 tabular-nums"
                                />
                              )}
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
                    <div className="mt-4 flex max-w-md flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <Label htmlFor="med-bill-offer">Offer on whole bill (amount)</Label>
                      <Input
                        id="med-bill-offer"
                        type="number"
                        min={0}
                        step="0.01"
                        value={billOffer || ""}
                        placeholder="0"
                        onChange={(e) => setBillOffer(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="max-w-[12rem] tabular-nums"
                      />
                      <p className="text-xs text-muted-foreground">
                        After line offers: {formatCurrency(linesNetSum)}
                        {billOffer > 0 ? ` · Net: ${formatCurrency(grandTotal)}` : ""}
                      </p>
                    </div>
                    <div className="mt-4 flex max-w-md flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <Label htmlFor="med-generated-by">Name to show on bill</Label>
                      <BillingStaffSelect
                        id="med-generated-by"
                        label=""
                        value={generatedByName}
                        onValueChange={setGeneratedByName}
                        className="max-w-[18rem]"
                        triggerClassName="w-full max-w-[18rem]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Prints as a small “Generated by” line on the bill.
                      </p>
                    </div>
                    <PaymentMethodSelect
                      className="mt-4 max-w-md"
                      value={paymentMethodId}
                      onValueChange={setPaymentMethodId}
                      required={grandTotal > 0}
                      onOptionsLoaded={(opts) => {
                        setPaymentMethodId((id) => id || opts[0]?._id || "");
                      }}
                    />
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm font-semibold">Net total: {formatCurrency(grandTotal)}</p>
                      <div className="flex items-center gap-2">
                        {isAdmin && bill?._id ? (
                          <Button type="button" variant="destructive" onClick={deleteBill} disabled={submitting}>
                            {submitting ? "Deleting..." : "Delete Bill"}
                          </Button>
                        ) : null}
                        <Button onClick={generateBill} disabled={submitting || billableItems.length === 0}>
                          {submitting ? (bill ? "Updating..." : "Generating...") : (bill ? "Update Bill" : "Generate Bill")}
                        </Button>
                      </div>
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
