"use client";

import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";

type LabTest = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  isActive: boolean;
};

export default function AdminLabTestsPage() {
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabTest | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<LabTest | null>(null);

  const load = () => {
    fetch("/api/lab-tests?all=true")
      .then((res) => res.json())
      .then((data) => setLabTests(Array.isArray(data) ? data : []))
      .catch(() => setLabTests([]));
  };

  useEffect(() => {
    load();
    setLoading(false);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", description: "", price: "" });
    setOpen(true);
  };

  const openEdit = (p: LabTest) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price) });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.price) { toast.error("Name and price required"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/lab-tests/${editing._id}` : "/api/lab-tests";
      const method = editing ? "PUT" : "POST";
      const body = editing
        ? { name: form.name, description: form.description, price: Number(form.price), isActive: editing.isActive }
        : { name: form.name, description: form.description, price: Number(form.price) };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(editing ? "Updated" : "Lab test added");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (p: LabTest) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lab-tests/${p._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deactivated");
      setConfirmDeactivate(null);
      load();
    } catch {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (p: LabTest) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lab-tests/${p._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Reactivated");
      load();
    } catch {
      toast.error("Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Lab Tests</h1>
      <Button onClick={openAdd}>Add Lab Test</Button>
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {labTests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">No lab tests.</TableCell>
              </TableRow>
            ) : (
              labTests.map((p) => (
                <TableRow key={p._id} className={!p.isActive ? "opacity-60" : ""}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.description ?? "-"}</TableCell>
                  <TableCell>{formatCurrency(p.price)}</TableCell>
                  <TableCell>{p.isActive ? "Active" : "Inactive"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                    {p.isActive ? (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDeactivate(p)}>Deactivate</Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => reactivate(p)} disabled={saving}>Reactivate</Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Lab Test" : "Add Lab Test"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Price *</Label><Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeactivate} onOpenChange={() => setConfirmDeactivate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Deactivate</DialogTitle></DialogHeader>
          <p>Deactivate {confirmDeactivate?.name}?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDeactivate && deactivate(confirmDeactivate)} disabled={saving}>Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
