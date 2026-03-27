"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePharmacyBase } from "@/hooks/usePharmacyBase";

type Medicine = {
  _id: string;
  name: string;
  genericName?: string;
  category?: string;
  manufacturer?: string;
  unit?: string;
  minQuantity?: number;
  maxQuantity?: number;
  isActive: boolean;
};

type CategoryOption = {
  _id: string;
  name: string;
};

type ManufacturerOption = {
  _id: string;
  name: string;
};

export default function PharmacyMedicinesPage() {
  const pharmacyBase = usePharmacyBase();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | null>(null);
  const [form, setForm] = useState({
    name: "",
    genericName: "",
    category: "",
    manufacturer: "",
    unit: "unit",
    minQuantity: "10",
    maxQuantity: "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Medicine | null>(null);

  const load = useCallback(() => {
    const q = search.trim() ? `?search=${encodeURIComponent(search)}` : "";
    fetch(`/api/medicines${q}`)
      .then((res) => res.json())
      .then((data) => setMedicines(Array.isArray(data) ? data : []))
      .catch(() => setMedicines([]));
  }, [search]);

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

  useEffect(() => {
    load();
    loadCategories();
    loadManufacturers();
    setLoading(false);
  }, [load, loadCategories, loadManufacturers]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      genericName: "",
      category: categories[0]?.name ?? "",
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
      manufacturer: m.manufacturer ?? "",
      unit: m.unit ?? "",
      minQuantity: String(m.minQuantity ?? 10),
      maxQuantity: m.maxQuantity ? String(m.maxQuantity) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
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
      load();
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
      load();
    } catch {
      toast.error("Failed to deactivate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Medicines</h1>
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name or generic name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button asChild variant="outline">
          <Link href={`${pharmacyBase}/medicine-categories`}>Manage Categories</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`${pharmacyBase}/manufacturers`}>Manage Manufacturers</Link>
        </Button>
        <Button onClick={openAdd}>Add Medicine</Button>
      </div>
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Generic</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Min Qty</TableHead>
              <TableHead>Max Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {medicines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No medicines found.
                </TableCell>
              </TableRow>
            ) : (
              medicines.map((m) => (
                <TableRow key={m._id} className={!m.isActive ? "opacity-60" : ""}>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.genericName ?? "-"}</TableCell>
                  <TableCell>{m.category ?? "-"}</TableCell>
                  <TableCell>{m.manufacturer ?? "-"}</TableCell>
                  <TableCell>{m.unit ?? "-"}</TableCell>
                  <TableCell>{m.minQuantity ?? 10}</TableCell>
                  <TableCell>{m.maxQuantity ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={m.isActive ? "default" : "secondary"}>{m.isActive ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>Edit</Button>
                    {m.isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setConfirmDeactivate(m)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
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
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Manufacturer</Label>
              <Select value={form.manufacturer} onValueChange={(v) => setForm((f) => ({ ...f, manufacturer: v }))}>
                <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                <SelectContent>
                  {manufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer._id} value={manufacturer.name}>{manufacturer.name}</SelectItem>
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
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
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
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeactivate && deactivate(confirmDeactivate)} disabled={saving}>
              {saving ? "..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
