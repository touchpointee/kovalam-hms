"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
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

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";

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

export default function ReportsPage() {
  const [from, setFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportFetchedAt, setReportFetchedAt] = useState<string | null>(null);

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
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load report");
        return res.json();
      })
      .then((data) => {
        setReport(data);
        setReportFetchedAt(format(new Date(), "dd MMM yyyy, HH:mm"));
      })
      .catch(() => {
        setReport(null);
        setReportFetchedAt(null);
      })
      .finally(() => setLoading(false));
  };

  const fromLabel = from ? format(parseISO(from), "dd MMM yyyy") : "";
  const toLabel = to ? format(parseISO(to), "dd MMM yyyy") : "";

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <Card>
          <CardHeader>
            <CardTitle>Date range</CardTitle>
          </CardHeader>
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
              <Button variant="outline" size="sm" onClick={() => setRange("today")}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRange("week")}>
                This week
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRange("month")}>
                This month
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRange("lastMonth")}>
                Last month
              </Button>
            </div>
            <Button onClick={generate} disabled={loading}>
              {loading ? "Generating..." : "Generate report"}
            </Button>
            {report && (
              <Button type="button" variant="outline" onClick={() => window.print()}>
                Print report
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {loading && <Skeleton className="no-print h-64" />}

      {report && !loading && (
        <div className="financial-report-print print-container space-y-5">
          <div className="report-print-only mb-4 border-b border-slate-400 pb-3">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Revenue &amp; activity report</h2>
            <p className="mt-1 text-sm text-slate-800">
              <span className="font-medium">{hospitalName}</span>
              <span className="text-slate-600"> — Period: </span>
              {fromLabel} to {toLabel}
            </p>
            {reportFetchedAt ? (
              <p className="mt-1 text-xs text-slate-600">Data exported: {reportFetchedAt}</p>
            ) : null}
          </div>

          <div className="report-screen-header mb-2 border-b border-slate-200 pb-3 no-print md:hidden">
            <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
            <p className="text-sm text-muted-foreground">
              {fromLabel} — {toLabel}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 print:grid-cols-5 print:gap-2">
            <Card className="report-section shadow-sm print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">OP revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-lg font-bold tabular-nums print:text-base sm:text-xl">
                  {formatCurrency(report.opSummary.totalAmount)}
                </p>
                <p className="text-muted-foreground text-xs">{report.opSummary.count} visits</p>
              </CardContent>
            </Card>
            <Card className="report-section shadow-sm print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Procedure revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-lg font-bold tabular-nums print:text-base sm:text-xl">
                  {formatCurrency(report.procedureSummary.totalAmount)}
                </p>
                <p className="text-muted-foreground text-xs">{report.procedureSummary.count} bills</p>
              </CardContent>
            </Card>
            <Card className="report-section shadow-sm print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Medicine revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-lg font-bold tabular-nums print:text-base sm:text-xl">
                  {formatCurrency(report.medicineSummary.totalAmount)}
                </p>
                <p className="text-muted-foreground text-xs">{report.medicineSummary.count} bills</p>
              </CardContent>
            </Card>
            <Card className="report-section shadow-sm print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-lg font-bold tabular-nums print:text-base sm:text-xl">
                  {formatCurrency(report.expenseSummary.total)}
                </p>
              </CardContent>
            </Card>
            <Card className="report-section col-span-2 shadow-sm sm:col-span-1 print:col-span-1 print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net revenue</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p
                  className={`text-lg font-bold tabular-nums print:text-base sm:text-xl ${report.netRevenue >= 0 ? "text-emerald-700 print:text-slate-900" : "text-red-600 print:text-slate-900"}`}
                >
                  {formatCurrency(report.netRevenue)}
                </p>
              </CardContent>
            </Card>
          </div>

          {report.expenseSummary.byCategory.length > 0 ? (
            <Card className="report-section shadow-sm print:shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Expenses by category</CardTitle>
              </CardHeader>
              <CardContent className="report-table-wrap pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.expenseSummary.byCategory.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell className="capitalize">{row.category}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          <Card className="report-section report-section--table shadow-sm print:shadow-none">
            <CardHeader>
              <CardTitle className="text-base">OP visits</CardTitle>
            </CardHeader>
            <CardContent className="report-table-wrap overflow-x-auto p-0 px-6 pb-6 pt-0 sm:pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Reg No</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
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

          <Card className="report-section report-section--table shadow-sm print:shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Procedure bills</CardTitle>
            </CardHeader>
            <CardContent className="report-table-wrap overflow-x-auto p-0 px-6 pb-6 pt-0 sm:pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
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

          <Card className="report-section report-section--table shadow-sm print:shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Medicine bills</CardTitle>
            </CardHeader>
            <CardContent className="report-table-wrap overflow-x-auto p-0 px-6 pb-6 pt-0 sm:pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
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

          <Card className="report-section report-section--table shadow-sm print:shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Expense lines</CardTitle>
            </CardHeader>
            <CardContent className="report-table-wrap overflow-x-auto p-0 px-6 pb-6 pt-0 sm:pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
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

          <div className="report-print-only mt-8 border-t border-slate-300 pt-3 text-center text-xs text-slate-600">
            End of report — {hospitalName}
          </div>
        </div>
      )}
    </div>
  );
}
