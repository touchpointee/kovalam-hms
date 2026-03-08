"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Patient = {
  _id: string;
  regNo: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  createdAt?: string;
};

type Visit = { visitDate: string };

export default function DoctorPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastVisits, setLastVisits] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/patients?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setPatients(data.patients ?? []);
        setTotalPages(data.totalPages ?? 1);
        const ids = (data.patients ?? []).map((p: Patient) => p._id).join(",");
        if (ids) {
          Promise.all(
            (data.patients ?? []).map((p: Patient) =>
              fetch(`/api/visits?patientId=${p._id}`).then((r) => r.json())
            )
          ).then((visitLists) => {
            const map: Record<string, string> = {};
            visitLists.forEach((list: Visit[] | { visits?: Visit[] }, i: number) => {
              const arr = Array.isArray(list) ? list : list.visits ?? [];
              const latest = arr[0];
              if (latest && data.patients[i]) map[data.patients[i]._id] = format(new Date(latest.visitDate), "dd MMM yyyy");
            });
            setLastVisits(map);
          });
        }
      })
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [search, page]);

  if (loading && patients.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Patients</h1>
      <Input
        placeholder="Search by name, reg no, or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setPage(1)}
        className="max-w-sm"
      />
      {patients.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No patients found.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reg No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Last Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((p) => (
                <TableRow
                  key={p._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/doctor/patients/${p._id}/consultation`)}
                >
                  <TableCell>{p.regNo}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.age}</TableCell>
                  <TableCell>{p.gender}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell>{lastVisits[p._id] ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="py-1 text-sm">Page {page} of {totalPages}</span>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
