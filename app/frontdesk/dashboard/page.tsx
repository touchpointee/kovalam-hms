"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Users, FileText } from "lucide-react";

type Visit = {
  _id: string;
  visitDate: string;
  status?: "waiting" | "served";
  opCharge: number;
  paid: boolean;
  receiptNo: string;
  patient?: { _id: string; name: string; regNo: string };
  procedureBills?: Array<{ _id: string }>;
};

export default function FrontdeskDashboardPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVisits = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}&includeProcedureBills=true`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setVisits(data);
        else setVisits(data.visits ?? data ?? []);
      })
      .catch(() => setVisits([]));
  };

  useEffect(() => {
    loadVisits();
    setLoading(false);
    const interval = setInterval(loadVisits, 15000);
    const onFocus = () => loadVisits();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const totalVisits = visits.length;
  const waitingVisits = visits.filter((v) => (v.status ?? "waiting") === "waiting");
  const servedVisits = visits.filter((v) => v.status === "served");
  const opFeesCollected = visits.filter((v) => v.paid).reduce((s, v) => s + (v.opCharge ?? 0), 0);
  const procedureBillsToday = servedVisits.reduce((count, visit) => count + (visit.procedureBills?.length ?? 0), 0);

  if (loading) {
    return (
      <div className="op-page">
        <div className="space-y-1">
          <h1 className="op-title">Frontdesk Dashboard</h1>
          <p className="text-sm text-muted-foreground">Loading registration and billing overview...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="op-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="op-title">Daily OP Overview</h1>
          <p className="op-subtitle mt-1">
            Registration and OP collections for {format(new Date(), "dd MMM yyyy")}
          </p>
        </div>
        <Badge variant="secondary" className="rounded-md border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs text-teal-700">
          Daily Operations
        </Badge>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-emerald-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">OP Visits Today</CardTitle>
            <Users className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalVisits}</p>
            <p className="mt-1 text-xs text-muted-foreground">Waiting: {waitingVisits.length} | Served: {servedVisits.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-emerald-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">OP Fees Collected</CardTitle>
            <FileText className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(opFeesCollected)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-emerald-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Procedure Bills Today</CardTitle>
            <CreditCard className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{procedureBillsToday}</p>
            <p className="mt-1 text-xs text-muted-foreground">Saved for today&apos;s served visits</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-emerald-100 shadow-sm">
        <CardHeader>
          <CardTitle>Today&apos;s Visits</CardTitle>
          <CardDescription>Waiting and served visits for today</CardDescription>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">No visits today.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => (
                  <TableRow key={v._id}>
                    <TableCell className="font-medium">{(v.patient as { name?: string })?.name ?? "-"}</TableCell>
                    <TableCell>{(v.patient as { regNo?: string })?.regNo ?? "-"}</TableCell>
                    <TableCell>{format(new Date(v.visitDate), "HH:mm")}</TableCell>
                    <TableCell>{formatCurrency(v.opCharge ?? 0)}</TableCell>
                    <TableCell>{v.paid ? "Yes" : "No"}</TableCell>
                    <TableCell className="capitalize">{v.status ?? "waiting"}</TableCell>
                    <TableCell>
                      {(v.patient as { _id?: string })?._id ? (
                        (v.status ?? "waiting") === "waiting" ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/doctor/patients/${(v.patient as { _id: string })._id}/consultation?visitId=${v._id}`}>Consult</Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/frontdesk/procedure-billing/${v._id}`}>
                              {(v.procedureBills?.length ?? 0) > 0 ? "View Procedure Bill" : "Procedure Billing"}
                            </Link>
                          </Button>
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
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
