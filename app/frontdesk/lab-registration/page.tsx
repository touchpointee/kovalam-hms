"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { isValidMobileNumber, normalizeMobileNumber } from "@/lib/mobile";
import { formatCurrency } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  age: z.coerce.number().min(0, "Age required"),
  gender: z.enum(["male", "female", "other"]),
  phone: z
    .string()
    .min(1, "Phone required")
    .transform((value) => normalizeMobileNumber(value))
    .refine((value) => isValidMobileNumber(value), "Enter a valid 10-digit mobile number"),
  address: z.string().optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"]).optional(),
});

type FormData = z.infer<typeof schema>;

type Patient = {
  _id: string;
  regNo: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  address?: string;
  bloodGroup?: string;
  createdAt: string;
};

export default function FrontdeskLabRegistrationPage() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [labOnlyBillsByPatient, setLabOnlyBillsByPatient] = useState<
    Record<string, { _id: string; grandTotal?: number } | null>
  >({});
  const [labOnlyBillsLoading, setLabOnlyBillsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(false);
  const limit = 9;
  const [loading, setLoading] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "male", bloodGroup: "Unknown" },
  });
  const phoneField = register("phone");
  const gender = watch("gender");
  const bloodGroup = watch("bloodGroup");

  const fetchPatients = async (targetPage: number, query: string) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(limit),
        search: query,
        registrationType: "lab",
      });
      const res = await fetch(`/api/patients?${params.toString()}`);
      const data = await res.json();
      const list: Patient[] = Array.isArray(data?.patients) ? data.patients : [];
      setPatients(list);
      setTotal(typeof data?.total === "number" ? data.total : 0);
      setPage(typeof data?.page === "number" ? data.page : 1);
      setTotalPages(Math.max(1, typeof data?.totalPages === "number" ? data.totalPages : 1));
      if (list.length === 0) {
        setLabOnlyBillsByPatient({});
        return;
      }
      setLabOnlyBillsLoading(true);
      try {
        const results = await Promise.all(
          list.map((p) =>
            fetch(`/api/laboratory/bills?patientId=${p._id}&labOnly=true&limit=1&page=1`, { cache: "no-store" })
              .then((r) => r.json())
              .catch(() => null)
          )
        );
        const nextMap: Record<string, { _id: string; grandTotal?: number } | null> = {};
        results.forEach((res, idx) => {
          const bill = Array.isArray(res?.items) ? res.items[0] : null;
          nextMap[list[idx]._id] = bill?._id ? { _id: bill._id, grandTotal: bill.grandTotal } : null;
        });
        setLabOnlyBillsByPatient(nextMap);
      } finally {
        setLabOnlyBillsLoading(false);
      }
    } catch {
      setPatients([]);
      setTotal(0);
      setTotalPages(1);
      setLabOnlyBillsByPatient({});
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchPatients(1, "");
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, registrationType: "lab" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to register");
      toast.success(`Lab registration created. Reg No: ${json.regNo}`);
      reset();
      setShowAddPatient(false);
      fetchPatients(1, search);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="op-page">
      <div>
        <h1 className="op-title">Lab Registration</h1>
        <p className="op-subtitle">Register lab-only patients and open lab billing</p>
      </div>

      <Card className="rounded-2xl border-blue-100">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by name, reg no, or phone..."
                value={search}
                className="w-72"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    fetchPatients(1, search);
                  }
                }}
              />
              <Button onClick={() => fetchPatients(1, search)}>Search</Button>
            </div>
            <Button variant="outline" onClick={() => setShowAddPatient((prev) => !prev)}>
              {showAddPatient ? "Close Add Patient" : "Add Lab Registration"}
            </Button>
          </div>

          {showAddPatient && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">Register Lab-only Patient</p>
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="op-field-label">Name *</Label>
                  <Input {...register("name")} className={errors.name ? "border-destructive" : ""} />
                </div>
                <div>
                  <Label className="op-field-label">Age *</Label>
                  <Input type="number" {...register("age")} className={errors.age ? "border-destructive" : ""} />
                </div>
                <div>
                  <Label className="op-field-label">Gender *</Label>
                  <Select value={gender} onValueChange={(v) => setValue("gender", v as FormData["gender"])} >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="op-field-label">Phone *</Label>
                  <Input
                    {...phoneField}
                    inputMode="numeric"
                    maxLength={10}
                    className={errors.phone ? "border-destructive" : ""}
                    onChange={(e) => {
                      e.target.value = normalizeMobileNumber(e.target.value);
                      phoneField.onChange(e);
                    }}
                  />
                  {errors.phone ? <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p> : null}
                </div>
                <div className="sm:col-span-2">
                  <Label className="op-field-label">Address</Label>
                  <Textarea rows={2} {...register("address")} />
                </div>
                <div>
                  <Label className="op-field-label">Blood Group</Label>
                  <Select value={bloodGroup ?? "Unknown"} onValueChange={(v) => setValue("bloodGroup", v as FormData["bloodGroup"])} >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Saving..." : "Save Registration"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {patients.length} of {total} lab registrations
            </p>
            <Badge variant="secondary">Page {page} / {Math.max(1, totalPages)}</Badge>
          </div>

          {loadingList ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading lab registrations...</p>
          ) : patients.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No lab registrations found.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {patients.map((p) => (
                <Card key={p._id} className="border-blue-100">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.regNo}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{p.gender}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">Age: {p.age}</p>
                    <p className="text-sm text-slate-600">{p.phone}</p>
                    {(() => {
                      const bill = labOnlyBillsByPatient[p._id];
                      const hasBill = Boolean(bill?._id);
                      return (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Bill status</span>
                            {labOnlyBillsLoading ? (
                              <Badge variant="outline">Checking...</Badge>
                            ) : hasBill ? (
                              <Badge className="bg-red-600 text-white">Billed</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Registered</span>
                      <span className="text-slate-600">
                        {p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy, HH:mm") : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Total</span>
                      <span className="font-medium text-slate-900">
                        {labOnlyBillsLoading ? "-" : hasBill ? formatCurrency(Number(bill?.grandTotal) || 0) : "-"}
                      </span>
                    </div>
                        </>
                      );
                    })()}
                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild className="w-full" size="sm">
                        <Link href={`/frontdesk/lab-billing/lab-only/${p._id}`}>
                          {(() => {
                            const bill = labOnlyBillsByPatient[p._id];
                            return bill?._id ? "Open Lab Bill" : "Create Lab Bill";
                          })()}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="w-full" size="sm">
                        <Link href={`/frontdesk/lab-billing/lab-only/${p._id}?view=details`}>
                          Open Details
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              disabled={page <= 1 || loadingList}
              onClick={() => fetchPatients(page - 1, search)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages || loadingList}
              onClick={() => fetchPatients(page + 1, search)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
