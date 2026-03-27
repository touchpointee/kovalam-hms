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
  minQuantity?: number;
  daysToExpiry?: number;
  isOutOfStock?: boolean;
  isLowStock?: boolean;
  isCriticalStock?: boolean;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  medicine?: { name: string };
};

export default function PharmacyDashboardPage() {
  const [lowStock, setLowStock] = useState<StockBatch[]>([]);
  const [medsCount, setMedsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      await Promise.all([
        fetch("/api/medicines", { cache: "no-store" })
          .then((r) => r.json())
          .then((list) => setMedsCount(Array.isArray(list) ? list.length : 0)),
        fetch("/api/stock/low", { cache: "no-store" })
          .then((r) => r.json())
          .then((list) => setLowStock(Array.isArray(list) ? list : []))
          .catch(() => setLowStock([])),
      ]);
    };

    loadDashboard().finally(() => setLoading(false));
    const interval = setInterval(() => {
      loadDashboard().catch(() => undefined);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getExpiryBadge = (expiryDate: string) => {
    const d = new Date(expiryDate);
    const days = differenceInDays(d, new Date());
    if (days < 0) return <Badge variant="destructive">Expired</Badge>;
    if (days <= 30) return <Badge className="bg-orange-500 hover:bg-orange-500">{"<"}30 days</Badge>;
    if (days <= 90) return <Badge className="bg-yellow-500 text-black hover:bg-yellow-500">30-90 days</Badge>;
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">{">"}90 days</Badge>;
  };

  const getAlertBadge = (batch: StockBatch) => {
    if (batch.isExpired) return <Badge variant="destructive">Expired</Badge>;
    if (batch.isOutOfStock) return <Badge variant="destructive">Out of Stock</Badge>;
    if (batch.isLowStock) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Low Stock</Badge>;
    if (batch.isExpiringSoon) return <Badge className="bg-orange-500 hover:bg-orange-500">{"<"}30 days</Badge>;
    return getExpiryBadge(batch.expiryDate);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Pharmacy Dashboard</h1>
          <p className="text-sm text-muted-foreground">Loading inventory and expiry alerts...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pharmacy Dashboard</h1>
        <p className="text-sm text-muted-foreground">Monitor stock risk and medicine expiry status.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Medicines</CardTitle>
            <Pill className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{medsCount}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alert Batches</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{lowStock.length}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{lowStock.filter((b) => b.isLowStock).length}</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical / Expired</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {lowStock.filter((b) => b.isCriticalStock || b.isExpired || b.isOutOfStock).length}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Low Stock & Expiring Alerts</CardTitle>
          <CardDescription>Review and replenish critical medicine batches.</CardDescription>
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
                    <TableCell className="font-medium">{(b.medicine as { name?: string })?.name ?? "-"}</TableCell>
                    <TableCell>{b.batchNo}</TableCell>
                    <TableCell>{format(new Date(b.expiryDate), "dd MMM yyyy")}</TableCell>
                    <TableCell>{b.currentStock}</TableCell>
                    <TableCell>{getAlertBadge(b)}</TableCell>
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
