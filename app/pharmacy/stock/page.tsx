"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePharmacyBase } from "@/hooks/usePharmacyBase";
import { differenceInDays } from "date-fns";
import toast from "react-hot-toast";
import { ChevronRight, Package, Pill, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

type Medicine = {
  _id: string;
  name: string;
  genericName?: string;
  category?: string;
  group?: string;
  manufacturer?: string;
  unit?: string;
  minQuantity?: number;
  maxQuantity?: number;
  isActive: boolean;
};

type StockBatch = {
  _id: string;
  currentStock: number;
  minQuantity?: number;
  expiryDate?: string;
};

type MedicineSummary = {
  medicine: Medicine;
  totalStock: number;
  totalMinStock: number;
  batchCount: number;
  status: "in" | "low" | "out" | "empty";
  expiryStatus: "expired" | "soon" | "ok" | "none";
};

type CategoryOption = { _id: string; name: string };
type GroupOption = { _id: string; name: string };
type ManufacturerOption = { _id: string; name: string };

export default function PharmacyStockPage() {
  const router = useRouter();
  const pharmacyBase = usePharmacyBase();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batchesByMedicine, setBatchesByMedicine] = useState<Record<string, StockBatch[]>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState({
    name: "",
    genericName: "",
    category: "",
    group: "",
    manufacturer: "",
    unit: "unit",
    minQuantity: "10",
    maxQuantity: "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Medicine | null>(null);

  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const medicinesRes = await fetch("/api/medicines", { cache: "no-store" });
      const medicinesData = await medicinesRes.json();
      const rows = Array.isArray(medicinesData) ? (medicinesData as Medicine[]) : [];
      setMedicines(rows);

      const stockRows = await Promise.all(
        rows.map(async (medicine) => {
          const params = new URLSearchParams({ medicineId: medicine._id });
          const res = await fetch(`/api/stock?${params}`, { cache: "no-store" });
          const data = await res.json();
          return [medicine._id, Array.isArray(data) ? (data as StockBatch[]) : []] as const;
        })
      );

      setBatchesByMedicine(Object.fromEntries(stockRows));
    } catch {
      setMedicines([]);
      setBatchesByMedicine({});
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(() => {
    fetch("/api/medicine-categories")
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  const loadManufacturers = useCallback(() => {
    fetch("/api/manufacturers")
      .then((res) => res.json())
      .then((data) => setManufacturers(Array.isArray(data) ? data : []))
      .catch(() => setManufacturers([]));
  }, []);

  const loadGroups = useCallback(() => {
    fetch("/api/medicine-groups")
      .then((res) => res.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    loadStock();
    loadCategories();
    loadGroups();
    loadManufacturers();
  }, [loadStock, loadCategories, loadGroups, loadManufacturers]);

  const summaries = useMemo<MedicineSummary[]>(() => {
    return medicines.map((medicine) => {
      const batches = batchesByMedicine[medicine._id] ?? [];
      const totalStock = batches.reduce((sum, batch) => sum + batch.currentStock, 0);
      const totalMinStock = batches.reduce((sum, batch) => sum + (batch.minQuantity ?? 10), 0);

      let status: MedicineSummary["status"] = "empty";
      if (batches.length > 0) {
        if (totalStock === 0) status = "out";
        else if (totalStock <= totalMinStock) status = "low";
        else status = "in";
      }

      const expiryDays = batches
        .map((batch) => batch.expiryDate)
        .filter(Boolean)
        .map((expiryDate) => differenceInDays(new Date(expiryDate as string), new Date()));

      let expiryStatus: MedicineSummary["expiryStatus"] = "none";
      if (expiryDays.length > 0) {
        if (expiryDays.some((days) => days < 0)) expiryStatus = "expired";
        else if (expiryDays.some((days) => days <= 30)) expiryStatus = "soon";
        else expiryStatus = "ok";
      }

      return {
        medicine,
        totalStock,
        totalMinStock,
        batchCount: batches.length,
        status,
        expiryStatus,
      };
    });
  }, [batchesByMedicine, medicines]);

  const filteredSummaries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return summaries;

    return summaries.filter(({ medicine }) =>
      [medicine.name, medicine.genericName, medicine.category, medicine.manufacturer, medicine.group]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, summaries]);

  const totalMedicines = summaries.length;
  const medicinesInStock = summaries.filter((item) => item.status === "in").length;
  const medicinesLowStock = summaries.filter((item) => item.status === "low").length;
  const medicinesOutOfStock = summaries.filter((item) => item.status === "out" || item.status === "empty").length;

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      genericName: "",
      category: categories[0]?.name ?? "",
      group: groups[0]?.name ?? "",
      manufacturer: manufacturers[0]?.name ?? "",
      unit: "unit",
      minQuantity: "10",
      maxQuantity: "",
    });
    setOpen(true);
  };

  const openEdit = (m: Medicine) => {
    setEditing(m);
    setForm({
      name: m.name,
      genericName: m.genericName ?? "",
      category: m.category ?? "",
      group: m.group ?? "",
      manufacturer: m.manufacturer ?? "",
      unit: m.unit ?? "",
      minQuantity: String(m.minQuantity ?? 10),
      maxQuantity: m.maxQuantity ? String(m.maxQuantity) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/medicines/${editing._id}` : "/api/medicines";
      const method = editing ? "PUT" : "POST";
      const body = editing ? { ...form, isActive: editing.isActive } : form;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(editing ? "Updated" : "Medicine added");
      setOpen(false);
      await loadStock();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (m: Medicine) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/medicines/${m._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deactivated");
      setConfirmDeactivate(null);
      await loadStock();
    } catch {
      toast.error("Failed to deactivate");
    } finally {
      setSaving(false);
    }
  };

  const renderStatus = (status: MedicineSummary["status"]) => {
    if (status === "out") return <Badge className="bg-red-100 text-red-700">Out of Stock</Badge>;
    if (status === "low") return <Badge className="bg-amber-100 text-amber-700">Low Stock</Badge>;
    if (status === "in") return <Badge className="bg-emerald-100 text-emerald-700">In Stock</Badge>;
    return <Badge variant="secondary">No Batches</Badge>;
  };

  const renderExpiryStatus = (status: MedicineSummary["expiryStatus"]) => {
    if (status === "expired") return <Badge className="bg-red-100 text-red-700">Expired</Badge>;
    if (status === "soon") return <Badge className="bg-amber-100 text-amber-700">Expiring Soon</Badge>;
    if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-700">Valid</Badge>;
    return <Badge variant="secondary">No Expiry</Badge>;
  };

  const goBatches = (medicineId: string) => {
    router.push(`${pharmacyBase}/stock/${medicineId}`);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800">Medicine Stock</h1>
            <p className="text-sm text-slate-500">
              Add and edit medicines, then open a row to manage batches and stock transactions.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, generic, category, manufacturer, group..."
              className="pl-9"
            />
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`${pharmacyBase}/medicine-categories`}>Categories</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`${pharmacyBase}/medicine-groups`}>Groups</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`${pharmacyBase}/manufacturers`}>Manufacturers</Link>
          </Button>
          <Button size="sm" onClick={openAdd}>
            Add Medicine
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Total Medicines</p>
            <p className="text-3xl font-semibold text-slate-800">{totalMedicines}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">In Stock</p>
            <p className="text-3xl font-semibold text-slate-800">{medicinesInStock}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Low Stock</p>
            <p className="text-3xl font-semibold text-slate-800">{medicinesLowStock}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-slate-600">Out / No Batches</p>
            <p className="text-3xl font-semibold text-slate-800">{medicinesOutOfStock}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-100">
          {loading ? (
            <Skeleton className="h-64" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Batches</TableHead>
                  <TableHead>Total Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No medicines found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSummaries.map(({ medicine, batchCount, totalStock, status, expiryStatus }) => (
                    <TableRow
                      key={medicine._id}
                      className="cursor-pointer"
                      onClick={() => goBatches(medicine._id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4 text-rose-400" />
                          <div>
                            <p className="font-medium text-slate-800">{medicine.name}</p>
                            <p className="text-xs text-slate-500">{medicine.genericName || medicine.unit || "-"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{medicine.category ?? "-"}</TableCell>
                      <TableCell>{medicine.manufacturer || "-"}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <span>{batchCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>{totalStock}</TableCell>
                      <TableCell>{renderStatus(status)}</TableCell>
                      <TableCell>{renderExpiryStatus(expiryStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="gap-1 text-teal-700" onClick={() => goBatches(medicine._id)}>
                            Batches
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(medicine)}>
                            Edit
                          </Button>
                          {medicine.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setConfirmDeactivate(medicine)}
                            >
                              Deactivate
                            </Button>
                          )}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Medicine name"
              />
            </div>
            <div className="grid gap-2">
              <Label>Generic Name</Label>
              <Input
                value={form.genericName}
                onChange={(e) => setForm((f) => ({ ...f, genericName: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Medicine Group</Label>
              <Select value={form.group} onValueChange={(v) => setForm((f) => ({ ...f, group: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group._id} value={group.name}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Manufacturer</Label>
              <Select value={form.manufacturer} onValueChange={(v) => setForm((f) => ({ ...f, manufacturer: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer._id} value={manufacturer.name}>
                      {manufacturer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Unit</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="e.g. tablet, ml"
              />
            </div>
            <div className="grid gap-2">
              <Label>Min Quantity</Label>
              <Input
                type="number"
                min="0"
                value={form.minQuantity}
                onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Max Quantity</Label>
              <Input
                type="number"
                min="0"
                value={form.maxQuantity}
                onChange={(e) => setForm((f) => ({ ...f, maxQuantity: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeactivate} onOpenChange={() => setConfirmDeactivate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deactivate</DialogTitle>
          </DialogHeader>
          <p>Deactivate {confirmDeactivate?.name}? This will hide it from active lists.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeactivate && deactivate(confirmDeactivate)}
              disabled={saving}
            >
              {saving ? "..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
