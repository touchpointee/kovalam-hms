"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Report = {
  opSummary: { count: number; totalAmount: number };
  procedureSummary: { count: number; totalAmount: number };
  medicineSummary: { count: number; totalAmount: number };
  expenseSummary: { total: number; byCategory: { category: string; amount: number }[] };
  netRevenue: number;
  opVisits: Array<{ visitDate: string; patient?: { name: string; regNo: string }; receiptNo: string; opCharge: number }>;
  procedureBills: Array<{ billedAt: string; patient?: { name: string }; grandTotal: number }>;
  medicineBills: Array<{ billedAt: string; patient?: { name: string }; grandTotal: number }>;
  expenses: Array<{ date: string; category: string; description: string; amount: number }>;
};

export default function AdminReportsPage() {
  const [from, setFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const setRange = (range: "today" | "week" | "month" | "lastMonth") => {
    const now = new Date();
    if (range === "today") {
      setFrom(format(now, "yyyy-MM-dd"));
      setTo(format(now, "yyyy-MM-dd"));
    } else if (range === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      setFrom(format(start, "yyyy-MM-dd"));
      setTo(format(now, "yyyy-MM-dd"));
    } else if (range === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(format(start, "yyyy-MM-dd"));
      setTo(format(now, "yyyy-MM-dd"));
    } else {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(format(start, "yyyy-MM-dd"));
      setTo(format(end, "yyyy-MM-dd"));
    }
  };

  const generate = () => {
    setLoading(true);
    fetch(`/api/reports?from=${from}&to=${to}`)
      .then((res) => res.json())
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <Card>
        <CardHeader><CardTitle>Date Range</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2 items-end">
            <Button variant="outline" size="sm" onClick={() => setRange("today")}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => setRange("week")}>This Week</Button>
            <Button variant="outline" size="sm" onClick={() => setRange("month")}>This Month</Button>
            <Button variant="outline" size="sm" onClick={() => setRange("lastMonth")}>Last Month</Button>
          </div>
          <Button onClick={generate} disabled={loading}>{loading ? "Generating..." : "Generate Report"}</Button>
          {report && (
            <Button variant="outline" className="no-print" onClick={() => window.print()}>Print Report</Button>
          )}
        </CardContent>
      </Card>
      {loading && <Skeleton className="h-64" />}
      {report && !loading && (
        <div className="space-y-6 print-container">
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">OP Revenue</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatCurrency(report.opSummary.totalAmount)}</p><p className="text-muted-foreground text-xs">{report.opSummary.count} visits</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Procedure Revenue</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatCurrency(report.procedureSummary.totalAmount)}</p><p className="text-muted-foreground text-xs">{report.procedureSummary.count} bills</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Medicine Revenue</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatCurrency(report.medicineSummary.totalAmount)}</p><p className="text-muted-foreground text-xs">{report.medicineSummary.count} bills</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Expenses</CardTitle></CardHeader>
              <CardContent><p className="text-xl font-bold">{formatCurrency(report.expenseSummary.total)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Net Revenue</CardTitle></CardHeader>
              <CardContent><p className={`text-xl font-bold ${report.netRevenue >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(report.netRevenue)}</p></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>OP Visits</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Reg No</TableHead><TableHead>Receipt</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.opVisits.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell>{format(new Date(v.visitDate), "dd MMM yyyy")}</TableCell>
                      <TableCell>{(v.patient as { name?: string })?.name}</TableCell>
                      <TableCell>{(v.patient as { regNo?: string })?.regNo}</TableCell>
                      <TableCell>{v.receiptNo}</TableCell>
                      <TableCell>{formatCurrency(v.opCharge)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Procedure Bills</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.procedureBills.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell>{format(new Date(b.billedAt), "dd MMM yyyy")}</TableCell>
                      <TableCell>{(b.patient as { name?: string })?.name}</TableCell>
                      <TableCell>{formatCurrency(b.grandTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Medicine Bills</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Patient</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.medicineBills.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell>{format(new Date(b.billedAt), "dd MMM yyyy")}</TableCell>
                      <TableCell>{(b.patient as { name?: string })?.name}</TableCell>
                      <TableCell>{formatCurrency(b.grandTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.expenses.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell>{format(new Date(e.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell>{formatCurrency(e.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
