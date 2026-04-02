"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile";

type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  paid?: boolean;
  status?: "waiting" | "served";
  opCharge?: number;
};

type PatientDetail = {
  _id: string;
  regNo: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address?: string;
  bloodGroup?: string;
  visits?: Visit[];
};

function toDatetimeLocalValue(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPatient, setSavingPatient] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);

  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("Unknown");

  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [vDate, setVDate] = useState("");
  const [vReceipt, setVReceipt] = useState("");
  const [vOpCharge, setVOpCharge] = useState("");
  const [vPaid, setVPaid] = useState(false);
  const [vStatus, setVStatus] = useState<"waiting" | "served">("waiting");
  const [savingVisit, setSavingVisit] = useState(false);
  const [deletingVisitId, setDeletingVisitId] = useState<string | null>(null);
  const visitDateInputRef = useRef<HTMLInputElement>(null);
  const visitSaveInFlightRef = useRef(false);

  const openVisitDatetimePicker = useCallback(() => {
    const el = visitDateInputRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.focus();
    }
  }, []);

  const setVisitDatetimeToNow = useCallback(() => {
    setVDate(toDatetimeLocalValue(new Date()));
  }, []);

  const loadPatient = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to load");
      setPatient(data);
      setName(data.name ?? "");
      setRegNo(data.regNo ?? "");
      setAge(String(data.age ?? ""));
      setGender(data.gender ?? "male");
      setPhone(data.phone ?? "");
      setAddress(data.address ?? "");
      setBloodGroup(data.bloodGroup ?? "Unknown");
    } catch {
      setPatient(null);
      toast.error("Could not load patient");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  const visits = useMemo(() => patient?.visits ?? [], [patient]);

  const savePatient = async () => {
    if (!id) return;
    const normalizedPhone = normalizeMobileNumber(phone);
    if (!isValidMobileNumber(normalizedPhone)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setSavingPatient(true);
    try {
      const res = await fetch(`/api/patients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          regNo: regNo.trim(),
          age: parseInt(age, 10),
          gender,
          phone: normalizedPhone,
          address: address.trim() || undefined,
          bloodGroup,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Save failed");
      setPatient((p) => (p ? { ...p, ...data } : data));
      toast.success("Patient updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingPatient(false);
    }
  };

  const deletePatient = async () => {
    if (!id || !patient?._id) return;
    if (
      !window.confirm(
        "Delete this patient permanently? All visits, prescriptions, procedure bills, medicine bills, and lab bills for this patient will be removed. Medicine stock from patient bills will be restored. This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingPatient(true);
    try {
      const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message ?? "Failed to delete patient");
      toast.success("Patient deleted");
      router.push("/admin/patients");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete patient");
    } finally {
      setDeletingPatient(false);
    }
  };

  const openVisitEdit = (v: Visit) => {
    setEditingVisit(v);
    setVDate(toDatetimeLocalValue(v.visitDate));
    setVReceipt(v.receiptNo ?? "");
    setVOpCharge(String(v.opCharge ?? 0));
    setVPaid(!!v.paid);
    setVStatus((v.status ?? "waiting") as "waiting" | "served");
    setVisitDialogOpen(true);
  };

  const deleteVisit = async (visitId: string) => {
    if (
      !window.confirm(
        "Delete this visit? Prescriptions, procedure bills, medicine bills, and lab bills linked to this visit will be removed. This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingVisitId(visitId);
    try {
      const res = await fetch(`/api/visits/${visitId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message ?? "Failed to delete visit");
      if (editingVisit?._id === visitId) {
        setVisitDialogOpen(false);
        setEditingVisit(null);
      }
      toast.success("Visit deleted");
      await loadPatient();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete visit");
    } finally {
      setDeletingVisitId(null);
    }
  };

  const saveVisit = async () => {
    if (!editingVisit?._id || visitSaveInFlightRef.current) return;
    visitSaveInFlightRef.current = true;
    setSavingVisit(true);
    try {
      const res = await fetch(`/api/visits/${editingVisit._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitDate: new Date(vDate).toISOString(),
          receiptNo: vReceipt.trim(),
          opCharge: Number(vOpCharge) || 0,
          paid: vPaid,
          status: vStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Save failed");
      setVisitDialogOpen(false);
      setEditingVisit(null);
      toast.success("Visit updated");
      void loadPatient();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      visitSaveInFlightRef.current = false;
      setSavingVisit(false);
    }
  };

  if (loading && !patient) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient?._id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Patient</h1>
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Button asChild variant="outline">
          <Link href="/admin/patients">Back to Patients</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patient record</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin — edit demographics and any visit at any time
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/patients">Back</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={savingPatient || deletingPatient}
            onClick={() => void deletePatient()}
          >
            <Trash2 className="mr-1 h-4 w-4" aria-hidden />
            {deletingPatient ? "Deleting…" : "Delete patient"}
          </Button>
          <Button onClick={savePatient} disabled={savingPatient}>
            {savingPatient ? "Saving…" : "Save patient"}
          </Button>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Demographics</CardTitle>
          <CardDescription>All fields can be updated; registration number must stay unique.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regNo">Reg. no.</Label>
            <Input id="regNo" value={regNo} onChange={(e) => setRegNo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min={0}
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(normalizeMobileNumber(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Blood group</Label>
            <Select value={bloodGroup} onValueChange={setBloodGroup}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((bg) => (
                  <SelectItem key={bg} value={bg}>
                    {bg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Visits</CardTitle>
          <CardDescription>Edit date, receipt, OP charge, payment, and status for any visit.</CardDescription>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No visits yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>OP charge</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => (
                  <TableRow key={v._id}>
                    <TableCell>{format(new Date(v.visitDate), "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell>{v.receiptNo ?? "-"}</TableCell>
                    <TableCell>{formatCurrency(v.opCharge ?? 0)}</TableCell>
                    <TableCell>{v.paid ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {v.status ?? "waiting"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openVisitEdit(v)}>
                          Edit
                        </Button>
                        <Button asChild size="sm" variant="secondary">
                          <Link
                            href={`/admin/patients/${patient._id}/consultation?visitId=${v._id}`}
                          >
                            Consultation
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          disabled={deletingVisitId === v._id}
                          onClick={() => void deleteVisit(v._id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                          {deletingVisitId === v._id ? "Deleting…" : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={visitDialogOpen}
        onOpenChange={(open) => {
          if (!open && savingVisit) return;
          setVisitDialogOpen(open);
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => savingVisit && e.preventDefault()}
          onEscapeKeyDown={(e) => savingVisit && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Edit visit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="vDate">Visit date & time</Label>
                <Button type="button" variant="outline" size="sm" onClick={setVisitDatetimeToNow}>
                  Now
                </Button>
              </div>
              <Input
                ref={visitDateInputRef}
                id="vDate"
                type="datetime-local"
                value={vDate}
                onChange={(e) => setVDate(e.target.value)}
                onClick={openVisitDatetimePicker}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Use <span className="font-medium">Now</span> to set the current date and current time together.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vReceipt">Receipt no.</Label>
              <Input id="vReceipt" value={vReceipt} onChange={(e) => setVReceipt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vOp">OP charge</Label>
              <Input
                id="vOp"
                type="number"
                min={0}
                step="0.01"
                value={vOpCharge}
                onChange={(e) => setVOpCharge(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={vStatus} onValueChange={(val) => setVStatus(val as "waiting" | "served")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="served">Served</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vPaid"
                checked={vPaid}
                onChange={(e) => setVPaid(e.target.checked)}
              />
              <Label htmlFor="vPaid">Mark OP as paid</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={savingVisit}
              onClick={() => setVisitDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveVisit()} disabled={savingVisit}>
              {savingVisit ? "Saving…" : "Save visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
