"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
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
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = ["salary", "supplies", "utilities", "maintenance", "misc", "other"] as const;

type Expense = {
  _id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  addedBy?: { name: string };
};

export default function FrontdeskExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({ category: "misc" as string, description: "", amount: "", date: format(new Date(), "yyyy-MM-dd") });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (category && category !== "all") params.set("category", category);
    setLoading(true);
    fetch(`/api/expenses?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setExpenses(data.expenses ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => { setExpenses([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [from, to, category]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ category: "misc", description: "", amount: "", date: format(new Date(), "yyyy-MM-dd") });
    setOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
      date: format(new Date(expense.date), "yyyy-MM-dd"),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.description.trim() || !form.amount) {
      toast.error("Description and amount required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/expenses/${editing._id}` : "/api/expenses";
      const method = editing ? "PUT" : "POST";
      const body = { category: form.category, description: form.description, amount: Number(form.amount), date: form.date };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed");
      toast.success(editing ? "Updated" : "Expense added");
      setOpen(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (expense: Expense) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/expenses/${expense._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted");
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Expenses</h1>
      <div className="flex flex-wrap gap-4">
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={load}>Filter</Button>
      </div>
      <p className="font-medium">Total: {formatCurrency(total)}</p>
      <Button onClick={openAdd}>Add Expense</Button>
      {loading ? (
        <Skeleton className="h-64" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Added By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No expenses.</TableCell>
              </TableRow>
            ) : (
              expenses.map((expense) => (
                <TableRow key={expense._id}>
                  <TableCell>{format(new Date(expense.date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{expense.category}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>{formatCurrency(expense.amount)}</TableCell>
                  <TableCell>{(expense.addedBy as { name?: string })?.name ?? "-"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(expense)}>Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(expense)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} /></div>
            <div><Label>Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} /></div>
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p>Delete this expense? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteExpense(confirmDelete)} disabled={saving}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
