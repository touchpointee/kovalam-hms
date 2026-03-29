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

type Group = {
  _id: string;
  name: string;
  isActive: boolean;
};

export default function MedicineGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch("/api/medicine-groups?includeInactive=true", { cache: "no-store" });
    const data = await res.json();
    setGroups(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load().catch(() => setGroups([])).finally(() => setLoading(false));
  }, []);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setOpen(true);
  };

  const openEdit = (group: Group) => {
    setEditing(group);
    setFormName(group.name);
    setOpen(true);
  };

  const save = async () => {
    if (!formName.trim()) {
      toast.error("Name required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/medicine-groups/${editing._id}` : "/api/medicine-groups", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(editing ? "Group updated" : "Group added");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (group: Group) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/medicine-groups/${group._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !group.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(group.isActive ? "Group deactivated" : "Group activated");
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
          <h1 className="text-2xl font-semibold">Medicine Groups</h1>
          <p className="text-sm text-slate-500">Manage medicine group options used in the medicine form.</p>
        </div>
        <Button onClick={openAdd}>Add Group</Button>
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
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">No groups found.</TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow key={group._id}>
                  <TableCell>{group.name}</TableCell>
                  <TableCell>
                    <Badge variant={group.isActive ? "default" : "secondary"}>
                      {group.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(group)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(group)} disabled={saving}>
                      {group.isActive ? "Deactivate" : "Activate"}
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
            <DialogTitle>{editing ? "Edit Group" : "Add Group"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Antibiotics" />
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
