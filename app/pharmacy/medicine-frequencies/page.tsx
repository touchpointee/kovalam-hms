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

type Frequency = {
  _id: string;
  name: string;
  dosesPerDay?: number | null;
  isActive: boolean;
};

export default function MedicineFrequenciesPage() {
  const [frequencies, setFrequencies] = useState<Frequency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Frequency | null>(null);
  const [formName, setFormName] = useState("");
  const [formDosesPerDay, setFormDosesPerDay] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch("/api/medicine-frequencies?includeInactive=true", { cache: "no-store" });
    const data = await res.json();
    setFrequencies(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load().catch(() => setFrequencies([])).finally(() => setLoading(false));
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormDosesPerDay("");
    setOpen(true);
  };

  const openEdit = (frequency: Frequency) => {
    setEditing(frequency);
    setFormName(frequency.name);
    setFormDosesPerDay(
      frequency.dosesPerDay !== undefined && frequency.dosesPerDay !== null
        ? String(frequency.dosesPerDay)
        : ""
    );
    setOpen(true);
  };

  const save = async () => {
    if (!formName.trim()) {
      toast.error("Name required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/medicine-frequencies/${editing._id}` : "/api/medicine-frequencies", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          dosesPerDay: formDosesPerDay.trim() ? Number(formDosesPerDay) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(editing ? "Frequency updated" : "Frequency added");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (frequency: Frequency) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/medicine-frequencies/${frequency._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !frequency.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(frequency.isActive ? "Frequency deactivated" : "Frequency activated");
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
          <h1 className="text-2xl font-semibold">Medicine Frequencies</h1>
          <p className="text-sm text-slate-500">Manage frequency options used in the visit medicine form.</p>
        </div>
        <Button onClick={openAdd}>Add Frequency</Button>
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Doses/Day</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {frequencies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">No frequencies found.</TableCell>
              </TableRow>
            ) : (
              frequencies.map((frequency) => (
                <TableRow key={frequency._id}>
                  <TableCell>{frequency.name}</TableCell>
                  <TableCell>{frequency.dosesPerDay ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={frequency.isActive ? "default" : "secondary"}>
                      {frequency.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(frequency)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(frequency)} disabled={saving}>
                      {frequency.isActive ? "Deactivate" : "Activate"}
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
            <DialogTitle>{editing ? "Edit Frequency" : "Add Frequency"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. 1-0-1 / After food" />
          </div>
          <div className="grid gap-2">
            <Label>Doses Per Day</Label>
            <Input
              type="number"
              min="0.01"
              step="0.25"
              value={formDosesPerDay}
              onChange={(e) => setFormDosesPerDay(e.target.value)}
              placeholder="e.g. 2 for BD, 3 for TDS"
            />
            <p className="text-xs text-muted-foreground">
              Used to auto-calculate tablet quantity from frequency and duration.
            </p>
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
