"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { usePharmacyBase } from "@/hooks/usePharmacyBase";
import { differenceInDays, format } from "date-fns";
import toast from "react-hot-toast";
import { ArrowLeft, Pill, Plus } from "lucide-react";
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

type StoreBatch = StockBatch;

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

export default function MedicineBatchPage() {
  const pharmacyBase = usePharmacyBase();
  const isAdminView = pharmacyBase.startsWith("/admin");
  const params = useParams<{ medicineId: string }>();
  const medicineId = params?.medicineId ?? "";

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [storeBatches, setStoreBatches] = useState<StoreBatch[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "out" | "low" | "in">("all");
  const [search, setSearch] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [txOpen, setTxOpen] = useState<StockBatch | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<StockBatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState("");
  const [transferQty, setTransferQty] = useState("1");
  const [transferReason, setTransferReason] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [txType, setTxType] = useState<"in" | "out" | "adjustment">("out");
  const [txQty, setTxQty] = useState("1");
  const [txReason, setTxReason] = useState("");
  const [txReference, setTxReference] = useState("");
  const [editForm, setEditForm] = useState({
    batchNo: "",
    expiryDate: "",
    mrp: "",
    sellingPrice: "",
    currentStock: "",
    location: "",
    supplier: "",
    reason: "",
  });

  const loadBatches = useCallback(async () => {
    if (!medicineId) {
      setBatches([]);
      return;
    }

    const params = new URLSearchParams({ medicineId, inventoryType: "pharmacy" });
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

    const params = new URLSearchParams({ medicineId, inventoryType: "pharmacy" });
    if (historyFrom) params.set("from", historyFrom);
    if (historyTo) params.set("to", historyTo);

    const res = await fetch(`/api/stock/transactions?${params}`, { cache: "no-store" });
    const data = await res.json();
    setTransactions(Array.isArray(data) ? data : []);
  }, [historyFrom, historyTo, medicineId]);

  const loadStoreBatches = useCallback(async () => {
    if (!medicineId) {
      setStoreBatches([]);
      return;
    }
    const res = await fetch(`/api/stock?medicineId=${medicineId}&inventoryType=store`, { cache: "no-store" });
    const data = await res.json();
    setStoreBatches(Array.isArray(data) ? data : []);
  }, [medicineId]);

  useEffect(() => {
    const loadPage = async () => {
      if (!medicineId) return;

      setLoading(true);
      try {
        const medicinesRes = await fetch("/api/medicines", { cache: "no-store" });
        const medicinesData = await medicinesRes.json();
        const rows = Array.isArray(medicinesData) ? (medicinesData as Medicine[]) : [];
        setMedicine(rows.find((item) => item._id === medicineId) ?? null);
        await loadStoreBatches();
      } catch {
        setMedicine(null);
        setStoreBatches([]);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [medicineId, loadStoreBatches]);

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

  const openEditBatch = (batch: StockBatch) => {
    setEditBatch(batch);
    setEditForm({
      batchNo: batch.batchNo,
      expiryDate: format(new Date(batch.expiryDate), "yyyy-MM-dd"),
      mrp: String(batch.mrp ?? ""),
      sellingPrice: String(batch.sellingPrice ?? ""),
      currentStock: String(batch.currentStock ?? ""),
      location: batch.location ?? "",
      supplier: batch.supplier ?? "",
      reason: "Batch edit",
    });
    setEditOpen(true);
  };

  const transferStock = async () => {
    if (!transferSourceId || parseInt(transferQty, 10) <= 0) {
      toast.error("Choose a store batch and quantity");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceStockId: transferSourceId,
          quantity: parseInt(transferQty, 10),
          reason: transferReason,
          referenceNumber: transferReference,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");

      toast.success("Transferred to pharmacy stock");
      setTransferOpen(false);
      setTransferSourceId("");
      setTransferQty("1");
      setTransferReason("");
      setTransferReference("");
      await Promise.all([loadBatches(), loadTransactions(), loadStoreBatches()]);
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
      setTxType("out");
      await Promise.all([loadBatches(), loadTransactions(), loadStoreBatches()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const saveBatch = async () => {
    if (!editBatch) return;
    if (!editForm.batchNo || !editForm.expiryDate || !editForm.mrp || !editForm.sellingPrice) {
      toast.error("Fill all required fields");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/stock/batch/${editBatch._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNo: editForm.batchNo,
          expiryDate: editForm.expiryDate,
          mrp: Number(editForm.mrp),
          sellingPrice: Number(editForm.sellingPrice),
          currentStock: editForm.currentStock !== "" ? parseInt(editForm.currentStock, 10) : undefined,
          location: editForm.location,
          supplier: editForm.supplier,
          reason: editForm.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");

      toast.success("Batch updated");
      setEditOpen(false);
      setEditBatch(null);
      await Promise.all([loadBatches(), loadTransactions(), loadStoreBatches()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteBatch = async (batch: StockBatch) => {
    if (!isAdminView) return;
    const confirmed = window.confirm(`Delete batch ${batch.batchNo}? This cannot be undone.`);
    if (!confirmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/stock/batch/${batch._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success("Batch deleted");
      await Promise.all([loadBatches(), loadTransactions(), loadStoreBatches()]);
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
  const availableStoreStock = storeBatches.reduce((sum, batch) => sum + batch.currentStock, 0);
  const selectedStoreBatch = storeBatches.find((batch) => batch._id === transferSourceId);

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
              Back to pharmacy stock
            </Link>
            <div>
              <h1 className="text-3xl font-semibold text-slate-800">{medicine?.name ?? "Pharmacy Batches"}</h1>
              <p className="text-sm text-slate-500">
                {medicine?.genericName || medicine?.manufacturer || "Transfer stock from store and manage pharmacy-side issues for this medicine."}
              </p>
              <p className="text-xs text-slate-500">
                Min Qty: {medicine?.minQuantity ?? 10} | Max Qty: {medicine?.maxQuantity ?? "-"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdminView ? (
              <Button asChild variant="outline">
                <Link href={`${pharmacyBase}/store-stock/${medicineId}`}>View Store Stock</Link>
              </Button>
            ) : null}
            <Button onClick={() => setTransferOpen(true)} className="bg-teal-600 text-white hover:bg-teal-700">
              <Plus className="mr-2 h-4 w-4" />
              Transfer From Store
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
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-slate-600">Available In Store</p>
            <p className="text-3xl font-semibold text-slate-800">{availableStoreStock}</p>
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
                  <TableHead>Source</TableHead>
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
                      <TableCell>{batch.location || "Pharmacy"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTxOpen(batch);
                              setTxQty("1");
                              setTxReason("");
                              setTxReference("");
                              setTxType("in");
                            }}
                          >
                            Stock In
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTxOpen(batch);
                              setTxQty("1");
                              setTxReason("");
                              setTxReference("");
                              setTxType("out");
                            }}
                          >
                            Stock Out
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              openEditBatch(batch);
                            }}
                          >
                            Edit Batch
                          </Button>
                          {isAdminView ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteBatch(batch)}
                            >
                              Delete
                            </Button>
                          ) : null}
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

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer From Store</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Medicine</Label>
              <Input value={medicine?.name ?? ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Store Batch *</Label>
              <Select value={transferSourceId} onValueChange={setTransferSourceId}>
                <SelectTrigger><SelectValue placeholder="Select store batch" /></SelectTrigger>
                <SelectContent>
                  {storeBatches
                    .filter((batch) => batch.currentStock > 0)
                    .map((batch) => (
                      <SelectItem key={batch._id} value={batch._id}>
                        {batch.batchNo} · {format(new Date(batch.expiryDate), "dd MMM yyyy")} · {batch.currentStock} units
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Available In Selected Batch</Label>
              <Input value={selectedStoreBatch ? String(selectedStoreBatch.currentStock) : ""} disabled />
            </div>
            <div className="grid gap-2">
              <Label>Transfer Quantity *</Label>
              <Input type="number" min="1" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Transfer to pharmacy counter" />
            </div>
            <div className="grid gap-2">
              <Label>Reference Number</Label>
              <Input value={transferReference} onChange={(e) => setTransferReference(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={transferStock} disabled={saving}>{saving ? "Saving..." : "Transfer"}</Button>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Batch</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Batch No *</Label>
              <Input value={editForm.batchNo} onChange={(e) => setEditForm((form) => ({ ...form, batchNo: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Expiry Date *</Label>
              <Input type="date" value={editForm.expiryDate} onChange={(e) => setEditForm((form) => ({ ...form, expiryDate: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>MRP *</Label>
              <Input type="number" min="0" value={editForm.mrp} onChange={(e) => setEditForm((form) => ({ ...form, mrp: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Selling Price *</Label>
              <Input type="number" min="0" value={editForm.sellingPrice} onChange={(e) => setEditForm((form) => ({ ...form, sellingPrice: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Current Stock</Label>
              <Input type="number" min="0" value={editForm.currentStock} onChange={(e) => setEditForm((form) => ({ ...form, currentStock: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input value={editForm.location} onChange={(e) => setEditForm((form) => ({ ...form, location: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <Input value={editForm.supplier} onChange={(e) => setEditForm((form) => ({ ...form, supplier: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Reason (optional)</Label>
              <Input value={editForm.reason} onChange={(e) => setEditForm((form) => ({ ...form, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveBatch} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
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
