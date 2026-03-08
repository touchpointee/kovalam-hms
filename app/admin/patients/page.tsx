"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
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
  createdAt: string;
};

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) params.set("search", search.trim());
    setLoading(true);
    fetch(`/api/patients?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setPatients(data.patients ?? []);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => setPatients([]))
      .finally(() => setLoading(false));
  }, [search, page]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Patients</h1>
      <Input
        placeholder="Search by name, phone, reg no..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {loading ? (
        <Skeleton className="h-64" />
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
                <TableHead>Registered</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">No patients found.</TableCell>
                </TableRow>
              ) : (
                patients.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>{p.regNo}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.age}</TableCell>
                    <TableCell>{p.gender}</TableCell>
                    <TableCell>{p.phone}</TableCell>
                    <TableCell>{format(new Date(p.createdAt), "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <Link href={`/doctor/patients/${p._id}/consultation`} className="text-primary text-sm hover:underline">View</Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="py-2 text-sm">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </>
      )}
    </div>
  );
}
