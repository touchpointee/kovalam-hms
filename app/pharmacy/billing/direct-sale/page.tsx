"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { differenceInDays, format } from "date-fns";
import toast from "react-hot-toast";
import { formatCurrency, formatPaymentMethodLabel } from "@/lib/utils";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import { grandTotalAfterBillOffer, lineNetAfterOffer } from "@/lib/bill-offers";
import { BillSignature, PrintLayout } from "@/components/PrintLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/SearchableCombobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X } from "lucide-react";
import { BillingStaffSelect, getBillingStaffDisplayName } from "@/components/BillingStaffSelect";

type StockBatch = {
  _id: string; batchNo: string; expiryDate: string;
  mrp: number; sellingPrice: number; currentStock: number;
  medicine?: { name: string };
};
type BillItem = {
  id: string; medicineId?: string; medicineStockId?: string;
  medicineName: string; batchNo: string; expiryDate: string;
  quantity: number; mrp: number; sellingPrice: number;
  lineOffer: number; totalPrice: number; currentStock: number;
  stockStatus: "in_stock" | "no_stock"; availableBatches: StockBatch[];
  frequency: string; duration: string;
};
type SavedBill = {
  _id: string;
  patient?: { _id: string; name: string; regNo: string; phone?: string; age?: number; address?: string };
  billedAt?: string; generatedByName?: string;
  billedBy?: { name?: string } | null;
  items: Array<{ medicineName: string; batchNo: string; expiryDate: string; quantity: number; mrp: number; sellingPrice: number; totalPrice: number; lineOffer?: number; frequency?: string; duration?: string }>;
  grandTotal: number; billOffer?: number;
  paymentMethod?: { _id?: string; name?: string; code?: string } | null;
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

export default function DirectSalePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const backHref = "/pharmacy/billing";

  // Step: "form" | "bill"
  const [step, setStep] = useState<"form" | "bill">("form");
  const [savedBill, setSavedBill] = useState<SavedBill | null>(null);

  // Patient fields
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAge, setPatientAge] = useState("");

  // Medicine items
  const [medicineOptions, setMedicineOptions] = useState<{ _id: string; name: string }[]>([]);
  const [frequencies, setFrequencies] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [items, setItems] = useState<BillItem[]>([]);

  // Bill settings
  const [billOffer, setBillOffer] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [generatedByName, setGeneratedByName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/medicines", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMedicineOptions(Array.isArray(d) ? d : []))
      .catch(() => {});

    fetch("/api/medicine-frequencies", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setFrequencies(Array.isArray(d) ? d.map((f: { name: string }) => ({ value: f.name, label: f.name })) : []))
      .catch(() => {});
  }, []);

  const buildItem = (medId: string | undefined, medName: string, batches: StockBatch[]): BillItem => {
    const avail = [...batches]
      .filter((b) => b.currentStock > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    const batch = avail[0];
    if (!batch) {
      return {
        id: `${medId ?? medName}-${Math.random().toString(36).slice(2)}`,
        medicineId: medId, medicineStockId: undefined, medicineName: medName,
        frequency: "", duration: "",
        batchNo: "-", expiryDate: new Date().toISOString(), quantity: 0,
        mrp: 0, sellingPrice: 0, lineOffer: 0, totalPrice: 0, currentStock: 0,
        stockStatus: "no_stock", availableBatches: [],
      };
    }
    return {
      id: `${medId ?? medName}-${batch._id}-${Math.random().toString(36).slice(2)}`,
      medicineId: medId, medicineStockId: batch._id,
      medicineName: batch.medicine?.name ?? medName,
      frequency: "", duration: "",
      batchNo: batch.batchNo, expiryDate: batch.expiryDate, quantity: 1,
      mrp: batch.mrp, sellingPrice: batch.sellingPrice, lineOffer: 0,
      totalPrice: batch.sellingPrice, currentStock: batch.currentStock,
      stockStatus: "in_stock", availableBatches: avail,
    };
  };

  const addMedicine = async () => {
    if (!selectedMedicineId) { toast.error("Select a medicine"); return; }
    try {
      const r = await fetch(`/api/stock?medicineId=${selectedMedicineId}&inventoryType=pharmacy`, { cache: "no-store" });
      const batches = (await r.json()) as StockBatch[];
      const med = medicineOptions.find((m) => m._id === selectedMedicineId);
      setItems((prev) => [...prev, buildItem(selectedMedicineId, med?.name ?? "Medicine", batches ?? [])]);
      setSelectedMedicineId("");
    } catch { toast.error("Failed to load stock"); }
  };

  const updateQty = (idx: number, qty: number) => {
    setItems((prev) => {
      const next = [...prev];
      const row = next[idx];
      if (!row || row.stockStatus === "no_stock" || qty < 0 || qty > row.currentStock) return prev;
      const gross = row.sellingPrice * qty;
      next[idx] = { ...row, quantity: qty, totalPrice: lineNetAfterOffer(gross, row.lineOffer) };
      return next;
    });
  };

  const updateLineOffer = (idx: number, val: number) => {
    setItems((prev) => {
      const next = [...prev];
      const row = next[idx];
      const gross = row.sellingPrice * row.quantity;
      const lo = Math.max(0, val);
      next[idx] = { ...row, lineOffer: lo, totalPrice: lineNetAfterOffer(gross, lo) };
      return next;
    });
  };

  const updateBatch = (idx: number, batchId: string) => {
    const item = items[idx];
    if (!item) return;
    const nb = item.availableBatches.find((b) => b._id === batchId);
    if (!nb) return;
    setItems((prev) => {
      const next = [...prev];
      const qty = Math.min(Math.max(next[idx].quantity, 1), nb.currentStock);
      const gross = nb.sellingPrice * qty;
      next[idx] = {
        ...next[idx], medicineStockId: nb._id,
        medicineName: nb.medicine?.name ?? next[idx].medicineName,
        batchNo: nb.batchNo, expiryDate: nb.expiryDate,
        mrp: nb.mrp, sellingPrice: nb.sellingPrice,
        currentStock: nb.currentStock, quantity: qty,
        totalPrice: lineNetAfterOffer(gross, next[idx].lineOffer),
        stockStatus: "in_stock",
      };
      return next;
    });
  };

  const updateFrequency = (idx: number, value: string) => {
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

  const updateDuration = (idx: number, value: string) => {
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
  const linesNetSum = useMemo(() => billableItems.reduce((s, r) => s + r.totalPrice, 0), [billableItems]);
  const grandTotal = useMemo(() => grandTotalAfterBillOffer(linesNetSum, billOffer), [linesNetSum, billOffer]);

  const getExpiryBadge = (exp: string) => {
    const d = differenceInDays(new Date(exp), new Date());
    if (d < 0) return <Badge className="bg-red-600">Expired</Badge>;
    if (d <= 30) return <Badge className="bg-orange-500">{"<"}30d</Badge>;
    return <Badge className="bg-green-600">OK</Badge>;
  };

  const handleGenerateBill = async () => {
    if (!patientName.trim()) { toast.error("Enter patient name"); return; }
    if (!patientPhone.trim()) { toast.error("Enter phone number"); return; }
    if (billableItems.length === 0) { toast.error("Add at least one medicine"); return; }
    if (!generatedByName.trim()) { toast.error("Select billing staff"); return; }
    if (grandTotal > 0 && !paymentMethodId.trim()) { toast.error("Select a payment method"); return; }

    setSubmitting(true);
    try {
      // 1. Register patient
      const patRes = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: patientName.trim(),
          phone: patientPhone.trim(),
          age: parseInt(patientAge, 10) || 0,
          gender: "other",
          registrationType: "pharmacy",
        }),
      });
      const patData = await patRes.json();
      if (!patRes.ok) throw new Error(patData.message || "Failed to register patient");

      // 2. Generate bill (no visitId for direct purchase)
      const billRes = await fetch("/api/billing/medicine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patData._id,
          billOffer,
          generatedByName,
          ...(grandTotal > 0 && paymentMethodId.trim() ? { paymentMethodId } : {}),
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
      const billData = await billRes.json();
      if (!billRes.ok) throw new Error(billData.message || "Failed to generate bill");

      setSavedBill(billData as SavedBill);
      setStep("bill");
      toast.success("Bill generated!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep("form");
    setSavedBill(null);
    setPatientName(""); setPatientPhone(""); setPatientAge("");
    setItems([]); setBillOffer(0); setPaymentMethodId(""); setGeneratedByName("");
  };

  // ── PRINT VIEW ──
  if (step === "bill" && savedBill) {
    const pat = savedBill.patient;
    const grossSum = savedBill.items.reduce((s, r) => s + r.sellingPrice * r.quantity, 0);
    const loSum = savedBill.items.reduce((s, r) => s + (Number(r.lineOffer) || 0), 0);
    const linesNet = savedBill.items.reduce((s, r) => s + r.totalPrice, 0);
    const bo = Number(savedBill.billOffer) || 0;

    return (
      <PrintLayout
        title="Medicine Bill"
        paper="portrait"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => window.print()}>Print</Button>
            <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            <Button variant="outline" onClick={() => router.push(backHref)}>Back to Medicine Billing</Button>
            <Button variant="outline" onClick={handleReset}>New Direct Sale</Button>
          </div>
        }
      >
        <div className="space-y-4 print-only">
          <div className="grid grid-cols-2 gap-8 border-y border-slate-400 py-4 text-[15px]">
            <div className="space-y-1">
              <div className="grid grid-cols-[110px_1fr]"><span>Reg No</span><span>: {pat?.regNo ?? "-"}</span></div>
              <div className="grid grid-cols-[110px_1fr]"><span>Patient</span><span>: {pat?.name ?? "-"}</span></div>
              <div className="grid grid-cols-[110px_1fr]"><span>Phone</span><span>: {pat?.phone ?? "-"}</span></div>
              <div className="grid grid-cols-[110px_1fr]"><span>Age</span><span>: {pat?.age ?? "-"}</span></div>
            </div>
            <div className="space-y-1">
              <div className="grid grid-cols-[130px_1fr]"><span>Bill date</span><span>: {savedBill.billedAt ? format(new Date(savedBill.billedAt), "dd MMM yyyy, HH:mm") : "—"}</span></div>
              <div className="grid grid-cols-[130px_1fr]"><span>Type</span><span>: Direct Purchase</span></div>
            </div>
          </div>

          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                <th className="border border-slate-400 px-3 py-2 text-left font-semibold">#</th>
                <th className="border border-slate-400 px-3 py-2 text-left font-semibold">Medicine</th>
                <th className="border border-slate-400 px-3 py-2 text-center font-semibold">Qty</th>
                <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Rate</th>
                <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Offer</th>
                <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {savedBill.items.map((row, i) => (
                <tr key={i}>
                  <td className="border border-slate-400 px-3 py-2">{i + 1}</td>
                  <td className="border border-slate-400 px-3 py-2">
                    <div>{row.medicineName}</div>
                    {row.frequency || row.duration ? (
                      <div className="mt-1 text-[13px] text-slate-600">
                        {row.frequency ? `Freq: ${row.frequency}` : ""}
                        {row.frequency && row.duration ? " | " : ""}
                        {row.duration ? `Duration: ${row.duration}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-center">{row.quantity}</td>
                  <td className="border border-slate-400 px-3 py-2 text-right">{formatCurrency(row.sellingPrice)}</td>
                  <td className="border border-slate-400 px-3 py-2 text-right">{Number(row.lineOffer) > 0 ? formatCurrency(Number(row.lineOffer)) : "—"}</td>
                  <td className="border border-slate-400 px-3 py-2 text-right">{formatCurrency(row.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pt-4">
            <div className="ml-auto grid w-[320px] grid-cols-[1fr_110px] gap-y-1 text-[15px]">
              <div className="border-b py-1">Subtotal</div><div className="border-b py-1 text-right">{formatCurrency(grossSum)}</div>
              {loSum > 0 && (<><div className="border-b py-1">Line offers</div><div className="border-b py-1 text-right text-red-700">−{formatCurrency(loSum)}</div></>)}
              {bo > 0 && (<><div className="border-b py-1">Bill offer</div><div className="border-b py-1 text-right text-red-700">−{formatCurrency(bo)}</div></>)}
              {formatPaymentMethodLabel(savedBill.paymentMethod) && (
                <><div className="border-b py-1">Payment</div><div className="border-b py-1 text-right">{formatPaymentMethodLabel(savedBill.paymentMethod)}</div></>
              )}
              <div className="py-1 font-semibold">Net Amount</div><div className="py-1 text-right font-semibold">{formatCurrency(savedBill.grandTotal)}</div>
            </div>
            <BillSignature staffName={getBillingStaffDisplayName(savedBill.generatedByName) || savedBill.billedBy?.name?.trim()} />
          </div>
        </div>
      </PrintLayout>
    );
  }

  // ── FORM VIEW ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Direct Medicine Sale</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
          <Button variant="outline" onClick={() => router.push(backHref)}>Back to Medicine Billing</Button>
        </div>
      </div>

      {/* Patient Details */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Details</CardTitle>
          <CardDescription>Enter basic details — no OP registration needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="pat-name">Name *</Label>
              <Input id="pat-name" placeholder="e.g. John Doe" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-phone">Phone *</Label>
              <Input id="pat-phone" placeholder="10-digit number" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-age">Age</Label>
              <Input id="pat-age" type="number" placeholder="e.g. 35" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Medicines */}
      <Card>
        <CardHeader>
          <CardTitle>Medicines</CardTitle>
          <CardDescription>Search and add medicines to the bill.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-slate-50/60 p-4 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label>Search medicine</Label>
              <SearchableCombobox
                options={medicineOptions.map((m) => ({ value: m._id, label: m.name }))}
                value={selectedMedicineId}
                onValueChange={setSelectedMedicineId}
                placeholder="Search or select medicine"
                searchPlaceholder="Type to filter…"
                emptyMessage="No medicines match."
              />
            </div>
            <Button type="button" onClick={addMedicine} className="shrink-0">Add Medicine</Button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No medicines added yet.</p>
          ) : (
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
                  <TableHead>Line Offer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead></TableHead>
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
                        onValueChange={(value) => updateFrequency(idx, value)}
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
                          onChange={(e) => updateDuration(idx, e.target.value ? `${e.target.value} days` : "")}
                          placeholder="0"
                          className="pr-12"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          days
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.stockStatus === "no_stock" ? "-" : (
                        <SearchableCombobox
                          options={row.availableBatches.map((b) => ({
                            value: b._id,
                            label: `${b.batchNo} · exp ${format(new Date(b.expiryDate), "dd/MM/yy")} · ${b.currentStock}u · ${formatCurrency(b.sellingPrice)}`,
                          }))}
                          value={row.medicineStockId ?? ""}
                          onValueChange={(v) => updateBatch(idx, v)}
                          placeholder="Batch"
                          searchPlaceholder="Search batch…"
                          emptyMessage="No batches."
                          triggerClassName="h-9 min-w-[10rem] max-w-[220px]"
                          contentClassName="min-w-[18rem]"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {row.stockStatus === "no_stock"
                        ? <Badge className="bg-red-600">No Stock</Badge>
                        : getExpiryBadge(row.expiryDate)}
                    </TableCell>
                    <TableCell>
                      {row.stockStatus === "no_stock" ? "-" : (
                        <Input type="number" min={1} max={row.currentStock} value={row.quantity}
                          onChange={(e) => updateQty(idx, parseInt(e.target.value, 10) || 0)}
                          className="w-20" />
                      )}
                    </TableCell>
                    <TableCell>{row.stockStatus === "no_stock" ? "-" : formatCurrency(row.sellingPrice)}</TableCell>
                    <TableCell>
                      {row.stockStatus === "no_stock" ? "-" : (
                        <Input type="number" min={0} step="0.01" value={row.lineOffer || ""} placeholder="0"
                          onChange={(e) => updateLineOffer(idx, parseFloat(e.target.value) || 0)}
                          className="w-24 tabular-nums" />
                      )}
                    </TableCell>
                    <TableCell>{row.stockStatus === "no_stock" ? "-" : formatCurrency(row.totalPrice)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {items.length > 0 && (
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bill-offer">Offer on whole bill (₹)</Label>
                <Input id="bill-offer" type="number" min={0} step="0.01" value={billOffer || ""} placeholder="0"
                  onChange={(e) => setBillOffer(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="max-w-[12rem] tabular-nums" />
                <p className="text-xs text-muted-foreground">After line offers: {formatCurrency(linesNetSum)}{billOffer > 0 ? ` · Net: ${formatCurrency(grandTotal)}` : ""}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff + Payment + Submit */}
      {items.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Billed by</Label>
                <BillingStaffSelect
                  id="direct-staff"
                  label=""
                  value={generatedByName}
                  onValueChange={setGeneratedByName}
                  triggerClassName="w-full max-w-[18rem]"
                />
              </div>
              <div className="space-y-2">
                <PaymentMethodSelect
                  value={paymentMethodId}
                  onValueChange={setPaymentMethodId}
                  required={grandTotal > 0}
                  onOptionsLoaded={(opts) => setPaymentMethodId((id) => id || opts[0]?._id || "")}
                />
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-lg font-semibold">Net Total: {formatCurrency(grandTotal)}</p>
              <Button onClick={handleGenerateBill} disabled={submitting || billableItems.length === 0}>
                {submitting ? "Generating..." : "Generate Bill"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
