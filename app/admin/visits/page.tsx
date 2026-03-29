"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/utils";
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
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays } from "lucide-react";

type PatientRef = { _id: string; name: string; regNo: string };
type VisitRow = {
  _id: string;
  visitDate: string;
  receiptNo?: string;
  status?: "waiting" | "served";
  opCharge?: number;
  paid?: boolean;
  patient?: PatientRef;
  doctor?: { name?: string } | null;
};

function todayYmd() {
  return format(new Date(), "yyyy-MM-dd");
}

export default function AdminTodayVisitsPage() {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayYmd);

  const selectedLabel = useMemo(
    () => format(parseISO(selectedDate), "dd MMM yyyy"),
    [selectedDate]
  );
  const isToday = selectedDate === todayYmd();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/visits?date=${encodeURIComponent(selectedDate)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setVisits(Array.isArray(data) ? data : data.visits ?? []))
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">OP visit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a date to list OP visits for that day. Open consultation, procedure billing, or pharmacy billing for any visit. Bills are read-only for staff after generation; admins can edit from those pages.
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center gap-2 rounded-md border border-transparent bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="tabular-nums">{selectedLabel}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Select date for OP visits"
          />
        </label>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">OP visits</CardTitle>
            <CardDescription>
              {isToday
                ? "All visits registered for today"
                : `All visits registered on ${selectedLabel}`}
            </CardDescription>
          </div>
          <label className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <CalendarDays className="h-4 w-4" aria-hidden />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Select date for OP visits list"
            />
          </label>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : visits.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isToday ? "No visits today." : `No visits on ${selectedLabel}.`}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>OP fee</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => {
                  const p = v.patient as PatientRef | undefined;
                  const pid = p?._id;
                  return (
                    <TableRow key={v._id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(v.visitDate), "HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">{p?.name ?? "-"}</TableCell>
                      <TableCell className="max-w-[10rem] truncate text-muted-foreground">
                        {(v.doctor as { name?: string } | undefined)?.name ?? "—"}
                      </TableCell>
                      <TableCell>{p?.regNo ?? "-"}</TableCell>
                      <TableCell>{v.receiptNo ?? "-"}</TableCell>
                      <TableCell>{formatCurrency(v.opCharge ?? 0)}</TableCell>
                      <TableCell>{v.paid ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {v.status ?? "waiting"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {pid && (
                            <>
                              <Button asChild size="sm" variant="default">
                                <Link href={`/admin/patients/${pid}/consultation?visitId=${v._id}`}>
                                  Consultation
                                </Link>
                              </Button>
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/admin/procedure-billing/${v._id}`}>Procedure</Link>
                              </Button>
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/admin/pharmacy/billing/${v._id}`}>Pharmacy</Link>
                              </Button>
                              <Button asChild size="sm" variant="secondary">
                                <Link href={`/admin/patients/${pid}`}>Patient</Link>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
