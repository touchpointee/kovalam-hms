"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    fetch(`/api/visits?date=${today}`)
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
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Today&apos;s OP Patients</h1>
      <Input
        placeholder="Search by name or reg no..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground col-span-full py-8 text-center">No visits today.</p>
        ) : (
          filtered.map((v) => {
            const p = v.patient as { _id: string; name: string; regNo: string; age: number; gender: string };
            return (
              <Card
                key={v._id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/doctor/patients/${p._id}/consultation`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p?.name ?? "-"}</CardTitle>
                  <CardDescription className="text-sm">{p?.regNo}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <p>Age: {p?.age} | Gender: {p?.gender}</p>
                  <p className="text-muted-foreground">Visit: {format(new Date(v.visitDate), "HH:mm")}</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
