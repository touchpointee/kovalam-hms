"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
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
import { Pill, Package, AlertTriangle, Calendar } from "lucide-react";

type StockBatch = {
  _id: string;
  batchNo: string;
  expiryDate: string;
  currentStock: number;
  medicine?: { name: string };
};

export default function PharmacyDashboardPage() {
  const [lowStock, setLowStock] = useState<StockBatch[]>([]);
  const [medsCount, setMedsCount] = useState(0);
  const [batchesCount, setBatchesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/medicines").then((r) => r.json()).then((list) => setMedsCount(Array.isArray(list) ? list.length : 0)),
      fetch("/api/stock/low").then((r) => r.json()).then(setLowStock).catch(() => setLowStock([])),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (lowStock.length > 0) {
      const uniqueMedicines = new Set(lowStock.map((b) => (b.medicine as { _id?: string })?._id ?? b._id));
      setBatchesCount(lowStock.length);
    }
  }, [lowStock]);

  const getExpiryBadge = (expiryDate: string) => {
    const d = new Date(expiryDate);
    const days = differenceInDays(d, new Date());
    if (days < 0) return <Badge className="bg-red-600">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500">{"<"}30 days</Badge>;
    if (days <= 90) return <Badge className="bg-yellow-500 text-black">30-90 days</Badge>;
    return <Badge className="bg-green-600">{">"}90 days</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Pharmacy Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
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
      <h1 className="text-2xl font-semibold">Pharmacy Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Medicines</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{medsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alert Batches</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lowStock.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock (&lt;10)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{lowStock.filter((b) => b.currentStock < 10).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring (30 days)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {lowStock.filter((b) => differenceInDays(new Date(b.expiryDate), new Date()) <= 30 && differenceInDays(new Date(b.expiryDate), new Date()) >= 0).length}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Low Stock & Expiring Alerts</CardTitle>
          <CardDescription className="sr-only">Batches</CardDescription>
        </CardHeader>
        <CardContent>
          {lowStock.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">No alerts.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((b) => (
                  <TableRow key={b._id}>
                    <TableCell>{(b.medicine as { name?: string })?.name ?? "-"}</TableCell>
                    <TableCell>{b.batchNo}</TableCell>
                    <TableCell>{format(new Date(b.expiryDate), "dd MMM yyyy")}</TableCell>
                    <TableCell>{b.currentStock}</TableCell>
                    <TableCell>{getExpiryBadge(b.expiryDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Button asChild className="mt-4" variant="outline">
            <Link href="/pharmacy/stock">Manage Stock</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
