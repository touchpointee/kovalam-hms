"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Visit = {
  _id: string;
  visitDate: string;
  patient?: { _id: string; name: string; regNo: string; age: number; gender: string };
};

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}&status=waiting`)
      .then((res) => res.json())
      .then((data) => setVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? visits.filter((v) => {
        const p = v.patient as { name?: string; regNo?: string };
        const q = search.toLowerCase();
        return p?.name?.toLowerCase().includes(q) || p?.regNo?.toLowerCase().includes(q);
      })
    : visits;

  if (loading) {
    return (
      <div className="op-page">
        <div className="space-y-1">
          <h1 className="op-title">Doctor Dashboard</h1>
          <p className="text-sm text-muted-foreground">Loading today&apos;s OP queue...</p>
        </div>
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="op-page">
      <div className="space-y-1">
        <h1 className="op-title">Today&apos;s OP Patients</h1>
        <p className="op-subtitle">
          Search and open consultation quickly from the active patient queue.
        </p>
      </div>
      <div className="op-highlight max-w-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-100">Waiting OPs</p>
        <p className="mt-1 text-3xl font-semibold">{filtered.length}</p>
      </div>
      <Input
        placeholder="Search by patient name or reg no..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="op-input h-10 max-w-sm bg-card"
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground col-span-full rounded-xl border border-emerald-100 bg-card py-8 text-center">
            No visits today.
          </p>
        ) : (
          filtered.map((v) => {
            const p = v.patient as { _id: string; name: string; regNo: string; age: number; gender: string };
            return (
              <Card
                key={v._id}
                className="cursor-pointer rounded-2xl border-emerald-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => router.push(`/doctor/patients/${p._id}/consultation?visitId=${v._id}`)}
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base">{p?.name ?? "-"}</CardTitle>
                  <CardDescription className="text-sm">Reg No: {p?.regNo}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <p>Age: {p?.age} | Gender: {p?.gender}</p>
                  <p className="mt-1 text-muted-foreground">Visit time: {format(new Date(v.visitDate), "HH:mm")}</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
