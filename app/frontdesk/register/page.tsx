"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const schema = z.object({
  name: z.string().min(1, "Name required"),
  age: z.coerce.number().min(0, "Age required"),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().min(1, "Phone required"),
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

export default function RegisterPage() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const searchPatients = useCallback(() => {
    if (!search.trim()) return;
    setSearching(true);
    fetch(`/api/patients?search=${encodeURIComponent(search)}&limit=10`)
      .then((res) => res.json())
      .then((data) => setSearchResults(data.patients ?? []))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }, [search]);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gender: "male", bloodGroup: "Unknown" },
  });
  const gender = watch("gender");
  const bloodGroup = watch("bloodGroup");

  useEffect(() => {
    fetch("/api/patients?limit=10")
      .then((res) => res.json())
      .then((data) => setRecent(data.patients ?? []))
      .catch(() => setRecent([]));
  }, []);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to register");
      toast.success(`Patient registered. Reg No: ${json.regNo}`);
      reset();
      setRecent((prev) => [{ ...json, createdAt: new Date().toISOString() }, ...prev]);
      setSelectedPatient(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Register Patient</h1>

      <Card>
        <CardHeader>
          <CardTitle>Search Patient</CardTitle>
          <CardDescription>Search by name, phone, or reg no</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPatients())}
          />
          <Button onClick={searchPatients} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </CardContent>
        {searchResults.length > 0 && (
          <CardContent className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Results</p>
            <ul className="space-y-1">
              {searchResults.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setSelectedPatient(p);
                      setSearchResults([]);
                      setSearch("");
                    }}
                  >
                    {p.name} — {p.regNo} — {p.phone}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {selectedPatient && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Selected Patient</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <p><strong>Name:</strong> {selectedPatient.name}</p>
            <p><strong>Reg No:</strong> {selectedPatient.regNo}</p>
            <p><strong>Age:</strong> {selectedPatient.age} | <strong>Gender:</strong> {selectedPatient.gender}</p>
            <p><strong>Phone:</strong> {selectedPatient.phone}</p>
            <Button asChild className="mt-2">
              <Link href={`/frontdesk/visit?patientId=${selectedPatient._id}`}>Create OP Visit</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Register New Patient</CardTitle>
          <CardDescription>Fill the form below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input {...register("name")} className={errors.name ? "border-destructive" : ""} />
              {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Age *</Label>
              <Input type="number" {...register("age")} className={errors.age ? "border-destructive" : ""} />
              {errors.age && <p className="text-destructive text-sm">{errors.age.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Gender *</Label>
              <Select value={gender} onValueChange={(v) => setValue("gender", v as FormData["gender"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input {...register("phone")} className={errors.phone ? "border-destructive" : ""} />
              {errors.phone && <p className="text-destructive text-sm">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select value={bloodGroup ?? "Unknown"} onValueChange={(v) => setValue("bloodGroup", v as FormData["bloodGroup"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"].map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Register Patient"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Registrations</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No registrations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>{p.regNo}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.age}</TableCell>
                    <TableCell>{p.gender}</TableCell>
                    <TableCell>{p.phone}</TableCell>
                    <TableCell>{format(new Date(p.createdAt), "dd MMM yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
