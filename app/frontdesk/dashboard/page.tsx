"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, ClipboardList, CreditCard, Users, FileText } from "lucide-react";

type Visit = {
  _id: string;
  visitDate: string;
  opCharge: number;
  paid: boolean;
  receiptNo: string;
  patient?: { name: string; regNo: string };
};

export default function FrontdeskDashboardPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setVisits(data);
        else setVisits(data.visits ?? data ?? []);
      })
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, []);

  const totalVisits = visits.length;
  const opFeesCollected = visits.filter((v) => v.paid).reduce((s, v) => s + (v.opCharge ?? 0), 0);
  const procedureBillsToday = 0; // Would need a separate API or include in response; placeholder

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OP Visits Today</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalVisits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OP Fees Collected</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(opFeesCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Procedure Bills Today</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{procedureBillsToday}</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/frontdesk/register">
            <UserPlus className="mr-2 h-4 w-4" />
            Register New Patient
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/frontdesk/visit">
            <ClipboardList className="mr-2 h-4 w-4" />
            New OP Visit
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/frontdesk/billing/procedure">
            <CreditCard className="mr-2 h-4 w-4" />
            Procedure Billing
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Visits</CardTitle>
          <CardDescription>List of OP visits for today</CardDescription>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => (
                  <TableRow key={v._id}>
                    <TableCell>{(v.patient as { name?: string })?.name ?? "-"}</TableCell>
                    <TableCell>{(v.patient as { regNo?: string })?.regNo ?? "-"}</TableCell>
                    <TableCell>{format(new Date(v.visitDate), "HH:mm")}</TableCell>
                    <TableCell>{formatCurrency(v.opCharge ?? 0)}</TableCell>
                    <TableCell>{v.paid ? "Yes" : "No"}</TableCell>
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
