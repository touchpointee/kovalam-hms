"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePharmacyBase } from "@/hooks/usePharmacyBase";
import { differenceInDays, format } from "date-fns";
import toast from "react-hot-toast";
import { ArrowLeft, FileText, Pill, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";

type Medicine = {
  _id: string;
  name: string;
  genericName?: string;
  category?: string;
  manufacturer?: string;
  unit?: string;
  minQuantity?: number;
  maxQuantity?: number;
};

type StockBatch = {
  _id: string;
  batchNo: string;
  expiryDate: string;
  mrp: number;
  sellingPrice: number;
  quantityIn: number;
  quantityOut: number;
  currentStock: number;
  minQuantity?: number;
  maxQuantity?: number;
  location?: string;
  supplier?: string;
  medicine?: Medicine;
};

type StockTransaction = {
  _id: string;
  transactionType: "in" | "out" | "adjustment";
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  referenceNumber?: string;
  createdAt: string;
  performedBy?: { name?: string };
};

type SupplierOption = {
  _id: string;
  name: string;
};

export default function MedicineBatchPage() {
  const pharmacyBase = usePharmacyBase();
  const params = useParams<{ medicineId: string }>();
  const medicineId = params?.medicineId ?? "";

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "out" | "low" | "in">("all");
  const [search, setSearch] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [txOpen, setTxOpen] = useState<StockBatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    batchNo: "",
    expiryDate: "",
    mrp: "",
    sellingPrice: "",
    quantityIn: "",
    location: "",
    supplier: "",
  });
  const [txType, setTxType] = useState<"in" | "out" | "adjustment">("in");
  const [txQty, setTxQty] = useState("1");
  const [txReason, setTxReason] = useState("");
  const [txReference, setTxReference] = useState("");

  const loadBatches = useCallback(async () => {
    if (!medicineId) {
      setBatches([]);
      return;
    }

    const params = new URLSearchParams({ medicineId });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());

    const res = await fetch(`/api/stock?${params}`, { cache: "no-store" });
    const data = await res.json();
    setBatches(Array.isArray(data) ? data : []);
  }, [medicineId, search, statusFilter]);

  const loadTransactions = useCallback(async () => {
    if (!medicineId) {
      setTransactions([]);
      return;
    }

    const params = new URLSearchParams({ medicineId });
    if (historyFrom) params.set("from", historyFrom);
    if (historyTo) params.set("to", historyTo);

    const res = await fetch(`/api/stock/transactions?${params}`, { cache: "no-store" });
    const data = await res.json();
    setTransactions(Array.isArray(data) ? data : []);
  }, [historyFrom, historyTo, medicineId]);

  const loadSuppliers = useCallback(async () => {
    const res = await fetch("/api/suppliers", { cache: "no-store" });
    const data = await res.json();
    setSuppliers(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    const loadPage = async () => {
      if (!medicineId) return;

      setLoading(true);
      try {
        const medicinesRes = await fetch("/api/medicines", { cache: "no-store" });
        const medicinesData = await medicinesRes.json();
        const rows = Array.isArray(medicinesData) ? (medicinesData as Medicine[]) : [];
        setMedicine(rows.find((item) => item._id === medicineId) ?? null);
        await loadSuppliers();
      } catch {
        setMedicine(null);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [medicineId, loadSuppliers]);

  useEffect(() => {
    loadBatches().catch(() => setBatches([]));
  }, [loadBatches]);

  useEffect(() => {
    loadTransactions().catch(() => setTransactions([]));
  }, [loadTransactions]);

  const getExpiryBadge = (expiryDate: string) => {
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return <Badge className="bg-red-600">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500">{"<"}30d</Badge>;
    if (days <= 90) return <Badge className="bg-yellow-500 text-black">30-90d</Badge>;
    return <Badge className="bg-green-600">{">"}90d</Badge>;
  };

  const resetAddForm = () => {
    setAddForm({
      batchNo: "",
      expiryDate: "",
      mrp: "",
      sellingPrice: "",
      quantityIn: "",
      location: "",
      supplier: "",
    });
  };

  const addBatch = async () => {
    if (!medicineId || !addForm.batchNo || !addForm.expiryDate || !addForm.mrp || !addForm.sellingPrice || !addForm.quantityIn) {
      toast.error("Fill all required fields");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineId,
          batchNo: addForm.batchNo,
          expiryDate: addForm.expiryDate,
          mrp: Number(addForm.mrp),
          sellingPrice: Number(addForm.sellingPrice),
          quantityIn: parseInt(addForm.quantityIn, 10),
          location: addForm.location,
          supplier: addForm.supplier,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");

      toast.success("Batch added");
      setAddOpen(false);
      resetAddForm();
      await Promise.all([loadBatches(), loadTransactions()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const submitTransaction = async () => {
    if (!txOpen || txQty === "" || parseInt(txQty, 10) <= 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/stock/${txOpen._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionType: txType,
          quantity: parseInt(txQty, 10),
          reason: txReason,
          referenceNumber: txReference,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");

      toast.success("Stock updated");
      setTxOpen(null);
      setTxQty("1");
      setTxReason("");
      setTxReference("");
      setTxType("in");
      await Promise.all([loadBatches(), loadTransactions()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const totalItems = batches.length;
  const outOfStock = batches.filter((batch) => batch.currentStock === 0).length;
  const lowStock = batches.filter((batch) => batch.currentStock > 0 && batch.currentStock < (batch.minQuantity ?? 10)).length;
  const inStock = batches.filter((batch) => batch.currentStock >= (batch.minQuantity ?? 10)).length;

  const totalIn = useMemo(
    () => transactions.filter((item) => item.transactionType === "in").reduce((sum, item) => sum + item.quantity, 0),
    [transactions]
  );
  const totalOut = useMemo(
    () => transactions.filter((item) => item.transactionType === "out").reduce((sum, item) => sum + item.quantity, 0),
    [transactions]
  );
  const adjustments = useMemo(
    () => transactions.filter((item) => item.transactionType === "adjustment").length,
    [transactions]
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <Link href={`${pharmacyBase}/stock`} className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to medicines
            </Link>
            <div>
              <h1 className="text-3xl font-semibold text-slate-800">{medicine?.name ?? "Medicine Batches"}</h1>
              <p className="text-sm text-slate-500">
                {medicine?.genericName || medicine?.manufacturer || "Manage stock batches and transactions for this medicine."}
              </p>
              <p className="text-xs text-slate-500">
                Min Qty: {medicine?.minQuantity ?? 10} | Max Qty: {medicine?.maxQuantity ?? "-"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-emerald-200 bg-emerald-50 text-teal-700">
              <FileText className="mr-2 h-4 w-4" />
              View Reports
            </Button>
            <Button onClick={() => setAddOpen(true)} className="bg-teal-600 text-white hover:bg-teal-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Batch
            </Button>
            <Button asChild variant="outline">
              <Link href={`${pharmacyBase}/suppliers`}>Manage Suppliers</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Input placeholder="Search batch no..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={statusFilter} onValueChange={(value: "all" | "out" | "low" | "in") => setStatusFilter(value)}>
            <SelectTrigger><SelectValue placeholder="All Stock Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock Status</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="in">In Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Total Batches</p>
            <p className="text-3xl font-semibold text-slate-800">{totalItems}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Out of Stock</p>
            <p className="text-3xl font-semibold text-slate-800">{outOfStock}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Low Stock</p>
            <p className="text-3xl font-semibold text-slate-800">{lowStock}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">In Stock</p>
            <p className="text-3xl font-semibold text-slate-800">{inStock}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-100">
          {loading ? (
            <Skeleton className="h-64" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Selling Price</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No batches found.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow key={batch._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4 text-rose-400" />
                          <div>
                            <p className="font-medium text-slate-800">{batch.batchNo}</p>
                            <p className="text-xs text-slate-500">{batch.location || "No location"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p>{format(new Date(batch.expiryDate), "dd MMM yyyy")}</p>
                          {getExpiryBadge(batch.expiryDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{batch.currentStock}</p>
                        <p className="text-xs text-slate-500">Min: {batch.minQuantity ?? 10}</p>
                      </TableCell>
                      <TableCell>
                        {batch.currentStock === 0 ? (
                          <Badge className="bg-red-100 text-red-700">Out of Stock</Badge>
                        ) : batch.currentStock < (batch.minQuantity ?? 10) ? (
                          <Badge className="bg-amber-100 text-amber-700">Low Stock</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(batch.mrp)}</TableCell>
                      <TableCell>{formatCurrency(batch.sellingPrice)}</TableCell>
                      <TableCell>{batch.supplier || "NA"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <button
                            type="button"
                            className="text-teal-700 hover:underline"
                            onClick={() => {
                              setTxOpen(batch);
                              setTxQty("1");
                              setTxReason("");
                              setTxReference("");
                              setTxType("in");
                            }}
                          >
                            Stock In/Out
                          </button>
                          <button
                            type="button"
                            className="text-teal-700 hover:underline"
                            onClick={() => {
                              setTxOpen(batch);
                              setTxQty(String(batch.currentStock));
                              setTxReason("Manual adjustment");
                              setTxReference("");
                              setTxType("adjustment");
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Stock Batch</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Medicine</Label>
              <Input value={medicine?.name ?? ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Batch No *</Label>
              <Input value={addForm.batchNo} onChange={(e) => setAddForm((form) => ({ ...form, batchNo: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Expiry Date *</Label>
              <Input type="date" value={addForm.expiryDate} onChange={(e) => setAddForm((form) => ({ ...form, expiryDate: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>MRP *</Label>
              <Input type="number" min="0" value={addForm.mrp} onChange={(e) => setAddForm((form) => ({ ...form, mrp: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Selling Price *</Label>
              <Input type="number" min="0" value={addForm.sellingPrice} onChange={(e) => setAddForm((form) => ({ ...form, sellingPrice: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Quantity In *</Label>
              <Input type="number" min="1" value={addForm.quantityIn} onChange={(e) => setAddForm((form) => ({ ...form, quantityIn: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input value={addForm.location} onChange={(e) => setAddForm((form) => ({ ...form, location: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Select value={addForm.supplier} onValueChange={(value) => setAddForm((form) => ({ ...form, supplier: value }))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier._id} value={supplier.name}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addBatch} disabled={saving}>{saving ? "Saving..." : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!txOpen} onOpenChange={() => setTxOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Stock Transaction</DialogTitle></DialogHeader>
          {txOpen && (
            <p className="text-sm">Batch: {txOpen.batchNo}. Current stock: {txOpen.currentStock}.</p>
          )}
          <div className="grid gap-4">
            <div>
              <Label>Transaction Type</Label>
              <Select value={txType} onValueChange={(value: "in" | "out" | "adjustment") => setTxType(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Stock In</SelectItem>
                  <SelectItem value="out">Stock Out</SelectItem>
                  <SelectItem value="adjustment">Adjustment (absolute quantity)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} value={txQty} onChange={(e) => setTxQty(e.target.value)} placeholder="e.g. 5" />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input value={txReason} onChange={(e) => setTxReason(e.target.value)} />
            </div>
            <div>
              <Label>Reference Number (optional)</Label>
              <Input value={txReference} onChange={(e) => setTxReference(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(null)}>Cancel</Button>
            <Button onClick={submitTransaction} disabled={saving || !txQty}>{saving ? "..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-emerald-100 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Transaction History</h2>
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="w-40" />
            <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="w-40" />
            <Button variant="outline" onClick={() => loadTransactions()}>Refresh</Button>
          </div>
        </div>
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-emerald-50 p-3">
            <p className="text-sm text-slate-600">Total In</p>
            <p className="text-xl font-semibold">{totalIn}</p>
          </div>
          <div className="rounded-lg border bg-emerald-50 p-3">
            <p className="text-sm text-slate-600">Total Out</p>
            <p className="text-xl font-semibold">{totalOut}</p>
          </div>
          <div className="rounded-lg border bg-emerald-50 p-3">
            <p className="text-sm text-slate-600">Adjustments</p>
            <p className="text-xl font-semibold">{adjustments}</p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Previous</TableHead>
              <TableHead>New</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">No transactions.</TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow key={transaction._id}>
                  <TableCell>{format(new Date(transaction.createdAt), "dd MMM yyyy HH:mm")}</TableCell>
                  <TableCell className="uppercase">{transaction.transactionType}</TableCell>
                  <TableCell>{transaction.quantity}</TableCell>
                  <TableCell>{transaction.previousQuantity}</TableCell>
                  <TableCell>{transaction.newQuantity}</TableCell>
                  <TableCell>{transaction.reason || "-"}</TableCell>
                  <TableCell>{transaction.referenceNumber || "-"}</TableCell>
                  <TableCell>{transaction.performedBy?.name || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
