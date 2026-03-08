"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, CreditCard, Pill, TrendingDown, TrendingUp, Users, AlertTriangle } from "lucide-react";

export default function AdminDashboardPage() {
  const [opTotal, setOpTotal] = useState(0);
  const [opCount, setOpCount] = useState(0);
  const [procedureTotal, setProcedureTotal] = useState(0);
  const [medicineTotal, setMedicineTotal] = useState(0);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [recentPatients, setRecentPatients] = useState<Array<{ _id: string; regNo: string; name: string; createdAt: string }>>([]);
  const [recentExpenses, setRecentExpenses] = useState<Array<{ _id: string; description: string; amount: number; date: string }>>([]);
  const [lowStock, setLowStock] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    Promise.all([
      fetch(`/api/visits?date=${today}`).then((r) => r.json()).then((visits) => {
        const list = Array.isArray(visits) ? visits : visits.visits ?? [];
        const paid = list.filter((v: { paid?: boolean }) => v.paid);
        setOpCount(paid.length);
        setOpTotal(paid.reduce((s: number, v: { opCharge?: number }) => s + (v.opCharge ?? 0), 0));
      }),
      fetch(`/api/reports?from=${today}&to=${today}`).then((r) => r.json()).then((data) => {
        setProcedureTotal(data.procedureSummary?.totalAmount ?? 0);
        setMedicineTotal(data.medicineSummary?.totalAmount ?? 0);
        setExpenseTotal(data.expenseSummary?.total ?? 0);
      }),
      fetch("/api/patients?limit=10").then((r) => r.json()).then((d) => setRecentPatients(d.patients ?? [])),
      fetch("/api/expenses?from=2020-01-01&to=2030-12-31").then((r) => r.json()).then((d) => setRecentExpenses((d.expenses ?? []).slice(0, 5))),
      fetch("/api/stock/low").then((r) => r.json()).then(setLowStock).catch(() => setLowStock([])),
    ]).finally(() => setLoading(false));
  }, []);

  const netRevenue = opTotal + procedureTotal + medicineTotal - expenseTotal;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">OP Revenue (Today)</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(opTotal)}</p>
            <p className="text-muted-foreground text-xs">{opCount} visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Procedure (Today)</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(procedureTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Medicine (Today)</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(medicineTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expenses (Today)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(expenseTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netRevenue >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(netRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low Stock / Expiring (Top 5)</CardTitle>
            <CardDescription className="sr-only">Alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-muted-foreground text-sm">No alerts.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {(lowStock as Array<{ medicine?: { name: string }; batchNo: string; currentStock: number }>).slice(0, 5).map((b, i) => (
                  <li key={i}>{b.medicine?.name ?? "-"} — {b.batchNo} (Stock: {b.currentStock})</li>
                ))}
              </ul>
            )}
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/pharmacy/stock">View Stock</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reg No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPatients.slice(0, 5).map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>{p.regNo}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{format(new Date(p.createdAt), "dd MMM yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentExpenses.map((e) => (
                <TableRow key={e._id}>
                  <TableCell>{format(new Date(e.date), "dd MMM yyyy")}</TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell>{formatCurrency(e.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
