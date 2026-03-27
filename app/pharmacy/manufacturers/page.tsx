"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Manufacturer = {
  _id: string;
  name: string;
  isActive: boolean;
};

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch("/api/manufacturers?includeInactive=true", { cache: "no-store" });
    const data = await res.json();
    setManufacturers(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load().catch(() => setManufacturers([])).finally(() => setLoading(false));
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setOpen(true);
  };

  const openEdit = (manufacturer: Manufacturer) => {
    setEditing(manufacturer);
    setFormName(manufacturer.name);
    setOpen(true);
  };

  const save = async () => {
    if (!formName.trim()) {
      toast.error("Name required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/manufacturers/${editing._id}` : "/api/manufacturers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(editing ? "Manufacturer updated" : "Manufacturer added");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (manufacturer: Manufacturer) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/manufacturers/${manufacturer._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !manufacturer.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(manufacturer.isActive ? "Manufacturer deactivated" : "Manufacturer activated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Manufacturers</h1>
          <p className="text-sm text-slate-500">Manage manufacturer options used in the medicine form.</p>
        </div>
        <Button onClick={openAdd}>Add Manufacturer</Button>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {manufacturers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">No manufacturers found.</TableCell>
              </TableRow>
            ) : (
              manufacturers.map((manufacturer) => (
                <TableRow key={manufacturer._id}>
                  <TableCell>{manufacturer.name}</TableCell>
                  <TableCell>
                    <Badge variant={manufacturer.isActive ? "default" : "secondary"}>
                      {manufacturer.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(manufacturer)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(manufacturer)} disabled={saving}>
                      {manufacturer.isActive ? "Deactivate" : "Activate"}
                    </Button>
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
            <DialogTitle>{editing ? "Edit Manufacturer" : "Add Manufacturer"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Cipla" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
