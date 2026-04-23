"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { BillSectionHeading, BillSignature, PrintLayout } from "@/components/PrintLayout";
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
import { formatCurrency, formatPaymentMethodLabel } from "@/lib/utils";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import { BillingStaffSelect, getBillingStaffDisplayName } from "@/components/BillingStaffSelect";
import {
  grandTotalAfterBillOffer,
  lineNetAfterOffer,
} from "@/lib/bill-offers";

type Procedure = {
  _id: string;
  name: string;
  price: number;
};

type ProcedureItem = {
  id: string;
  procedureId: string;
  procedureName: string;
  quantity: number;
  unitPrice: number;
  lineOffer: number;
  totalPrice: number;
};

type SavedBill = {
  _id: string;
  patient?: { _id: string; name: string; regNo: string; phone?: string; age?: number; address?: string };
  billedAt?: string;
  generatedByName?: string;
  billedBy?: { name?: string } | null;
  items: ProcedureItem[];
  grandTotal: number;
  billOffer?: number;
  paymentMethod?: { _id?: string; name?: string; code?: string } | null;
};

export default function DirectProcedureSalePage() {
  const router = useRouter();
  const pathname = usePathname();
  const backHref = "/frontdesk/procedure-billing";

  // Step: "form" | "bill"
  const [step, setStep] = useState<"form" | "bill">("form");
  const [savedBill, setSavedBill] = useState<SavedBill | null>(null);

  // Patient fields
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientAge, setPatientAge] = useState("");

  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [items, setItems] = useState<ProcedureItem[]>([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [billOffer, setBillOffer] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [generatedByName, setGeneratedByName] = useState("");

  useEffect(() => {
    fetch("/api/procedures", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setProcedures(Array.isArray(data) ? data : []))
      .catch(() => setProcedures([]));
  }, []);

  const addProcedure = () => {
    if (!selectedProcedureId) {
      toast.error("Select a procedure");
      return;
    }
    const procedure = procedures.find((item) => item._id === selectedProcedureId);
    if (!procedure) return;
    setItems((prev) => [
      ...prev,
      {
        id: `${procedure._id}-${Math.random().toString(36).slice(2, 9)}`,
        procedureId: procedure._id,
        procedureName: procedure.name,
        quantity: 1,
        unitPrice: procedure.price,
        lineOffer: 0,
        totalPrice: procedure.price,
      },
    ]);
    setSelectedProcedureId("");
  };

  const updateItemQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setItems((prev) => {
      const next = [...prev];
      const row = next[idx];
      const gross = row.unitPrice * qty;
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
      const gross = row.unitPrice * row.quantity;
      const lineOffer = Math.max(0, raw);
      next[idx] = {
        ...row,
        lineOffer,
        totalPrice: lineNetAfterOffer(gross, lineOffer),
      };
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== idx));
  };

  const linesNetSum = useMemo(
    () => items.reduce((sum, item) => sum + item.totalPrice, 0),
    [items]
  );
  const grandTotal = useMemo(
    () => grandTotalAfterBillOffer(linesNetSum, billOffer),
    [linesNetSum, billOffer]
  );

  const saveBill = async () => {
    if (!patientName.trim()) { toast.error("Enter patient name"); return; }
    if (!patientPhone.trim()) { toast.error("Enter phone number"); return; }
    if (items.length === 0) {
      toast.error("Add at least one procedure");
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
      // 1. Register Quick Patient
      const patRes = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: patientName.trim(),
          phone: patientPhone.trim(),
          age: parseInt(patientAge, 10) || 0,
          gender: "other",
          registrationType: "procedure",
        }),
      });
      const patData = await patRes.json();
      if (!patRes.ok) throw new Error(patData.message || "Failed to register patient");

      // 2. Build Bill
      const res = await fetch("/api/billing/procedure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patData._id,
          billOffer,
          ...(grandTotal > 0 && paymentMethodId.trim()
            ? { paymentMethodId: paymentMethodId.trim() }
            : {}),
          generatedByName,
          items: items.map((item) => ({
            procedureId: item.procedureId,
            quantity: item.quantity,
            ...(item.lineOffer > 0 ? { lineOffer: item.lineOffer } : {}),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to save bill");
      
      setSavedBill(data as SavedBill);
      setStep("bill");
      toast.success("Procedure bill generated!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save bill");
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

  if (step === "bill" && savedBill) {
    return (
      <PrintLayout
        title="Procedure Bill"
        paper="landscape"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => window.print()}>Print</Button>
            <Button variant="outline" onClick={() => router.push(backHref)}>Back to Procedure Billing</Button>
            <Button variant="outline" onClick={handleReset}>New Direct Sale</Button>
          </div>
        }
      >
        <div className="space-y-4 print-only">
          <div className="grid grid-cols-2 gap-8 border-y border-slate-400 py-4 text-[15px]">
            <div className="space-y-2">
              <div className="grid grid-cols-[120px_1fr]"><span>DMC ID</span><span>: {savedBill.patient?.regNo ?? "-"}</span></div>
              <div className="grid grid-cols-[120px_1fr]"><span>Patient Name</span><span>: {savedBill.patient?.name ?? "-"}</span></div>
              <div className="grid grid-cols-[120px_1fr]"><span>Phone</span><span>: {savedBill.patient?.phone ?? "-"}</span></div>
              <div className="grid grid-cols-[120px_1fr]"><span>Address</span><span>: {savedBill.patient?.address?.trim() || "-"}</span></div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[150px_1fr]">
                <span>Bill date and time</span>
                <span>
                  : {savedBill.billedAt ? format(new Date(savedBill.billedAt), "dd MMM yyyy, HH:mm") : "—"}
                </span>
              </div>
              <div className="grid grid-cols-[150px_1fr]"><span>Age</span><span>: {savedBill.patient?.age ?? "-"}</span></div>
              <div className="grid grid-cols-[150px_1fr] invisible">
                <span>Consultant Doctor</span>
                <span>: —</span>
              </div>
            </div>
          </div>
          <BillSectionHeading label="Procedure Bill" />
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
              {savedBill.items.map((row, i) => {
                const lo = Number(row.lineOffer) || 0;
                return (
                  <tr key={i}>
                    <td className="border border-slate-400 px-3 py-2 align-top">{i + 1}</td>
                    <td className="border border-slate-400 px-3 py-2 align-top">{row.procedureName}</td>
                    <td className="border border-slate-400 px-3 py-2 text-center align-top">{row.quantity}</td>
                    <td className="border border-slate-400 px-3 py-2 text-right align-top">{formatCurrency(row.unitPrice)}</td>
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
            const grossSum = savedBill.items.reduce(
              (s, r) => s + Number(r.unitPrice) * Number(r.quantity),
              0
            );
            const lineOfferSum = savedBill.items.reduce((s, r) => s + (Number(r.lineOffer) || 0), 0);
            const linesNet = savedBill.items.reduce((s, r) => s + Number(r.totalPrice), 0);
            const bo = Number(savedBill.billOffer) || 0;
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
                  {formatPaymentMethodLabel(savedBill.paymentMethod) ? (
                    <>
                      <div className="border-b border-slate-300 py-1">Payment method</div>
                      <div className="border-b border-slate-300 py-1 text-right">
                        {formatPaymentMethodLabel(savedBill.paymentMethod)}
                      </div>
                    </>
                  ) : null}
                  <div className="py-1 font-semibold">Net amount</div>
                  <div className="py-1 text-right font-semibold">{formatCurrency(savedBill.grandTotal)}</div>
                </div>
                <BillSignature
                  staffName={getBillingStaffDisplayName(savedBill.generatedByName) || savedBill.billedBy?.name?.trim()}
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
        <h1 className="text-2xl font-semibold">Direct Procedure Sale</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
          <Button variant="outline" onClick={() => router.push(backHref)}>Back to Procedure Hub</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Walk-in Patient Details</CardTitle>
          <CardDescription>Enter basic details — no separate OP registration needed.</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Procedure Items</CardTitle>
          <CardDescription>Search the catalog to add procedures, then generate the bill.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-xl border border-blue-100 bg-slate-50/60 p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="grid min-w-[min(100%,18rem)] flex-1 gap-2 sm:max-w-md">
                <Label>Add procedure</Label>
                <SearchableCombobox
                  options={procedures.map((p) => ({ value: p._id, label: p.name }))}
                  value={selectedProcedureId}
                  onValueChange={setSelectedProcedureId}
                  placeholder="Search or select procedure"
                  searchPlaceholder="Type to filter…"
                  emptyMessage="No procedures match."
                />
              </div>
              <Button type="button" className="shrink-0" onClick={addProcedure}>
                Add procedure
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No procedures added.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Procedure</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Line offer</TableHead>
                    <TableHead>Line total</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.procedureName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => updateItemQty(idx, parseInt(e.target.value, 10) || 1)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>{formatCurrency(row.unitPrice)}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>{formatCurrency(row.totalPrice)}</TableCell>
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
                <Label htmlFor="proc-bill-offer">Offer on whole bill (amount)</Label>
                <Input
                  id="proc-bill-offer"
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
                <Label htmlFor="proc-generated-by">Name to show on bill</Label>
                <BillingStaffSelect
                  id="proc-generated-by"
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
                <Button onClick={saveBill} disabled={submitting || items.length === 0}>
                  {submitting ? "Generating..." : "Generate Bill"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
