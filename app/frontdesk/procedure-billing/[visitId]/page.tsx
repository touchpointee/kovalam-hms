"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { PrintLayout } from "@/components/PrintLayout";
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
import { formatCurrency } from "@/lib/utils";

type Patient = { _id: string; name: string; regNo: string };
type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  patient?: Patient;
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
  totalPrice: number;
};
type ProcedureBill = {
  _id: string;
  patient?: Patient;
  billedAt?: string;
  items: ProcedureItem[];
  grandTotal: number;
};
type StoredProcedureBill = {
  _id: string;
  patient?: Patient;
  billedAt?: string;
  items: Array<{
    procedure?: { _id?: string; name?: string; price?: number };
    procedureName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  grandTotal: number;
};

export default function FrontdeskVisitProcedureBillingPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
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

  const hydrateStoredBillItems = useCallback((storedBill: StoredProcedureBill) => {
    const rows = storedBill.items.map((item) => ({
      id: `${item.procedure?._id ?? item.procedureName}-${Math.random().toString(36).slice(2, 9)}`,
      procedureId: item.procedure?._id ?? "",
      procedureName: item.procedureName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));
    setItems(rows);
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
        totalPrice: procedure.price,
      },
    ]);
    setSelectedProcedureId("");
  };

  const updateItemQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], quantity: qty, totalPrice: next[idx].unitPrice * qty };
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== idx));
  };

  const grandTotal = useMemo(() => items.reduce((sum, item) => sum + item.totalPrice, 0), [items]);

  const saveBill = async () => {
    if (!visit?.patient?._id || items.length === 0) {
      toast.error("Add at least one procedure");
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
          items: items.map((item) => ({ procedureId: item.procedureId, quantity: item.quantity })),
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
        actions={
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => window.print()}>Print</Button>
            <Button asChild variant="outline">
              <Link href={visitListBackHref}>Back to Visit List</Link>
            </Button>
            {isAdmin && (
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
              <div className="grid grid-cols-[120px_1fr]"><span>Address</span><span>: -</span></div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[150px_1fr]"><span>Appointment Date</span><span>: {bill.billedAt ? format(new Date(bill.billedAt), "dd-MM-yyyy") : "-"}</span></div>
              <div className="grid grid-cols-[150px_1fr]"><span>Age</span><span>: -</span></div>
              <div className="grid grid-cols-[150px_1fr]"><span>Consultant Doctor</span><span>: -</span></div>
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
                  <td className="border border-slate-400 px-3 py-2 align-top">{row.procedureName}</td>
                  <td className="border border-slate-400 px-3 py-2 text-center align-top">{row.quantity}</td>
                  <td className="border border-slate-400 px-3 py-2 text-right align-top">{formatCurrency(row.unitPrice)}</td>
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
              <CardDescription>Add procedures and generate bill</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border p-4">
                <div className="grid min-w-[260px] gap-2">
                  <Label>Add Procedure</Label>
                  <Select value={selectedProcedureId} onValueChange={setSelectedProcedureId}>
                    <SelectTrigger><SelectValue placeholder="Select procedure" /></SelectTrigger>
                    <SelectContent>
                      {procedures.map((procedure) => (
                        <SelectItem key={procedure._id} value={procedure._id}>{procedure.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={addProcedure}>Add Procedure</Button>
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
                        <TableHead>Total</TableHead>
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
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm font-semibold">Total: {formatCurrency(grandTotal)}</p>
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
