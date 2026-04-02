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

type BillingStaff = {
  _id: string;
  name: string;
  code?: string;
  label: string;
  isActive: boolean;
  sortOrder?: number;
};

export default function BillingStaffPage() {
  const [rows, setRows] = useState<BillingStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillingStaff | null>(null);
  const [form, setForm] = useState({ name: "", code: "", sortOrder: "0" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/billing-staff")
      .then((res) => res.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    load();
    setLoading(false);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", code: "", sortOrder: String(rows.length) });
    setOpen(true);
  };

  const openEdit = (row: BillingStaff) => {
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code ?? "",
      sortOrder: String(row.sortOrder ?? 0),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Staff name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/billing-staff/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            code: form.code.trim() || null,
            sortOrder: parseInt(form.sortOrder, 10) || 0,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to update");
        toast.success("Billing staff updated");
      } else {
        const res = await fetch("/api/billing-staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            code: form.code.trim() || undefined,
            sortOrder: parseInt(form.sortOrder, 10) || 0,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to add");
        toast.success("Billing staff added");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: BillingStaff) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/billing-staff/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(row.isActive ? "Deactivated" : "Activated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: BillingStaff) => {
    if (!window.confirm(`Deactivate "${row.label}"? It will no longer appear when billing.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/billing-staff/${row._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success("Billing staff deactivated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the staff names available in procedure, medicine, lab, and OP bill generation.
          </p>
        </div>
        <Button onClick={openAdd}>Add staff</Button>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No billing staff yet. Add staff names here to make them selectable during billing.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row._id}>
                  <TableCell className="tabular-nums">{row.sortOrder ?? 0}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.code ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "default" : "secondary"}>
                      {row.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)} disabled={saving}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleActive(row)}
                        disabled={saving}
                      >
                        {row.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      {row.isActive ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void remove(row)}
                          disabled={saving}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit billing staff" : "Add billing staff"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Staff name *</Label>
              <Input
                id="staff-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Mary Dayana Banu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-code">Code / suffix (optional)</Label>
              <Input
                id="staff-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. 02"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-order">Sort order</Label>
              <Input
                id="staff-order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
