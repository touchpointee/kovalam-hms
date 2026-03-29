"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, FlaskConical, IndianRupee } from "lucide-react";

type LabBillItem = { labTestName: string; quantity: number; unitPrice: number; totalPrice: number };
type LabBill = {
  _id: string;
  billedAt?: string;
  grandTotal: number;
  patient?: { name?: string; regNo?: string };
  visit?: { visitDate?: string; receiptNo?: string };
  items?: LabBillItem[];
};

function billTestLineCount(bill: LabBill): number {
  return (bill.items ?? []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}

function BillsTable({ bills, emptyLabel }: { bills: LabBill[]; emptyLabel: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Patient</TableHead>
          <TableHead>Receipt</TableHead>
          <TableHead>Tests</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bills.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : (
          bills.map((bill) => (
            <TableRow key={bill._id}>
              <TableCell>
                {bill.billedAt ? format(new Date(bill.billedAt), "dd MMM yyyy, HH:mm") : "-"}
              </TableCell>
              <TableCell>
                {bill.patient?.name ?? "-"}
                <div className="text-xs text-muted-foreground">{bill.patient?.regNo ?? "-"}</div>
              </TableCell>
              <TableCell>{bill.visit?.receiptNo ?? "-"}</TableCell>
              <TableCell>
                {(bill.items ?? []).map((i, idx) => (
                  <div key={`${bill._id}-${idx}`} className="text-xs">
                    {i.labTestName} x{i.quantity}
                  </div>
                ))}
              </TableCell>
              <TableCell className="text-right">{formatCurrency(bill.grandTotal ?? 0)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export type LabBillsDashboardProps = {
  pageTitle: string;
  pageDescription: string;
};

export default function LabBillsDashboard({ pageTitle, pageDescription }: LabBillsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [todayBills, setTodayBills] = useState<LabBill[]>([]);
  const [recentBills, setRecentBills] = useState<LabBill[]>([]);

  const todayIso = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(() => {
    const todayQ = `/api/laboratory/bills?from=${todayIso}&to=${todayIso}&limit=50`;
    const recentQ = "/api/laboratory/bills?limit=12";
    Promise.all([
      fetch(todayQ, { cache: "no-store" }).then((r) => r.json()),
      fetch(recentQ, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([todayData, recentData]) => {
        setTodayBills(Array.isArray(todayData?.items) ? todayData.items : []);
        setRecentBills(Array.isArray(recentData?.items) ? recentData.items : []);
      })
      .catch(() => {
        setTodayBills([]);
        setRecentBills([]);
      })
      .finally(() => setLoading(false));
  }, [todayIso]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 15000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const todayStats = useMemo(() => {
    const billCount = todayBills.length;
    const revenue = todayBills.reduce((s, b) => s + (Number(b.grandTotal) || 0), 0);
    const testLines = todayBills.reduce((s, b) => s + billTestLineCount(b), 0);
    return { billCount, revenue, testLines };
  }, [todayBills]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{pageDescription}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bills today</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-2xl font-semibold">{todayStats.billCount}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Visits with lab charges</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Test lines today</CardTitle>
            <FlaskConical className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-2xl font-semibold">{todayStats.testLines}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Ordered test line items</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue today</CardTitle>
            <IndianRupee className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-32" />
            ) : (
              <p className="text-2xl font-semibold">{formatCurrency(todayStats.revenue)}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Lab bill totals</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Today&apos;s lab bills</CardTitle>
          <CardDescription>Orders synced from consultations for today.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-64" /> : <BillsTable bills={todayBills} emptyLabel="No lab bills today." />}
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest lab bills across all dates (newest first).</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <BillsTable bills={recentBills} emptyLabel="No laboratory bills found." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
