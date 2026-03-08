"use client";

import { useEffect, useState } from "react";
import { format, differenceInDays } from "date-fns";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

type Medicine = { _id: string; name: string };
type StockBatch = {
  _id: string;
  batchNo: string;
  expiryDate: string;
  mrp: number;
  sellingPrice: number;
  quantityIn: number;
  quantityOut: number;
  currentStock: number;
  medicine?: Medicine;
};

export default function PharmacyStockPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedMedId, setSelectedMedId] = useState("");
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState<StockBatch | null>(null);
  const [addForm, setAddForm] = useState({
    batchNo: "",
    expiryDate: "",
    mrp: "",
    sellingPrice: "",
    quantityIn: "",
  });
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/medicines")
      .then((res) => res.json())
      .then((data) => setMedicines(Array.isArray(data) ? data : []))
      .catch(() => setMedicines([]));
  }, []);

  useEffect(() => {
    if (!selectedMedId) { setBatches([]); return; }
    setLoading(true);
    fetch(`/api/stock?medicineId=${selectedMedId}`)
      .then((res) => res.json())
      .then(setBatches)
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, [selectedMedId]);

  const getExpiryBadge = (expiryDate: string) => {
    const d = new Date(expiryDate);
    const days = differenceInDays(d, new Date());
    if (days < 0) return <Badge className="bg-red-600">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500">{"<"}30d</Badge>;
    if (days <= 90) return <Badge className="bg-yellow-500 text-black">30-90d</Badge>;
    return <Badge className="bg-green-600">{">"}90d</Badge>;
  };

  const addBatch = async () => {
    if (!selectedMedId || !addForm.batchNo || !addForm.expiryDate || !addForm.mrp || !addForm.sellingPrice || !addForm.quantityIn) {
      toast.error("Fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineId: selectedMedId,
          batchNo: addForm.batchNo,
          expiryDate: addForm.expiryDate,
          mrp: Number(addForm.mrp),
          sellingPrice: Number(addForm.sellingPrice),
          quantityIn: parseInt(addForm.quantityIn, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success("Batch added");
      setAddOpen(false);
      setAddForm({ batchNo: "", expiryDate: "", mrp: "", sellingPrice: "", quantityIn: "" });
      if (selectedMedId) fetch(`/api/stock?medicineId=${selectedMedId}`).then((r) => r.json()).then(setBatches);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const adjustStock = async () => {
    if (!adjustOpen || adjustQty === "" || parseInt(adjustQty, 10) === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/stock/${adjustOpen._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustQty: parseInt(adjustQty, 10), reason: adjustReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success("Stock updated");
      setAdjustOpen(null);
      setAdjustQty("");
      setAdjustReason("");
      if (selectedMedId) fetch(`/api/stock?medicineId=${selectedMedId}`).then((r) => r.json()).then(setBatches);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Stock</h1>
      <div className="flex flex-wrap gap-4">
        <div>
          <Label>Medicine</Label>
          <Select value={selectedMedId} onValueChange={setSelectedMedId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select medicine" /></SelectTrigger>
            <SelectContent>
              {medicines.map((m) => (
                <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedMedId && (
          <Button onClick={() => setAddOpen(true)}>Add Stock Batch</Button>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        selectedMedId && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch No</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>MRP</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead>Qty In</TableHead>
                <TableHead>Qty Out</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">No batches.</TableCell>
                </TableRow>
              ) : (
                batches.map((b) => (
                  <TableRow key={b._id}>
                    <TableCell>{b.batchNo}</TableCell>
                    <TableCell>{format(new Date(b.expiryDate), "dd MMM yyyy")}</TableCell>
                    <TableCell>{formatCurrency(b.mrp)}</TableCell>
                    <TableCell>{formatCurrency(b.sellingPrice)}</TableCell>
                    <TableCell>{b.quantityIn}</TableCell>
                    <TableCell>{b.quantityOut}</TableCell>
                    <TableCell>{b.currentStock}</TableCell>
                    <TableCell>{getExpiryBadge(b.expiryDate)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setAdjustOpen(b); setAdjustQty(""); setAdjustReason(""); }}>Adjust Stock</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Stock Batch</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Batch No *</Label><Input value={addForm.batchNo} onChange={(e) => setAddForm((f) => ({ ...f, batchNo: e.target.value }))} /></div>
            <div><Label>Expiry Date *</Label><Input type="date" value={addForm.expiryDate} onChange={(e) => setAddForm((f) => ({ ...f, expiryDate: e.target.value }))} /></div>
            <div><Label>MRP *</Label><Input type="number" value={addForm.mrp} onChange={(e) => setAddForm((f) => ({ ...f, mrp: e.target.value }))} /></div>
            <div><Label>Selling Price *</Label><Input type="number" value={addForm.sellingPrice} onChange={(e) => setAddForm((f) => ({ ...f, sellingPrice: e.target.value }))} /></div>
            <div><Label>Quantity In *</Label><Input type="number" value={addForm.quantityIn} onChange={(e) => setAddForm((f) => ({ ...f, quantityIn: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addBatch} disabled={saving}>{saving ? "Saving..." : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustOpen} onOpenChange={() => setAdjustOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
          {adjustOpen && (
            <p className="text-sm">Batch: {adjustOpen.batchNo}. Current stock: {adjustOpen.currentStock}.</p>
          )}
          <div className="grid gap-4">
            <div>
              <Label>Quantity (positive = add, negative = remove)</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. -5"
              />
            </div>
            <div><Label>Reason (optional)</Label><Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(null)}>Cancel</Button>
            <Button onClick={adjustStock} disabled={saving || !adjustQty}>{saving ? "..." : "Update"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
