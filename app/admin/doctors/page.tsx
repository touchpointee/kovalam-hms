"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DoctorUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorUser | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [editForm, setEditForm] = useState({ name: "", isActive: true, newPassword: "" });
  const [saving, setSaving] = useState(false);

  const fetchDoctors = (showSkeleton: boolean) => {
    if (showSkeleton) setLoading(true);
    fetch("/api/users")
      .then((res) => res.json())
      .then((data: DoctorUser[]) => {
        setDoctors(Array.isArray(data) ? data.filter((u) => u.role === "doctor") : []);
      })
      .catch(() => setDoctors([]))
      .finally(() => {
        if (showSkeleton) setLoading(false);
      });
  };

  useEffect(() => {
    fetchDoctors(true);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "" });
    setOpen(true);
  };

  const openEdit = (u: DoctorUser) => {
    setEditing(u);
    setEditForm({ name: u.name, isActive: u.isActive, newPassword: "" });
    setOpen(true);
  };

  const saveNew = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password || form.password.length < 6) {
      toast.error("Name, email and password (min 6) required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: "doctor",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success("Doctor added");
      setOpen(false);
      fetchDoctors(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body: { name?: string; isActive?: boolean; newPassword?: string } = {
        name: editForm.name,
        isActive: editForm.isActive,
      };
      if (editForm.newPassword && editForm.newPassword.length >= 6) body.newPassword = editForm.newPassword;
      const res = await fetch(`/api/users/${editing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success("Doctor updated");
      setOpen(false);
      fetchDoctors(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const save = () => (editing ? saveEdit() : saveNew());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Doctors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add and manage consulting doctors. They can log in with role doctor and appear in OP visit and bill printouts.
        </p>
      </div>
      <Button onClick={openAdd}>Add doctor</Button>
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No doctors yet. Add one to assign on OP visits.
                </TableCell>
              </TableRow>
            ) : (
              doctors.map((u) => (
                <TableRow key={u._id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge className={cn(u.isActive ? "bg-blue-500/15 text-blue-700" : "bg-muted")}>
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                      Edit
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
            <DialogTitle>{editing ? "Edit doctor" : "Add doctor"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="docActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <Label htmlFor="docActive">Active</Label>
              </div>
              <div>
                <Label>New password (leave blank to keep)</Label>
                <Input
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Min 6 characters"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Password * (min 6)</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
          )}
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
    </div>
  );
}
