"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { BillSignature, PrintLayout } from "@/components/PrintLayout";
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

type Patient = { _id: string; name: string; regNo: string; phone?: string; age?: number; address?: string };
type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  patient?: Patient;
  doctor?: { name?: string } | null;
  procedureBills?: Array<{ _id: string }>;
};
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
type ProcedureBill = {
  _id: string;
  patient?: Patient;
  billedAt?: string;
  generatedByName?: string;
  billedBy?: { name?: string } | null;
  items: ProcedureItem[];
  grandTotal: number;
  billOffer?: number;
  paymentMethod?: { _id?: string; name?: string; code?: string } | null;
};
type StoredProcedureBill = {
  _id: string;
  patient?: Patient;
  billedAt?: string;
  generatedByName?: string;
  billedBy?: { name?: string } | null;
  billOffer?: number;
  paymentMethod?: { _id?: string; name?: string; code?: string } | null;
  items: Array<{
    procedure?: { _id?: string; name?: string; price?: number };
    procedureName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    lineOffer?: number;
  }>;
  grandTotal: number;
};

export default function FrontdeskVisitProcedureBillingPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const canEditProcedureBill = isAdmin || session?.user?.role === "frontdesk";
  const pathname = usePathname();
  const visitListBackHref = pathname.startsWith("/admin/") ? "/admin/visits" : "/frontdesk/procedure-billing";
  const params = useParams<{ visitId: string }>();
  const visitId = params?.visitId ?? "";

  const [visit, setVisit] = useState<Visit | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [items, setItems] = useState<ProcedureItem[]>([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bill, setBill] = useState<ProcedureBill | null>(null);
  const [editingBill, setEditingBill] = useState(false);
  const [billOffer, setBillOffer] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [generatedByName, setGeneratedByName] = useState("");

  const hydrateStoredBillItems = useCallback((storedBill: StoredProcedureBill) => {
    const rows = storedBill.items.map((item) => {
      const gross = item.unitPrice * item.quantity;
      const lineOffer = Number(item.lineOffer) || 0;
      return {
        id: `${item.procedure?._id ?? item.procedureName}-${Math.random().toString(36).slice(2, 9)}`,
        procedureId: item.procedure?._id ?? "",
        procedureName: item.procedureName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineOffer,
        totalPrice: lineNetAfterOffer(gross, lineOffer),
      };
    });
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
      fetch("/api/procedures", { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(async ([visitData, procedureList]) => {
        if (!visitData?._id || !visitData?.patient?._id) throw new Error("Visit not found");
        setVisit(visitData as Visit);
        setProcedures(Array.isArray(procedureList) ? procedureList : []);

        const existingBillId = Array.isArray(visitData.procedureBills) && visitData.procedureBills.length > 0
          ? visitData.procedureBills[0]?._id
          : undefined;

        if (existingBillId) {
          const res = await fetch(`/api/billing/procedure/${existingBillId}`, { cache: "no-store" });
          const storedBill = await res.json();
          setBill(storedBill as ProcedureBill);
          setEditingBill(false);
          hydrateStoredBillItems(storedBill as StoredProcedureBill);
        } else {
          setBill(null);
          setBillOffer(0);
          setPaymentMethodId("");
          setGeneratedByName("");
          setEditingBill(true);
        }
      })
      .catch((error) => {
        setVisit(null);
        setProcedures([]);
        setItems([]);
        toast.error(error instanceof Error ? error.message : "Failed to load visit");
      })
      .finally(() => setLoading(false));
  }, [hydrateStoredBillItems, visitId]);

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
    if (!visit?.patient?._id || items.length === 0) {
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
      const isUpdate = Boolean(bill?._id);
      const res = await fetch(isUpdate ? `/api/billing/procedure/${bill?._id}` : "/api/billing/procedure", {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: visit.patient._id,
          visitId: visit._id,
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
      setBill(data as ProcedureBill);
      setEditingBill(false);
      toast.success(isUpdate ? "Procedure bill updated" : "Procedure bill generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save bill");
    } finally {
      setSubmitting(false);
    }
  };

  if (bill && !editingBill) {
    return (
      <PrintLayout
        title="Procedure Bill"
        paper="landscape"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => window.print()}>Print</Button>
            <Button asChild variant="outline">
              <Link href={visitListBackHref}>Back to Visit List</Link>
            </Button>
            {canEditProcedureBill && (
              <Button variant="outline" onClick={() => setEditingBill(true)}>Edit Bill</Button>
            )}
          </div>
        }
      >
        <div className="space-y-4 print-only">
          <div className="grid grid-cols-2 gap-8 border-y border-slate-400 py-4 text-[15px]">
            <div className="space-y-2">
              <div className="grid grid-cols-[120px_1fr]"><span>DMC ID</span><span>: {bill.patient?.regNo ?? "-"}</span></div>
              <div className="grid grid-cols-[120px_1fr]"><span>Patient Name</span><span>: {bill.patient?.name ?? "-"}</span></div>
              <div className="grid grid-cols-[120px_1fr]"><span>Phone</span><span>: {bill.patient?.phone ?? "-"}</span></div>
              <div className="grid grid-cols-[120px_1fr]"><span>Address</span><span>: {bill.patient?.address?.trim() || "-"}</span></div>
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
              <div className="grid grid-cols-[150px_1fr]"><span>Age</span><span>: {bill.patient?.age ?? "-"}</span></div>
              <div className="grid grid-cols-[150px_1fr]">
                <span>Consultant Doctor</span>
                <span>: {visit?.doctor?.name?.trim() ? visit.doctor.name : "—"}</span>
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
            const grossSum = bill.items.reduce(
              (s, r) => s + Number(r.unitPrice) * Number(r.quantity),
              0
            );
            const lineOfferSum = bill.items.reduce((s, r) => s + (Number(r.lineOffer) || 0), 0);
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
        <h1 className="text-2xl font-semibold">Procedure Billing Details</h1>
        <Button asChild variant="outline">
          <Link href={visitListBackHref}>Back</Link>
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Loading visit details...</CardContent></Card>
      ) : !visit ? (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Visit not found.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Visit</CardTitle>
              <CardDescription>Procedure billing is locked to this visit only</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <p><strong>Patient:</strong> {visit.patient?.name} ({visit.patient?.regNo})</p>
              <p><strong>Receipt:</strong> {visit.receiptNo ?? "-"} | <strong>Time:</strong> {format(new Date(visit.visitDate), "dd MMM yyyy, HH:mm")}</p>
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
