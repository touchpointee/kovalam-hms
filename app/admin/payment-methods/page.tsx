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

type PaymentMethod = {
  _id: string;
  name: string;
  code?: string;
  isActive: boolean;
  sortOrder?: number;
};

export default function PaymentMethodsPage() {
  const [rows, setRows] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [form, setForm] = useState({ name: "", code: "", sortOrder: "0" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/payment-methods")
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

  const openEdit = (m: PaymentMethod) => {
    setEditing(m);
    setForm({
      name: m.name,
      code: m.code ?? "",
      sortOrder: String(m.sortOrder ?? 0),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/payment-methods/${editing._id}`, {
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
        toast.success("Payment method updated");
      } else {
        const res = await fetch("/api/payment-methods", {
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
        toast.success("Payment method added");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: PaymentMethod) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/payment-methods/${m._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(m.isActive ? "Deactivated" : "Activated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: PaymentMethod) => {
    if (!window.confirm(`Deactivate “${m.name}”? It will no longer appear when billing.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/payment-methods/${m._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success("Payment method deactivated");
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
          <h1 className="text-2xl font-semibold tracking-tight">Payment methods</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Used on OP registration, procedure, medicine, and lab bills. Inactive methods are hidden when billing.
          </p>
        </div>
        <Button onClick={openAdd}>Add method</Button>
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
                  No payment methods yet. Add Cash, Card, UPI, etc.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((m) => (
                <TableRow key={m._id}>
                  <TableCell className="tabular-nums">{m.sortOrder ?? 0}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.code ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={m.isActive ? "default" : "secondary"}>
                      {m.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(m)} disabled={saving}>
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleActive(m)}
                        disabled={saving}
                      >
                        {m.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      {m.isActive ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void remove(m)}
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
            <DialogTitle>{editing ? "Edit payment method" : "Add payment method"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Name *</Label>
              <Input
                id="pm-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Cash, UPI, Card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-code">Code (optional)</Label>
              <Input
                id="pm-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. CASH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-order">Sort order</Label>
              <Input
                id="pm-order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
