"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function AdminLabRegistrationsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20", registrationType: "lab" });
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lab Registrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lab-only registrations with LAB numbers (no OP visit required)
          </p>
        </div>
        <Badge variant="secondary" className="rounded-md px-2.5 py-1 text-xs">
          Admin
        </Badge>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">Directory</CardTitle>
            <CardDescription>Lab registrations (newest pages first)</CardDescription>
          </div>
          <FlaskConical className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name, phone, reg no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : patients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No lab registrations found.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {patients.map((p) => (
                <Card key={p._id} className="border shadow-sm transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg leading-snug">{p.name}</CardTitle>
                    <CardDescription className="font-medium text-foreground/80">
                      {p.regNo}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      <span className="text-foreground/70">Age / gender:</span>{" "}
                      <span className="capitalize text-foreground">
                        {p.age} - {p.gender}
                      </span>
                    </p>
                    <p>
                      <span className="text-foreground/70">Phone:</span> {p.phone}
                    </p>
                    <p>
                      <span className="text-foreground/70">Registered:</span>{" "}
                      {format(new Date(p.createdAt), "dd MMM yyyy")}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button asChild className="w-full" variant="outline" size="sm">
                      <Link href={`/admin/patients/${p._id}`}>Open & edit</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
          {!loading && (
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
