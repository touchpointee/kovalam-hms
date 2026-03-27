"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
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
};

export default function PharmacyBillingPage() {
  const [todayServedVisits, setTodayServedVisits] = useState<Visit[]>([]);

  const loadTodayServedVisits = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    fetch(`/api/visits?date=${today}&status=served`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setTodayServedVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setTodayServedVisits([]));
  };

  useEffect(() => {
    loadTodayServedVisits();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Medicine Billing</h1>
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Served Visits</CardTitle>
          <CardDescription>Select a visit to bill medicines by visit</CardDescription>
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
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayServedVisits.map((v) => (
                  <TableRow key={v._id}>
                    <TableCell>{(v.patient as Patient | undefined)?.name ?? "-"}</TableCell>
                    <TableCell>{(v.patient as Patient | undefined)?.regNo ?? "-"}</TableCell>
                    <TableCell>{format(new Date(v.visitDate), "HH:mm")}</TableCell>
                    <TableCell>{v.receiptNo ?? "-"}</TableCell>
                    <TableCell>
                      {(v.patient as Patient | undefined)?._id ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/pharmacy/billing/${v._id}`}>
                            Bill This Visit
                          </Link>
                        </Button>
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
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Only visit-based billing is enabled. Open any served visit to view prescription details,
            generate bill, and print the bill.
          </p>
          <div className="mt-3">
            <Button variant="outline" onClick={loadTodayServedVisits}>
              Refresh List
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
