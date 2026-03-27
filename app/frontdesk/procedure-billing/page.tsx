"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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

type Patient = { _id: string; name: string; regNo: string };
type Visit = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  status?: "waiting" | "served";
  patient?: Patient;
  procedureBills?: Array<{ _id: string; grandTotal?: number }>;
};

export default function FrontdeskProcedureBillingPage() {
  const [todayServedVisits, setTodayServedVisits] = useState<Visit[]>([]);

  const loadTodayServedVisits = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}&status=served&includeProcedureBills=true`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTodayServedVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setTodayServedVisits([]));
  };

  useEffect(() => {
    loadTodayServedVisits();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Procedure Billing</h1>
        <Button variant="outline" onClick={loadTodayServedVisits}>Refresh</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Served Visits</CardTitle>
          <CardDescription>Create, reopen, edit, and print procedure bills for served visits</CardDescription>
        </CardHeader>
        <CardContent>
          {todayServedVisits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No served visits today.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Visit Time</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Bill Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayServedVisits.map((visit) => (
                  <TableRow key={visit._id}>
                    <TableCell>{visit.patient?.name ?? "-"}</TableCell>
                    <TableCell>{visit.patient?.regNo ?? "-"}</TableCell>
                    <TableCell>{format(new Date(visit.visitDate), "HH:mm")}</TableCell>
                    <TableCell>{visit.receiptNo ?? "-"}</TableCell>
                    <TableCell>
                      {(visit.procedureBills?.length ?? 0) > 0 ? (
                        <Badge className="bg-emerald-600">Billed</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {visit.patient?._id ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/frontdesk/procedure-billing/${visit._id}`}>
                            {(visit.procedureBills?.length ?? 0) > 0 ? "Open Bill" : "Bill This Visit"}
                          </Link>
                        </Button>
                      ) : "-"}
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
