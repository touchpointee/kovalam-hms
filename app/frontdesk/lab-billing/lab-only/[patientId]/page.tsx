"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { X } from "lucide-react";
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
import { formatCurrency, formatPaymentMethodLabel } from "@/lib/utils";
import { PaymentMethodSelect } from "@/components/PaymentMethodSelect";
import { BillingStaffSelect, getBillingStaffDisplayName } from "@/components/BillingStaffSelect";
import { grandTotalAfterBillOffer, lineNetAfterOffer } from "@/lib/bill-offers";

const visitListBackHref = "/frontdesk/lab-billing";

type Patient = { _id: string; name: string; regNo: string; phone?: string; age?: number; address?: string; createdAt?: string };
type LabBillItem = {
  labTest?: string | { _id: string };
  labTestName: string;
  quantity: number;
  unitPrice: number;
  lineOffer?: number;
  totalPrice: number;
};
type LabBill = {
  _id: string;
  billedAt?: string;
  generatedByName?: string;
  billedBy?: { name?: string } | null;
  grandTotal: number;
  billOffer?: number;
  patient?: Patient;
  items?: LabBillItem[];
  paymentMethod?: { _id?: string; name?: string; code?: string } | null;
};
type CatalogTest = { _id: string; name: string; price: number };

type LabLineItem = {
  id: string;
  labTestId: string;
  labTestName: string;
  quantity: number;
  unitPrice: number;
  lineOffer: number;
  totalPrice: number;
};

function labTestIdFromItem(item: LabBillItem): string {
  const ref = item.labTest;
  if (ref && typeof ref === "object" && "_id" in ref) return String(ref._id);
  if (ref) return String(ref);
  return "";
}

function itemsFromLabBill(bill: LabBill | null, catalog: CatalogTest[]): LabLineItem[] {
  if (!bill?.items?.length) return [];
  return bill.items.map((item, i) => {
    let labTestId = labTestIdFromItem(item);
    if (!labTestId) {
      labTestId = catalog.find((c) => c.name === item.labTestName)?._id ?? "";
    }
    const qty = Math.max(1, Number(item.quantity) || 1);
    const unit = Number(item.unitPrice) || 0;
    const gross = unit * qty;
    const lineOffer = Number(item.lineOffer) || 0;
    return {
      id: `line-${i}-${labTestId || item.labTestName}`,
      labTestId,
      labTestName: item.labTestName,
      quantity: qty,
      unitPrice: unit,
      lineOffer,
      totalPrice: lineNetAfterOffer(gross, lineOffer),
    };
  });
}

export default function FrontdeskLabBillingLabOnlyPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const role = session?.user?.role;
  const canAdjustLabBill = isAdmin || role === "frontdesk" || role === "laboratory";
  const params = useParams<{ patientId: string }>();
  const patientId = params?.patientId ?? "";

  const [patient, setPatient] = useState<Patient | null>(null);
  const [catalog, setCatalog] = useState<CatalogTest[]>([]);
  const [items, setItems] = useState<LabLineItem[]>([]);
  const [selectedLabTestId, setSelectedLabTestId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bill, setBill] = useState<LabBill | null>(null);
  const [editingBill, setEditingBill] = useState(false);
  const [billOffer, setBillOffer] = useState(0);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [generatedByName, setGeneratedByName] = useState("");

  const hydrateFromStoredBill = useCallback((stored: LabBill | null, cat: CatalogTest[]) => {
    setItems(itemsFromLabBill(stored, cat));
    setBillOffer(Number(stored?.billOffer) || 0);
    const pm = stored?.paymentMethod;
    setPaymentMethodId(pm?._id ? String(pm._id) : "");
    setGeneratedByName(stored?.generatedByName?.trim() || "");
  }, []);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/patients/${patientId}`, { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/lab-tests", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/laboratory/bills?patientId=${patientId}&limit=1&page=1`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([patientData, labList, billList]) => {
        if (!patientData?._id) throw new Error("Patient not found");
        setPatient(patientData as Patient);
        const cat = Array.isArray(labList) ? labList : [];
        setCatalog(cat);
        const stored = Array.isArray(billList?.items) ? billList.items[0] : null;
        const hasBill = Boolean(stored?.items?.length);
        setBill(hasBill ? stored : null);
        hydrateFromStoredBill(hasBill ? stored : null, cat);
        setEditingBill(!hasBill);
      })
      .catch((e) => {
        setPatient(null);
        setBill(null);
        setItems([]);
        toast.error(e instanceof Error ? e.message : "Failed to load lab registration");
      })
      .finally(() => setLoading(false));
  }, [hydrateFromStoredBill, patientId]);

  useEffect(() => {
    if (catalog.length === 0 || !bill?.items?.length) return;
    setItems((prev) => {
      const needsId = prev.some((row) => !row.labTestId);
      if (!needsId) return prev;
      return prev.map((row) =>
        row.labTestId
          ? row
          : {
              ...row,
              labTestId: catalog.find((c) => c.name === row.labTestName)?._id ?? "",
            }
      );
    });
  }, [bill, catalog]);

  const addLabTest = () => {
    if (!selectedLabTestId) {
      toast.error("Select a lab test");
      return;
    }
    const test = catalog.find((t) => t._id === selectedLabTestId);
    if (!test) return;
    const unit = Number(test.price) || 0;
    setItems((prev) => [
      ...prev,
      {
        id: `${test._id}-${Math.random().toString(36).slice(2, 9)}`,
        labTestId: test._id,
        labTestName: test.name,
        quantity: 1,
        unitPrice: unit,
        lineOffer: 0,
        totalPrice: unit,
      },
    ]);
    setSelectedLabTestId("");
  };

  const updateItemQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setItems((prev) => {
      const next = [...prev];
      const row = next[idx];
      if (!row) return prev;
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
      if (!row) return prev;
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
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const linesNetSum = useMemo(
    () => items.reduce((sum, row) => sum + row.totalPrice, 0),
    [items]
  );
  const grandTotal = useMemo(
    () => grandTotalAfterBillOffer(linesNetSum, billOffer),
    [linesNetSum, billOffer]
  );

  const postLabItems = async (
    payload: { labTestId: string; quantity: number; lineOffer?: number }[],
    offerOnBill?: number,
    pmId?: string
  ) => {
    const res = await fetch("/api/laboratory/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        items: payload,
        ...(payload.length > 0 ? { billOffer: offerOnBill ?? 0 } : {}),
        ...(payload.length > 0 && pmId?.trim() ? { paymentMethodId: pmId.trim() } : {}),
        ...(payload.length > 0 ? { generatedByName } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message ?? "Failed to save lab bill");
    return data as LabBill | null;
  };

  const saveBill = async () => {
    if (!patient?._id) {
      toast.error("Patient details missing");
      return;
    }
    if (!generatedByName.trim()) {
      toast.error("Select staff before generating the bill");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one lab test");
      return;
    }
    const payload = items
      .filter((i) => i.labTestId)
      .map((i) => ({
        labTestId: i.labTestId,
        quantity: i.quantity,
        lineOffer: i.lineOffer > 0 ? i.lineOffer : undefined,
      }));
    if (payload.length === 0) {
      toast.error("Could not resolve lab test ids - re-add tests from the catalog");
      return;
    }
    if (grandTotal > 0 && !paymentMethodId.trim()) {
      toast.error("Select a payment method");
      return;
    }
    setSubmitting(true);
    try {
      const saved = await postLabItems(payload, billOffer, paymentMethodId);
      const hasSaved = Boolean(saved?.items?.length);
      setBill(hasSaved ? saved : null);
      hydrateFromStoredBill(hasSaved ? saved : null, catalog);
      setEditingBill(!hasSaved);
      toast.success(bill?._id ? "Lab bill updated" : "Lab bill generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save lab bill");
    } finally {
      setSubmitting(false);
    }
  };

  const clearLabBill = async () => {
    if (!patient?._id || !bill?._id) return;
    setSubmitting(true);
    try {
      await postLabItems([], 0);
      setBill(null);
      hydrateFromStoredBill(null, catalog);
      setEditingBill(true);
      toast.success("Lab bill cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear lab bill");
    } finally {
      setSubmitting(false);
    }
  };

  if (bill && bill.items && bill.items.length > 0 && !editingBill) {
    return (
      <PrintLayout
        title="Lab Bill"
        paper="landscape"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => window.print()}>
              Print
            </Button>
            <Button asChild variant="outline">
              <Link href={visitListBackHref}>Back to Lab Billing</Link>
            </Button>
            {canAdjustLabBill && (
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
                <span>Reg No</span>
                <span>: {bill.patient?.regNo ?? "-"}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span>Patient Name</span>
                <span>: {bill.patient?.name ?? "-"}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span>Phone</span>
                <span>: {bill.patient?.phone ?? "-"}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr]">
                <span>Address</span>
                <span>: {bill.patient?.address?.trim() || "-"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[150px_1fr]">
                <span>Registration date</span>
                <span>
                  :{" "}
                  {patient?.createdAt
                    ? format(new Date(patient.createdAt), "dd MMM yyyy, HH:mm")
                    : "-"}
                </span>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <span>Bill date and time</span>
                <span>
                  : {bill.billedAt ? format(new Date(bill.billedAt), "dd MMM yyyy, HH:mm") : "-"}
                </span>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <span>Age</span>
                <span>: {bill.patient?.age ?? "-"}</span>
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
                <th className="border border-slate-400 px-3 py-2 text-right font-semibold">Amount (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((row, i) => {
                const lo = Number(row.lineOffer) || 0;
                return (
                  <tr key={`${row.labTestName}-${i}`}>
                    <td className="border border-slate-400 px-3 py-2 align-top">{i + 1}</td>
                    <td className="border border-slate-400 px-3 py-2 align-top">{row.labTestName}</td>
                    <td className="border border-slate-400 px-3 py-2 text-center align-top">{row.quantity}</td>
                    <td className="border border-slate-400 px-3 py-2 text-right align-top">
                      {formatCurrency(row.unitPrice)}
                    </td>
                    <td className="border border-slate-400 px-3 py-2 text-right align-top">
                      {lo > 0 ? formatCurrency(lo) : "-"}
                    </td>
                    <td className="border border-slate-400 px-3 py-2 text-right align-top">
                      {formatCurrency(row.totalPrice)}
                    </td>
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
                    {lineOfferSum > 0 ? `-${formatCurrency(lineOfferSum)}` : "-"}
                  </div>
                  <div className="border-b border-slate-300 py-1">After line offers</div>
                  <div className="border-b border-slate-300 py-1 text-right">{formatCurrency(linesNet)}</div>
                  {bo > 0 ? (
                    <>
                      <div className="border-b border-slate-300 py-1">Bill offer</div>
                      <div className="border-b border-slate-300 py-1 text-right text-red-700">
                        -{formatCurrency(bo)}
                      </div>
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
        <h1 className="text-2xl font-semibold">Lab Billing Details</h1>
        <Button asChild variant="outline">
          <Link href={visitListBackHref}>Back</Link>
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading lab registration...</CardContent>
        </Card>
      ) : !patient ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Lab registration not found.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Lab Registration</CardTitle>
              <CardDescription>Lab billing is tied to this lab-only registration</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                <strong>Patient:</strong> {patient.name} ({patient.regNo})
              </p>
              <p>
                <strong>Registered:</strong>{" "}
                {patient.createdAt ? format(new Date(patient.createdAt), "dd MMM yyyy, HH:mm") : "-"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lab Test Items</CardTitle>
              <CardDescription>
                Search Admin -&gt; Lab Tests, add lines, then generate or update the bill.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-xl border border-blue-100 bg-slate-50/60 p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="grid min-w-[min(100%,18rem)] flex-1 gap-2 sm:max-w-md">
                    <Label>Add lab test</Label>
                    <SearchableCombobox
                      options={catalog.map((t) => ({
                        value: t._id,
                        label: `${t.name} - ${formatCurrency(Number(t.price) || 0)}`,
                        keywords: t.name,
                      }))}
                      value={selectedLabTestId}
                      onValueChange={setSelectedLabTestId}
                      placeholder="Search or select lab test"
                      searchPlaceholder="Type to filter..."
                      emptyMessage="No lab tests match."
                    />
                  </div>
                  <Button type="button" className="shrink-0" onClick={addLabTest}>
                    Add lab test
                  </Button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lab tests added.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lab test</TableHead>
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
                          <TableCell>{row.labTestName}</TableCell>
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
                    <Label htmlFor="lab-bill-offer">Offer on whole bill (amount)</Label>
                    <Input
                      id="lab-bill-offer"
                      type="number"
                      min={0}
                      step="0.01"
                      value={billOffer || ""}
                      placeholder="0"
                      onChange={(e) => setBillOffer(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="max-w-[12rem] tabular-nums"
                    />
                    <p className="text-xs text-muted-foreground">
                      Line totals after line offers: {formatCurrency(linesNetSum)}
                      {billOffer > 0 ? ` - After bill offer: ${formatCurrency(grandTotal)}` : ""}
                    </p>
                  </div>
                  <div className="mt-4 flex max-w-md flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                    <Label htmlFor="lab-generated-by">Name to show on bill</Label>
                    <BillingStaffSelect
                      id="lab-generated-by"
                      label=""
                      value={generatedByName}
                      onValueChange={setGeneratedByName}
                      className="max-w-[18rem]"
                      triggerClassName="w-full max-w-[18rem]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Prints as a small &quot;Generated by&quot; line on the bill.
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
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Net total: {formatCurrency(grandTotal)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {canAdjustLabBill && bill?._id ? (
                        <Button type="button" variant="outline" onClick={clearLabBill} disabled={submitting}>
                          {submitting ? "Saving..." : "Clear lab bill"}
                        </Button>
                      ) : null}
                      <Button onClick={saveBill} disabled={submitting || items.length === 0}>
                        {submitting ? (bill?._id ? "Updating..." : "Generating...") : bill?._id ? "Update Bill" : "Generate Bill"}
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
